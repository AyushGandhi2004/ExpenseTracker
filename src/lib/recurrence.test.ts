import { describe, expect, it } from "vitest";
import {
  countOccurrencesBefore,
  describeInterval,
  shortInterval,
  dueOccurrences,
  monthlyEquivalent,
  occurrenceDate,
  upcomingDates,
  type Schedule,
} from "./recurrence";

const schedule = (overrides: Partial<Schedule>): Schedule => ({
  startDate: "2026-01-15",
  intervalUnit: "month",
  intervalCount: 1,
  endType: "never",
  endDate: null,
  endCount: null,
  ...overrides,
});

describe("occurrenceDate", () => {
  it("steps whole months from the start", () => {
    const s = schedule({ intervalCount: 3 });
    expect([0, 1, 2, 3, 4].map((n) => occurrenceDate(s, n))).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
      "2026-10-15",
      "2027-01-15",
    ]);
  });

  it("clamps to month end without drifting (31 Jan monthly)", () => {
    const s = schedule({ startDate: "2026-01-31" });
    expect([0, 1, 2, 3].map((n) => occurrenceDate(s, n))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(occurrenceDate(schedule({ startDate: "2028-01-31" }), 1)).toBe("2028-02-29");
  });

  it("handles leap-day yearly schedules", () => {
    const s = schedule({ startDate: "2028-02-29", intervalUnit: "year" });
    expect([0, 1, 4].map((n) => occurrenceDate(s, n))).toEqual(["2028-02-29", "2029-02-28", "2032-02-29"]);
  });

  it("adds days for day cycles (mobile recharge every 28 days)", () => {
    const s = schedule({ startDate: "2026-10-01", intervalUnit: "day", intervalCount: 28 });
    expect([0, 1, 2].map((n) => occurrenceDate(s, n))).toEqual(["2026-10-01", "2026-10-29", "2026-11-26"]);
  });
});

describe("dueOccurrences", () => {
  it("returns everything due up to and including the day", () => {
    const s = schedule({ intervalCount: 3 });
    expect(dueOccurrences(s, 0, "2026-07-15")).toEqual([
      { n: 0, date: "2026-01-15" },
      { n: 1, date: "2026-04-15" },
      { n: 2, date: "2026-07-15" },
    ]);
    expect(dueOccurrences(s, 3, "2026-10-14")).toEqual([]);
  });

  it("stops after N payments", () => {
    const s = schedule({ endType: "after_count", endCount: 2 });
    expect(dueOccurrences(s, 0, "2027-01-01").map((o) => o.date)).toEqual(["2026-01-15", "2026-02-15"]);
  });

  it("stops at the end date (inclusive)", () => {
    const s = schedule({ endType: "on_date", endDate: "2026-03-15" });
    expect(dueOccurrences(s, 0, "2027-01-01").map((o) => o.date)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("is capped per run", () => {
    const daily = schedule({ startDate: "2020-01-01", intervalUnit: "day" });
    expect(dueOccurrences(daily, 0, "2026-01-01")).toHaveLength(500);
  });
});

describe("countOccurrencesBefore", () => {
  it("counts strictly past payments (insurance first paid in January)", () => {
    const s = schedule({ intervalCount: 1 }); // 15th monthly from Jan
    expect(countOccurrencesBefore(s, "2026-10-27")).toBe(10); // Jan..Oct 15
    expect(countOccurrencesBefore(s, "2026-10-15")).toBe(9); // today's isn't "past"
    expect(countOccurrencesBefore(s, "2026-01-15")).toBe(0);
  });

  it("respects the end", () => {
    const s = schedule({ endType: "after_count", endCount: 3 });
    expect(countOccurrencesBefore(s, "2027-01-01")).toBe(3);
  });
});

describe("upcomingDates", () => {
  it("previews the next dates from an index", () => {
    expect(upcomingDates(schedule({ intervalCount: 3 }), 4, 3)).toEqual(["2027-01-15", "2027-04-15", "2027-07-15"]);
  });

  it("stops at the end", () => {
    expect(upcomingDates(schedule({ endType: "after_count", endCount: 2 }), 1, 3)).toEqual(["2026-02-15"]);
  });
});

describe("monthlyEquivalent / describeInterval", () => {
  it("converts cycles to a monthly cost", () => {
    expect(monthlyEquivalent(1_20_000_00, "year", 1)).toBe(10_000_00);
    expect(monthlyEquivalent(1_500_00, "month", 3)).toBe(500_00);
    expect(monthlyEquivalent(299_00, "day", 28)).toBe(32_506); // 299 × 30.44 ÷ 28 = ₹325.06
  });

  it("describes cycles", () => {
    expect(describeInterval("month", 1)).toBe("Every month");
    expect(describeInterval("month", 3)).toBe("Every 3 months");
    expect(describeInterval("day", 28)).toBe("Every 28 days");
    expect(describeInterval("year", 1)).toBe("Every year");
  });
});

describe("shortInterval", () => {
  it("reads naturally on chips", () => {
    expect(shortInterval("year", 1)).toBe("yearly");
    expect(shortInterval("month", 1)).toBe("monthly");
    expect(shortInterval("day", 1)).toBe("daily");
    expect(shortInterval("month", 3)).toBe("3 months");
    expect(shortInterval("day", 28)).toBe("28 days");
  });
});
