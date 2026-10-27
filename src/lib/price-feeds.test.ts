import { describe, expect, it } from "vitest";
import { parsePrice } from "./portfolio";
import {
  istDateOf,
  parseAmfiDate,
  parseAmfiNavAll,
  parseFundHistory,
  parseFundSearch,
  parseYahooChart,
  parseYahooSearch,
  priceAsOf,
  priceOn,
  yahooSymbol,
} from "./price-feeds";

const p = (s: string) => parsePrice(s)!;

const NAV_ALL = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  " ",
  "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)",
  " ",
  "PPFAS Mutual Fund",
  " ",
  "122639;INF879O01027;-;Parag Parikh Flexi Cap Fund;Direct Plan;Growth;89.3000;26-Oct-2026\r",
  "108844;INF194K01623;INF194K01631;BANDHAN Arbitrage Fund;;;14.86269632;17-Feb-2017",
  "999999;-;-;Wound Up Fund;Direct Plan;Growth;N.A.;26-Oct-2026",
].join("\n");

describe("AMFI", () => {
  it("parses dates", () => {
    expect(parseAmfiDate("26-Oct-2026")).toBe("2026-10-26");
    expect(parseAmfiDate("5-Jan-2026")).toBe("2026-01-05");
    expect(parseAmfiDate("garbage")).toBeNull();
  });

  it("parses scheme lines and skips headers / missing NAVs", () => {
    const navs = parseAmfiNavAll(NAV_ALL);
    expect([...navs.keys()]).toEqual(["122639", "108844"]);
    expect(navs.get("122639")).toEqual({
      schemeCode: "122639",
      isin: "INF879O01027",
      name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
      price: p("89.30"),
      date: "2026-10-26",
    });
    expect(navs.get("108844")).toMatchObject({ price: p("14.8627"), name: "BANDHAN Arbitrage Fund" });
  });
});

describe("mfapi", () => {
  it("parses search results", () => {
    expect(parseFundSearch([{ schemeCode: 122639, schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" }, { bad: 1 }])).toEqual([
      { schemeCode: "122639", name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" },
    ]);
    expect(parseFundSearch({ error: "x" })).toEqual([]);
  });

  it("parses history oldest-first and finds the NAV for a trade date", () => {
    const h = parseFundHistory({
      meta: { scheme_name: "PPFAS Flexi", isin_growth: "INF879O01027" },
      data: [
        { date: "06-10-2026", nav: "88.10000" },
        { date: "03-10-2026", nav: "87.50000" },
        { date: "01-10-2026", nav: "87.00000" },
      ],
    })!;
    expect(h.navs.map((n) => n.date)).toEqual(["2026-10-01", "2026-10-03", "2026-10-06"]);
    expect(priceOn(h.navs, "2026-10-03")?.price).toBe(p("87.50"));
    // Sunday 5 Oct → next published NAV (Monday 6 Oct)
    expect(priceOn(h.navs, "2026-10-05")).toEqual({ date: "2026-10-06", price: p("88.10") });
    expect(priceOn(h.navs, "2026-10-07")).toBeNull();
    expect(priceAsOf(h.navs, "2026-10-05")?.date).toBe("2026-10-03");
    expect(parseFundHistory({ status: "FAIL" })).toBeNull();
  });
});

describe("Yahoo", () => {
  it("builds symbols and IST dates", () => {
    expect(yahooSymbol("TCS", "NSE")).toBe("TCS.NS");
    expect(yahooSymbol("TCS", "BSE")).toBe("TCS.BO");
    expect(istDateOf(1759203900)).toBe("2025-09-30"); // 09:15 IST
    expect(istDateOf(Date.UTC(2026, 9, 26, 19, 0) / 1000)).toBe("2026-10-27"); // 00:30 IST next day
  });

  it("parses a chart with rounding and gaps", () => {
    const chart = parseYahooChart({
      chart: {
        result: [
          {
            meta: { currency: "INR", regularMarketPrice: 2496.89990234375, regularMarketTime: 1793095093, longName: "Tata Consultancy Services Limited" },
            timestamp: [1759203900, 1759290300, 1759463100],
            indicators: { quote: [{ close: [2888.39990234375, null, 2901.89990234375] }] },
          },
        ],
      },
    })!;
    expect(chart.name).toBe("Tata Consultancy Services Limited");
    expect(chart.quote?.price).toBe(p("2496.90"));
    expect(chart.closes).toEqual([
      { date: "2025-09-30", price: p("2888.40") },
      { date: "2025-10-03", price: p("2901.90") },
    ]);
    expect(parseYahooChart({ chart: { result: [{ meta: { currency: "USD", regularMarketPrice: 1 } }] } })).toBeNull();
    expect(parseYahooChart({ chart: { result: null, error: { code: "Not Found" } } })).toBeNull();
  });

  it("keeps only Indian equities in search", () => {
    expect(
      parseYahooSearch({
        quotes: [
          { symbol: "TMCV.NS", shortname: "TATA MOTORS LIMITED", quoteType: "EQUITY" },
          { symbol: "TMCV.BO", longname: "Tata Motors Limited", quoteType: "EQUITY" },
          { symbol: "TTM", shortname: "Tata Motors ADR", quoteType: "EQUITY" },
          { symbol: "^NSEI", quoteType: "INDEX" },
        ],
      }),
    ).toEqual([
      { symbol: "TMCV", exchange: "NSE", name: "TATA MOTORS LIMITED" },
      { symbol: "TMCV", exchange: "BSE", name: "Tata Motors Limited" },
    ]);
  });
});
