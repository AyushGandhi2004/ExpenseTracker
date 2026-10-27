/**
 * Parsers for the free price feeds. Pure functions over the raw responses so they can be
 * tested with fixtures; fetching lives in src/server/services/prices.ts.
 *
 *   AMFI NAVAll.txt — official daily NAV of every scheme (`;`-separated).
 *   mfapi.in        — fund search and NAV history (dates "dd-mm-yyyy", newest first).
 *   Yahoo Finance   — NSE (.NS) / BSE (.BO) quotes and daily closes (unofficial).
 *
 * Prices are returned as ₹/unit scaled ×10⁴ (see src/lib/portfolio.ts).
 */

import type { IsoDate } from "@/lib/dates";
import { PRICE_DECIMALS, parseDecimalRounded } from "@/lib/portfolio";

export type PricePoint = { price: bigint; date: IsoDate };

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "26-Oct-2026" → "2026-10-26". */
export function parseAmfiDate(text: string): IsoDate | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text.trim());
  const month = m && MONTHS[m[2].toLowerCase()];
  return m && month ? `${m[3]}-${month}-${m[1].padStart(2, "0")}` : null;
}

/** "26-10-2026" → "2026-10-26". */
export function parseDmyDate(text: string): IsoDate | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const toPrice = (value: string | number) => {
  const price = parseDecimalRounded(value, PRICE_DECIMALS);
  return price !== null && price > 0n ? price : null;
};

/** Yahoo sends binary floats (2496.89990234375); Indian share prices tick in paise. */
const toStockPrice = (value: number) => (Number.isFinite(value) ? toPrice(value.toFixed(2)) : null);

export type AmfiNav = PricePoint & { schemeCode: string; isin: string | null; name: string };

/**
 * Every scheme line of NAVAll.txt:
 * `Scheme Code;ISIN Growth;ISIN Reinvestment;Scheme Name;Plan;Option;NAV;Date`.
 * Header, fund-house and category lines, and rows without a NAV ("N.A.") are skipped.
 */
export function parseAmfiNavAll(text: string): Map<string, AmfiNav> {
  const navs = new Map<string, AmfiNav>();
  for (const raw of text.split("\n")) {
    const cols = raw.replace(/\r$/, "").split(";");
    if (cols.length < 8 || !/^\d+$/.test(cols[0])) continue;
    const [schemeCode, isinGrowth, , schemeName, plan, option] = cols;
    const price = toPrice(cols[cols.length - 2]);
    const date = parseAmfiDate(cols[cols.length - 1]);
    if (!price || !date) continue;
    const isin = /^IN[A-Z0-9]{10}$/.test(isinGrowth) ? isinGrowth : null;
    const name = [schemeName, plan, option].map((s) => s.trim()).filter(Boolean).join(" - ");
    navs.set(schemeCode, { schemeCode, isin, name, price, date });
  }
  return navs;
}

// ── mfapi.in ─────────────────────────────────────────────────────────────────

export type FundSearchResult = { schemeCode: string; name: string };

export function parseFundSearch(json: unknown): FundSearchResult[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((r) =>
    r && (typeof r.schemeCode === "number" || typeof r.schemeCode === "string") && typeof r.schemeName === "string"
      ? [{ schemeCode: String(r.schemeCode), name: r.schemeName }]
      : [],
  );
}

export type FundHistory = { name: string; isin: string | null; navs: PricePoint[] };

