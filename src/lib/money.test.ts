import { describe, expect, it } from "vitest";
import { formatINR, paiseToRupeesString, parseRupeesToPaise } from "./money";

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(12345600)).toBe("₹1,23,456");
    expect(formatINR(1000000000)).toBe("₹1,00,00,000");
  });

  it("shows paise only when present", () => {
    expect(formatINR(14950)).toBe("₹149.50");
    expect(formatINR(12345650)).toBe("₹1,23,456.50");
    expect(formatINR(14955)).toBe("₹149.55");
    expect(formatINR(0)).toBe("₹0");
  });

  it("handles negatives", () => {
    expect(formatINR(-25000)).toBe("-₹250");
    expect(formatINR(-205)).toBe("-₹2.05");
  });
});

describe("parseRupeesToPaise", () => {
  it.each([
    ["149.50", 14950],
    ["149.5", 14950],
    ["149.", 14900],
    ["0.75", 75],
    ["1,23,456", 12345600],
    ["₹ 99", 9900],
    ["  250 ", 25000],
  ])("%s → %d", (input, expected) => {
    expect(parseRupeesToPaise(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "-5", "1e3", ".5", "12.3.4"])("rejects %s", (input) => {
    expect(parseRupeesToPaise(input)).toBeNull();
  });

  it("avoids float rounding errors", () => {
    // 0.1 + 0.2 style bugs: 1.15 * 100 === 114.99999999999999 in floats
    expect(parseRupeesToPaise("1.15")).toBe(115);
    expect(parseRupeesToPaise("4.35")).toBe(435);
  });
});

describe("paiseToRupeesString", () => {
  it("round-trips with parse", () => {
    for (const paise of [0, 1, 75, 100, 115, 14950, 12345600]) {
      expect(parseRupeesToPaise(paiseToRupeesString(paise))).toBe(paise);
    }
  });

  it("formats negatives", () => {
    expect(paiseToRupeesString(-205)).toBe("-2.05");
  });
});
