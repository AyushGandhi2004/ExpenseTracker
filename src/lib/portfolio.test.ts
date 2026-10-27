import { describe, expect, it } from "vitest";
import {
  findOversell,
  formatBps,
  formatPrice,
  formatQuantity,
  holdingFrom,
  parseDecimalRounded,
  parsePrice,
  parseQuantity,
  portfolioSummary,
  priceFor,
  unitsFor,
  valuePaise,
  type Trade,
} from "./portfolio";

const q = (s: string) => parseQuantity(s)!;
const p = (s: string) => parsePrice(s)!;
const buy = (date: string, units: string, amountPaise: number): Trade => ({ type: "buy", date, quantity: q(units), amountPaise });
const sell = (date: string, units: string, amountPaise: number): Trade => ({ type: "sell", date, quantity: q(units), amountPaise });

describe("decimals", () => {
  it("parses and formats exactly", () => {
    expect(parseQuantity("33.594")).toBe(33_594_000n);
    expect(parsePrice("89.3")).toBe(893_000n);
    expect(formatQuantity(33_594_000n)).toBe("33.594");
    expect(formatPrice(893_000n)).toBe("89.30");
    expect(parseQuantity("1.1234567")).toBeNull(); // too precise
    expect(parseQuantity("abc")).toBeNull();
    expect(parsePrice("1,234.5")).toBe(12_345_000n);
  });

  it("rounds data-feed floats", () => {
    expect(parseDecimalRounded(2070.699951171875, 4)).toBe(20_707_000n);
    expect(parseDecimalRounded("89.30000", 4)).toBe(893_000n);
    expect(parseDecimalRounded("12.34565", 4)).toBe(123_457n);
  });
});

describe("value and units", () => {
  it("values holdings in paise without float error", () => {
    expect(valuePaise(q("33.594"), p("89.30"))).toBe(299_994); // ₹2,999.94
    expect(valuePaise(q("10"), p("2496.90"))).toBe(2_496_900);
  });

  it("allots MF units to 3 decimals", () => {
    expect(unitsFor(3_000_00, p("89.30"))).toBe(q("33.595")); // 3000 / 89.3 = 33.5946…
    expect(unitsFor(5_000_00, p("0"))).toBe(0n);
  });

  it("derives price from amount and quantity", () => {
    expect(priceFor(2_496_900, q("10"))).toBe(p("2496.90"));
  });
});

describe("holdingFrom (average cost)", () => {
  it("tracks a simple buy", () => {
    const h = holdingFrom([buy("2026-10-01", "10", 1_000_00)], p("120"));
    expect(h).toMatchObject({ quantity: q("10"), costPaise: 1_000_00, valuePaise: 1_200_00, unrealisedPaise: 200_00, unrealisedBps: 2000 });
    expect(formatPrice(h.averagePrice!)).toBe("100.00");
  });

  it("removes average cost on sells and books realised P&L", () => {
    const h = holdingFrom(
      [buy("2026-01-01", "10", 1_000_00), buy("2026-02-01", "10", 2_000_00), sell("2026-03-01", "5", 1_000_00)],
      p("160"),
    );
    // avg cost ₹150 → selling 5 removes ₹750; proceeds ₹1000 → realised +₹250
    expect(h.quantity).toBe(q("15"));
    expect(h.costPaise).toBe(2_250_00);
    expect(h.realisedPaise).toBe(250_00);
    expect(h.valuePaise).toBe(2_400_00);
    expect(h.unrealisedPaise).toBe(150_00);
  });

  it("selling everything leaves zero cost", () => {
    const h = holdingFrom([buy("2026-01-01", "3", 300_00), sell("2026-02-01", "3", 450_00)], p("200"));
    expect(h).toMatchObject({ quantity: 0n, costPaise: 0, realisedPaise: 150_00, valuePaise: 0, averagePrice: null, unrealisedBps: null });
  });

  it("works without a price", () => {
    expect(holdingFrom([buy("2026-01-01", "1", 100_00)], null)).toMatchObject({ valuePaise: null, unrealisedPaise: null });
  });

  it("orders by date regardless of input order (same-day buy before sell)", () => {
    const h = holdingFrom([sell("2026-01-01", "1", 120_00), buy("2026-01-01", "1", 100_00)], p("1"));
    expect(h.realisedPaise).toBe(20_00);
  });
});

describe("findOversell", () => {
  it("catches selling more than held at that date", () => {
    expect(findOversell([buy("2026-02-01", "5", 1), sell("2026-01-15", "1", 1)])).toMatchObject({ date: "2026-01-15", held: 0n });
    expect(findOversell([buy("2026-01-01", "5", 1), sell("2026-02-01", "5", 1)])).toBeNull();
  });
});

describe("portfolioSummary", () => {
  it("adds up value, cost and split by kind", () => {
    const s = portfolioSummary([
      { kind: "mutual_fund", holding: holdingFrom([buy("2026-01-01", "10", 1_000_00)], p("110")) },
      { kind: "stock", holding: holdingFrom([buy("2026-01-01", "2", 2_000_00)], p("900")) },
    ]);
    expect(s).toMatchObject({ valuePaise: 2_900_00, costPaise: 3_000_00, unrealisedPaise: -100_00, unrealisedBps: -333 });
    expect(s.byKind).toEqual({ mutual_fund: 1_100_00, stock: 1_800_00 });
  });

  it("formats basis points", () => {
    expect(formatBps(2000)).toBe("+20.00%");
    expect(formatBps(-333)).toBe("−3.33%");
    expect(formatBps(0)).toBe("0.00%");
  });
});