/** `/mf/{code}` or `/mf/{code}/latest`. NAVs come back oldest first. */
export function parseFundHistory(json: unknown): FundHistory | null {
  const body = json as { meta?: { scheme_name?: unknown; isin_growth?: unknown }; data?: unknown } | null;
  if (!body?.meta || typeof body.meta.scheme_name !== "string" || !Array.isArray(body.data)) return null;
  const navs = body.data
    .flatMap((d: { date?: unknown; nav?: unknown }) => {
      const date = typeof d?.date === "string" ? parseDmyDate(d.date) : null;
      const price = typeof d?.nav === "string" ? toPrice(d.nav) : null;
      return date && price ? [{ date, price }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const isin = typeof body.meta.isin_growth === "string" ? body.meta.isin_growth : null;
  return { name: body.meta.scheme_name, isin, navs };
}

/**
 * The price that applies to a trade on `date`: that day's, or else the next published one
 * (orders placed on a holiday get the next business day's NAV). Null if none is out yet.
 */
export function priceOn(points: readonly PricePoint[], date: IsoDate): PricePoint | null {
  return points.find((p) => p.date >= date) ?? null;
}

/** The latest price on or before `date` (for valuing a holding on a day). */
export function priceAsOf(points: readonly PricePoint[], date: IsoDate): PricePoint | null {
  let found: PricePoint | null = null;
  for (const p of points) {
    if (p.date > date) break;
    found = p;
  }
  return found;
}

// ── Yahoo Finance ────────────────────────────────────────────────────────────

export type Exchange = "NSE" | "BSE";
export const yahooSymbol = (symbol: string, exchange: Exchange) => `${symbol}.${exchange === "NSE" ? "NS" : "BO"}`;

/** IST calendar date of a unix timestamp (seconds). */
export function istDateOf(unixSeconds: number): IsoDate {
  return new Date((unixSeconds + 330 * 60) * 1000).toISOString().slice(0, 10);
}

export type StockChart = { name: string | null; quote: PricePoint | null; closes: PricePoint[] };

/** `/v8/finance/chart/{symbol}`: latest market price plus daily closes (oldest first). */
export function parseYahooChart(json: unknown): StockChart | null {
  const result = (json as { chart?: { result?: unknown[] } } | null)?.chart?.result?.[0] as
    | {
        meta?: { regularMarketPrice?: unknown; regularMarketTime?: unknown; longName?: unknown; shortName?: unknown; currency?: unknown };
        timestamp?: unknown;
        indicators?: { quote?: { close?: unknown }[] };
      }
    | undefined;
  const meta = result?.meta;
  if (!meta || (meta.currency !== undefined && meta.currency !== "INR")) return null;

  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const rawCloses = result.indicators?.quote?.[0]?.close;
  const closes = Array.isArray(rawCloses) ? rawCloses : [];
  const points: PricePoint[] = [];
  timestamps.forEach((ts, i) => {
    const close = closes[i];
    const price = typeof ts === "number" && typeof close === "number" ? toStockPrice(close) : null;
    if (price) points.push({ date: istDateOf(ts as number), price });
  });

  const marketPrice = typeof meta.regularMarketPrice === "number" ? toStockPrice(meta.regularMarketPrice) : null;
  const quote =
    marketPrice && typeof meta.regularMarketTime === "number"
      ? { price: marketPrice, date: istDateOf(meta.regularMarketTime) }
      : (points.at(-1) ?? null);
  const name = typeof meta.longName === "string" ? meta.longName : typeof meta.shortName === "string" ? meta.shortName : null;
  return { name, quote, closes: points };
}

export type StockSearchResult = { symbol: string; exchange: Exchange; name: string };

/** `/v1/finance/search`: Indian equities only, symbol without the .NS/.BO suffix. */
export function parseYahooSearch(json: unknown): StockSearchResult[] {
  const quotes = (json as { quotes?: unknown[] } | null)?.quotes;
  if (!Array.isArray(quotes)) return [];
  return quotes.flatMap((q) => {
    const { symbol, quoteType, shortname, longname } = (q ?? {}) as Record<string, unknown>;
    if (typeof symbol !== "string" || (quoteType !== "EQUITY" && quoteType !== "ETF")) return [];
    const m = /^(.+)\.(NS|BO)$/.exec(symbol);
    if (!m) return [];
    const name = typeof longname === "string" ? longname : typeof shortname === "string" ? shortname : m[1];
    return [{ symbol: m[1], exchange: m[2] === "NS" ? ("NSE" as const) : ("BSE" as const), name }];
  });
}
