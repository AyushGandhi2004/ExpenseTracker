/**
 * IST date helpers. Transaction days are stored as "YYYY-MM-DD" strings (Postgres `date`)
 * representing the calendar day in Asia/Kolkata, regardless of server or device timezone.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";

/** "YYYY-MM-DD" */
export type IsoDate = string;

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The IST calendar day of an instant. */
export function toIstDate(instant: Date = new Date()): IsoDate {
  return isoDayFormatter.format(instant);
}

export function todayIst(): IsoDate {
  return toIstDate(new Date());
}

// Date-only arithmetic is done in UTC so it is independent of the machine's timezone.
function parse(d: IsoDate): Date {
  return new Date(`${d}T00:00:00Z`);
}
function format(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, days: number): IsoDate {
  const date = parse(d);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

export function startOfMonth(d: IsoDate): IsoDate {
  return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: IsoDate): IsoDate {
  const date = parse(startOfMonth(d));
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return format(date);
}

export function addMonths(d: IsoDate, months: number): IsoDate {
  const date = parse(startOfMonth(d));
  date.setUTCMonth(date.getUTCMonth() + months);
  return format(date);
}

/** Monday-based week start. */
export function startOfWeek(d: IsoDate): IsoDate {
  const dow = parse(d).getUTCDay(); // 0 = Sunday
  return addDays(d, -((dow + 6) % 7));
}

/** Inclusive day count between two dates. */
export function daysInRange(from: IsoDate, to: IsoDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000) + 1;
}

export type DateRange = { from: IsoDate; to: IsoDate };
export type RangePreset = "this-week" | "this-month" | "last-month";

export function presetRange(preset: RangePreset, today: IsoDate = todayIst()): DateRange {
  switch (preset) {
    case "this-week":
      return { from: startOfWeek(today), to: today };
    case "this-month":
      return { from: startOfMonth(today), to: today };
    case "last-month": {
      const from = addMonths(today, -1);
      return { from, to: endOfMonth(from) };
    }
  }
}

const dayLabelFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Today", "Yesterday", or e.g. "Mon, 29 Sept". */
export function formatDayLabel(d: IsoDate, today: IsoDate = todayIst()): string {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  return dayLabelFormatter.format(parse(d));
}

/**
 * Calendar weeks (Monday first) for the month containing `d`.
 * Days outside the month are null so the grid lines up.
 */
export function monthGrid(d: IsoDate): (IsoDate | null)[][] {
  const first = startOfMonth(d);
  const last = endOfMonth(d);
  const leading = daysInRange(startOfWeek(first), first) - 1;
  const cells: (IsoDate | null)[] = Array.from({ length: leading }, () => null);
  for (let day = first; day <= last; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (IsoDate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const monthLabelFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });

/** "October 2026" */
export function formatMonthLabel(d: IsoDate): string {
  return monthLabelFormatter.format(parse(startOfMonth(d)));
}

const shortDayFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });

/** Compact label for tight spaces: "23 Sept". */
export function formatShortDay(d: IsoDate): string {
  return shortDayFormatter.format(parse(d));
}
