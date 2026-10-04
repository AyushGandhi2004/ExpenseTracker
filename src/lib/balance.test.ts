import { describe, expect, it } from "vitest";
import { balanceFromSums, ledgerEffect, reconcileDifference } from "./balance";

describe("ledgerEffect", () => {
  it("applies each type on the source account", () => {
    expect(ledgerEffect("expense", true, 500)).toBe(-500);
    expect(ledgerEffect("income", true, 500)).toBe(500);
    expect(ledgerEffect("transfer", true, 500)).toBe(-500);
    expect(ledgerEffect("adjustment", true, 250)).toBe(250);
    expect(ledgerEffect("adjustment", true, -250)).toBe(-250);
  });

  it("only transfers affect the destination side", () => {
    expect(ledgerEffect("transfer", false, 500)).toBe(500);
    expect(ledgerEffect("expense", false, 500)).toBe(0);
  });
});

describe("balanceFromSums", () => {
  it("starts from the opening balance", () => {
    expect(balanceFromSums(1_000_00, [])).toBe(1_000_00);
  });

  it("combines all movements (bank sends ₹2,000 to cash, spends, gets salary, is adjusted)", () => {
    const bank = balanceFromSums(50_000_00, [
      { type: "expense", isSource: true, totalPaise: 1_250_50 },
      { type: "income", isSource: true, totalPaise: 30_000_00 },
      { type: "transfer", isSource: true, totalPaise: 2_000_00 },
      { type: "adjustment", isSource: true, totalPaise: -49_50 },
    ]);
    expect(bank).toBe(50_000_00 - 1_250_50 + 30_000_00 - 2_000_00 - 49_50);

    const cash = balanceFromSums(0, [
      { type: "transfer", isSource: false, totalPaise: 2_000_00 },
      { type: "expense", isSource: true, totalPaise: 300_00 },
    ]);
    expect(cash).toBe(1_700_00);
  });
});

describe("reconcileDifference", () => {
  it("is what must be added to reach the real balance", () => {
    expect(reconcileDifference(12_400_00, 12_150_00)).toBe(-250_00);
    expect(reconcileDifference(100_00, 150_00)).toBe(50_00);
    expect(reconcileDifference(100_00, 100_00)).toBe(0);
  });
});
