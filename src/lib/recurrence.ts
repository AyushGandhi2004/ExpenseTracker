/**
 * Schedule maths for recurring payments. Pure functions over IST calendar dates ("YYYY-MM-DD").
 *
 * Occurrence n (0-based) is always computed from the start date — never from the previous
 * occurrence — so month-end schedules don't drift: 31 Jan monthly → 28 Feb, 31 Mar, 30 Apr.
 */

import { addDays, type IsoDate } from "@/lib/dates";

export type IntervalUnit = "day" | "month" | "year";
export type EndType = "never" | "on_date" | "after_count";

export type Schedule = {
  startDate: IsoDate;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** Monthly cycles: always the last day of the month, whatever the start date's day. */
  monthEnd?: boolean;
  endType: EndType;
  endDate: IsoDate | null;
  endCount: number | null;
};

export type Occurrence = { n: number; date: IsoDate };

/** Safety valve: never materialise more than this many payments in one run. */
export const MAX_OCCURRENCES_PER_RUN = 500;

const pad = (v: number) => String(v).padStart(2, "0");
const daysInMonth = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** The n-th payment date (n = 0 is the start date). */
export function occurrenceDate(s: Schedule, n: number): IsoDate {
  if (s.intervalUnit === "day") return addDays(s.startDate, n * s.intervalCount);
  const months = n * s.intervalCount * (s.intervalUnit === "year" ? 12 : 1);
  const [y, m, d] = s.startDate.split("-").map(Number);
  const total = (m - 1) + months;
  const year = y + Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  const last = daysInMonth(year, month0);
  const day = s.monthEnd && s.intervalUnit === "month" ? last : Math.min(d, last);
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

/** Whether occurrence n (falling on `date`) is inside the schedule's end. */
export function withinEnd(s: Schedule, n: number, date: IsoDate): boolean {
  if (s.endType === "after_count") return n < (s.endCount ?? 0);
  if (s.endType === "on_date") return date <= (s.endDate ?? "");
  return true;
}

/** Occurrence n if the schedule hasn't ended by then, else null. */
export function occurrenceAt(s: Schedule, n: number): Occurrence | null {
  const date = occurrenceDate(s, n);
  return withinEnd(s, n, date) ? { n, date } : null;
}

/** Occurrences from index `fromN` that are due on or before `upTo` (capped). */
export function dueOccurrences(s: Schedule, fromN: number, upTo: IsoDate, cap = MAX_OCCURRENCES_PER_RUN): Occurrence[] {
  const due: Occurrence[] = [];
  for (let n = fromN; due.length < cap; n++) {
    const occ = occurrenceAt(s, n);
    if (!occ || occ.date > upTo) break;
    due.push(occ);
  }
  return due;
}

/**
 * How many occurrences fall strictly before `day` (and inside the end). Used for the
 * "also record N past payments" prompt, and as the starting index when the user declines.
 */
export function countOccurrencesBefore(s: Schedule, day: IsoDate): number {
  let n = 0;
  while (n < 100_000) {
    const occ = occurrenceAt(s, n);
    if (!occ || occ.date >= day) break;
    n++;
  }
  return n;
}

/** The next `count` upcoming dates starting at index `fromN` (for previews). */
export function upcomingDates(s: Schedule, fromN: number, count: number): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let n = fromN; dates.length < count; n++) {
    const occ = occurrenceAt(s, n);
    if (!occ) break;
    dates.push(occ.date);
  }
  return dates;
}

/** Average cost per month in paise (30.44-day months for day-based cycles). */
export function monthlyEquivalent(amountPaise: number, unit: IntervalUnit, count: number): number {
  const perMonth =
    unit === "day" ? (amountPaise * 30.44) / count : unit === "month" ? amountPaise / count : amountPaise / (12 * count);
  return Math.round(perMonth);
}

/** "Every day", "Every 28 days", "Every month", "Every 3 months", "Every year", "Every 2 years". */
export function describeInterval(unit: IntervalUnit, count: number, monthEnd = false): string {
  if (monthEnd && unit === "month") return count === 1 ? "Last day of every month" : `Last day of every ${count} months`;
  return count === 1 ? `Every ${unit}` : `Every ${count} ${unit}s`;
}

/** Compact form for chips: "daily", "monthly", "yearly", "3 months", "28 days". */
export function shortInterval(unit: IntervalUnit, count: number): string {
  if (count === 1) return unit === "day" ? "daily" : `${unit}ly`;
  return `${count} ${unit}s`;
}
