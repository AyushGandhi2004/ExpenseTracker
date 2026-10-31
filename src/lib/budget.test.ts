import { describe, expect, it } from "vitest";
import { budgetProgress } from "./budget";

const nov = (today: string, spent: number, limit: number) => budgetProgress(spent, limit, today, "2026-11-01", "2026-11-30");

describe("budgetProgress", () => {
  it("is on track below 80%", () => {
    expect(nov("2026-11-15", 3_000_00, 10_000_00)).toMatchObject({ pct: 30, state: "ok", remainingPaise: 7_000_00, overPaise: 0 });
  });

  it("is close from 80% up to and including the limit", () => {
    expect(nov("2026-11-15", 7_999_00, 10_000_00).state).toBe("ok");
    expect(nov("2026-11-15", 8_000_00, 10_000_00).state).toBe("near");
    expect(nov("2026-11-15", 10_000_00, 10_000_00)).toMatchObject({ state: "near", pct: 100, remainingPaise: 0 });
  });

  it("is over past the limit, even by a paisa, without rounding to look fine", () => {
    expect(nov("2026-11-15", 10_000_01, 10_000_00)).toMatchObject({ state: "over", pct: 100, overPaise: 1, remainingPaise: 0 });
    expect(nov("2026-11-15", 15_000_00, 10_000_00)).toMatchObject({ pct: 150, overPaise: 5_000_00 });
    expect(nov("2026-11-15", 9_999_00, 10_000_00).pct).toBe(99);
  });

  it("tracks the month's pace and what's left per day", () => {
    expect(nov("2026-11-01", 0, 3_000_00)).toMatchObject({ pacePct: 3, daysLeft: 30, perDayPaise: 100_00 });
    expect(nov("2026-11-15", 0, 3_000_00)).toMatchObject({ pacePct: 50, daysLeft: 16 });
    expect(nov("2026-11-30", 2_000_00, 3_000_00)).toMatchObject({ pacePct: 100, daysLeft: 1, perDayPaise: 1_000_00 });
    expect(nov("2026-11-20", 0, 1_000_00).perDayPaise).toBe(90_00); // ₹90.90 rounds down to a rupee
  });
});
