import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { addDays, todayIst, type IsoDate } from "@/lib/dates";
import { formatPrice, parsePrice } from "@/lib/portfolio";
import {
  parseAmfiNavAll,
  parseFundHistory,
  parseFundSearch,
  parseYahooChart,
  parseYahooSearch,
  priceAsOf,
  priceOn,
  yahooSymbol,
  type Exchange,
  type FundSearchResult,
  type PricePoint,
  type StockSearchResult,
} from "@/lib/price-feeds";
import { db } from "@/server/db";
import { instruments, type Instrument } from "@/server/db/schema";

/**
 * Fetching prices from the free feeds (parsers in src/lib/price-feeds.ts). Every function
 * returns null / [] when a source is down or changes shape, so callers fall back to the
 * last saved price or a typed one — a feed outage never blocks recording a trade.
 */

const AMFI_NAV_ALL = "https://portal.amfiindia.com/spages/NAVAll.txt";
const MFAPI = "https://api.mfapi.in/mf";
const YAHOO = "https://query1.finance.yahoo.com";
const TIMEOUT_MS = 8_000;
/** The Refresh button doesn't re-fetch an instrument checked this recently. */
export const REFRESH_THROTTLE_MS = 15 * 60_000;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (expense-tracker)" },
    });
    return res.ok ? await res.text() : null;
  } catch (error) {
    console.warn(`[prices] ${new URL(url).host} failed:`, (error as Error).message);
    return null;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const text = await fetchText(url);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function searchFunds(query: string): Promise<FundSearchResult[]> {
  const results = parseFundSearch(await fetchJson(`${MFAPI}/search?q=${encodeURIComponent(query)}`));
  // Growth plans first (what people usually hold), then direct before regular.
  const rank = (name: string) => (/idcw|dividend|bonus/i.test(name) ? 2 : 0) + (/direct/i.test(name) ? 0 : 1);
  return results.sort((a, b) => rank(a.name) - rank(b.name)).slice(0, 25);
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const url = `${YAHOO}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&listsCount=0`;
  return parseYahooSearch(await fetchJson(url));
}

// ── Funds ────────────────────────────────────────────────────────────────────

/** Name, ISIN and latest NAV of a scheme (small request). */
export async function fundLatest(schemeCode: string) {
  const history = parseFundHistory(await fetchJson(`${MFAPI}/${encodeURIComponent(schemeCode)}/latest`));
  return history ? { name: history.name, isin: history.isin, latest: history.navs.at(-1) ?? null } : null;
}

const historyCache = new Map<string, { at: number; navs: PricePoint[] | null }>();
const HISTORY_TTL_MS = 10 * 60_000;
/** A failed fetch is remembered briefly, so a feed outage doesn't slow every page load. */
const HISTORY_FAILURE_TTL_MS = 2 * 60_000;

/** Full NAV history (oldest first), cached per scheme. */
export async function fundNavHistory(schemeCode: string): Promise<PricePoint[] | null> {
  const cached = historyCache.get(schemeCode);
  if (cached && Date.now() - cached.at < (cached.navs ? HISTORY_TTL_MS : HISTORY_FAILURE_TTL_MS)) return cached.navs;
  const history = parseFundHistory(await fetchJson(`${MFAPI}/${encodeURIComponent(schemeCode)}`));
  const navs = history?.navs ?? null;
  historyCache.set(schemeCode, { at: Date.now(), navs });
  return navs;
}

/** Latest NAV of every scheme from AMFI's official daily file. */
export async function fetchAmfiNavs() {
  const text = await fetchText(AMFI_NAV_ALL);
  return text ? parseAmfiNavAll(text) : null;
}

// ── Stocks ───────────────────────────────────────────────────────────────────

export async function stockChart(symbol: string, exchange: Exchange, range: "5d" | "1mo" = "5d") {
  const url = `${YAHOO}/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol, exchange))}?range=${range}&interval=1d`;
  return parseYahooChart(await fetchJson(url));
}

/** Daily closes from a week before `date` to a week after (for backdated trades). */
async function stockClosesAround(symbol: string, exchange: Exchange, date: IsoDate) {
  const toUnix = (d: IsoDate) => Math.floor(Date.parse(`${d}T00:00:00+05:30`) / 1000);
  const url =
    `${YAHOO}/v8/finance/chart/${encodeURIComponent(yahooSymbol(symbol, exchange))}` +
    `?period1=${toUnix(addDays(date, -7))}&period2=${toUnix(addDays(date, 8))}&interval=1d`;
  return parseYahooChart(await fetchJson(url));
}

// ── Prices for trades and holdings ──────────────────────────────────────────

type PricedInstrument = Pick<Instrument, "kind" | "schemeCode" | "symbol" | "exchange">;

export type TradePrice = PricePoint & {
  /** True when the trade date's own price isn't published yet and the latest was used. */
  estimated: boolean;
};

/**
 * The price to pre-fill for a trade on `date`.
 * Funds: that day's NAV, or the next published one (holiday orders). Stocks: that day's
 * close (or today's live price), else the last close before it.
 */
export async function priceForTrade(inst: PricedInstrument, date: IsoDate): Promise<TradePrice | null> {
  if (inst.kind === "mutual_fund" && inst.schemeCode) {
    const navs = await fundNavHistory(inst.schemeCode);
    if (!navs?.length) return null;
    const exact = priceOn(navs, date);
    return exact ? { ...exact, estimated: false } : { ...navs.at(-1)!, estimated: true };
  }
  if (inst.kind === "stock" && inst.symbol && inst.exchange) {
    const exchange = inst.exchange as Exchange;
    if (date >= todayIst()) {
      const chart = await stockChart(inst.symbol, exchange);
      return chart?.quote ? { ...chart.quote, estimated: chart.quote.date < date } : null;
    }
    const chart = await stockClosesAround(inst.symbol, exchange, date);
    const point = chart ? priceAsOf(chart.closes, date) : null;
    return point ? { ...point, estimated: point.date !== date } : null;
  }
  return null;
}

/** Latest price for one instrument (stocks: Yahoo; funds: mfapi — use refreshPrices for batches). */
export async function latestPrice(inst: PricedInstrument): Promise<PricePoint | null> {
  if (inst.kind === "mutual_fund" && inst.schemeCode) return (await fundLatest(inst.schemeCode))?.latest ?? null;
  if (inst.kind === "stock" && inst.symbol && inst.exchange) {
    return (await stockChart(inst.symbol, inst.exchange as Exchange))?.quote ?? null;
  }
  return null;
}

/**
 * Updates the saved price of the user's instruments (all users' when `userId` is null, for
 * the daily cron). AMFI's file covers every fund in one request; mfapi is the fallback.
 * A failed fetch keeps the last price. A newer typed (manual) price is never overwritten
 * by an older feed price.
 */
export async function refreshPrices(userId: string | null, { force = false } = {}) {
  const stale = new Date(Date.now() - REFRESH_THROTTLE_MS);
  const rows = await db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.isArchived, false),
        userId ? eq(instruments.userId, userId) : undefined,
        force ? undefined : or(isNull(instruments.priceCheckedAt), lt(instruments.priceCheckedAt, stale)),
      ),
    );
  if (rows.length === 0) return { checked: 0, updated: 0, failed: 0 };

  const amfi = rows.some((r) => r.kind === "mutual_fund") ? await fetchAmfiNavs() : null;
  let updated = 0;
  let failed = 0;

  for (const inst of rows) {
    let point: PricePoint | null = null;
    let source: "amfi" | "yahoo" = "yahoo";
    if (inst.kind === "mutual_fund" && inst.schemeCode) {
      const nav = amfi?.get(inst.schemeCode);
      if (nav) {
        point = nav;
        source = "amfi";
      } else {
        point = await latestPrice(inst);
        source = "amfi"; // mfapi republishes AMFI's NAVs
      }
    } else {
      point = await latestPrice(inst);
    }

    if (!point) {
      failed++;
      continue;
    }
    const newer = !inst.priceDate || point.date >= inst.priceDate;
    await db
      .update(instruments)
      .set(
        newer
          ? { lastPrice: formatPrice(point.price), priceDate: point.date, priceSource: source, priceCheckedAt: new Date() }
          : { priceCheckedAt: new Date() },
      )
      .where(eq(instruments.id, inst.id));
    if (newer) updated++;
  }
  return { checked: rows.length, updated, failed };
}

/** Saved price of an instrument row as scaled bigint. */
export const savedPrice = (inst: Pick<Instrument, "lastPrice">) => (inst.lastPrice ? parsePrice(inst.lastPrice) : null);
