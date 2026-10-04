import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dashboardPeriod,
  eachDay,
  daysInRange,
  endOfMonth,
  formatDayLabel,
  formatMonthLabel,
  formatRangeLabel,
  formatShortDay,
  formatShortMonthLabel,
  monthGrid,
  presetRange,
  startOfWeek,
  toIstDate,
} from "./dates";

describe("toIstDate", () => {
  it("rolls over at IST midnight, not UTC midnight", () => {
    // 23:30 IST on 30 Sep = 18:00 UTC on 30 Sep
    expect(toIstDate(new Date("2026-09-30T18:00:00Z"))).toBe("2026-09-30");
    // 00:30 IST on 1 Oct = 19:00 UTC on 30 Sep
    expect(toIstDate(new Date("2026-09-30T19:00:00Z"))).toBe("2026-10-01");
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("finds month ends including leap years", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2026-12-31")).toBe("2026-12-31");
  });

  it("adds months from the month start (no 31st overflow)", () => {
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-09-30")).toBe("2026-09-28"); // Wed → Mon
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28"); // Sun → Mon
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
  });

  it("counts days inclusively", () => {
    expect(daysInRange("2026-09-01", "2026-09-30")).toBe(30);
    expect(daysInRange("2026-09-30", "2026-09-30")).toBe(1);
  });
});

describe("presetRange", () => {
  const today = "2026-09-30";
  it("this-month runs from the 1st to today", () => {
    expect(presetRange("this-month", today)).toEqual({ from: "2026-09-01", to: today });
  });
  it("last-month covers the whole previous month", () => {
    expect(presetRange("last-month", today)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });
  it("this-week starts Monday", () => {
    expect(presetRange("this-week", today)).toEqual({ from: "2026-09-28", to: today });
  });
});

describe("formatDayLabel", () => {
  it("uses relative labels for recent days", () => {
    expect(formatDayLabel("2026-09-30", "2026-09-30")).toBe("Today");
    expect(formatDayLabel("2026-09-29", "2026-09-30")).toBe("Yesterday");
  });
  it("formats older days", () => {
    expect(formatDayLabel("2026-09-28", "2026-09-30")).toMatch(/Mon.*28.*Sep/);
  });
});

describe("monthGrid", () => {
  it("lays out October 2026 starting on Thursday (Monday-first weeks)", () => {
    const weeks = monthGrid("2026-10-15");
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks.at(-1)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("handles a month starting on Monday with no leading blanks", () => {
    expect(monthGrid("2026-06-10")[0][0]).toBe("2026-06-01");
  });

  it("formats month labels", () => {
    expect(formatMonthLabel("2026-10-15")).toBe("October 2026");
  });
});

describe("formatShortDay", () => {
  it("shows day and month", () => {
    expect(formatShortDay("2026-09-23")).toMatch(/^23 Sep/);
  });
});

describe("dashboardPeriod", () => {
  const today = "2026-10-04";

  it("current month stops at today and compares with the same days last month", () => {
    const p = dashboardPeriod("month", today, today);
    expect(p).toMatchObject({ from: "2026-10-01", to: today, end: "2026-10-31", isCurrent: true });
    expect(p.compare).toEqual({ from: "2026-09-01", to: "2026-09-04" });
    expect(p.prevAnchor).toBe("2026-09-01");
    expect(p.nextAnchor).toBeNull();
  });

  it("a past month runs to its end and compares with the whole previous month (Sep vs all of Aug)", () => {
    const p = dashboardPeriod("month", "2026-09-15", today);
    expect(p).toMatchObject({ from: "2026-09-01", to: "2026-09-30", isCurrent: false });
    expect(p.compare).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(p.nextAnchor).toBe("2026-10-01");
  });

  it("caps the comparison at the previous period's end (Mar 31 vs Feb)", () => {
    const p = dashboardPeriod("month", "2026-03-10", "2026-04-02");
    expect(p.compare).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("weeks run Monday to Sunday", () => {
    const p = dashboardPeriod("week", today, today);
    expect(p).toMatchObject({ from: "2026-09-28", to: today, end: "2026-10-04" });
    expect(p.compare).toEqual({ from: "2026-09-21", to: "2026-09-27" });
  });
});

describe("eachDay", () => {
  it("lists days inclusively across months", () => {
    expect(eachDay("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("formatRangeLabel", () => {
  it("compacts ranges within a month", () => {
    expect(formatRangeLabel("2026-09-01", "2026-09-04")).toMatch(/^1–4 Sep/);
  });
  it("spells out both ends across months", () => {
    expect(formatRangeLabel("2026-09-28", "2026-10-04")).toMatch(/^28 Sep.* – 4 Oct$/);
  });
  it("handles a single day", () => {
    expect(formatRangeLabel("2026-10-04", "2026-10-04")).toBe("4 Oct");
  });
});

describe("formatShortMonthLabel", () => {
  it("abbreviates the month", () => {
    expect(formatShortMonthLabel("2026-09-15")).toMatch(/^Sep.* 2026$/);
  });
});
