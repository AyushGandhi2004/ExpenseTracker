import type { IntervalUnit } from "@/lib/recurrence";

export type RecurringTemplate = {
  name: string;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** Preferred category names, best match first. */
  categories: string[];
};

/** Quick picks for common fixed costs; they prefill name, cycle and category. */
export const RECURRING_TEMPLATES: RecurringTemplate[] = [
  { name: "Medical insurance", intervalUnit: "year", intervalCount: 1, categories: ["Health", "Bills"] },
  { name: "Wi-Fi", intervalUnit: "month", intervalCount: 3, categories: ["Bills"] },
  { name: "Rent", intervalUnit: "month", intervalCount: 1, categories: ["Rent", "Bills"] },
  { name: "Mobile recharge", intervalUnit: "day", intervalCount: 28, categories: ["Bills"] },
  { name: "OTT subscription", intervalUnit: "month", intervalCount: 1, categories: ["Entertainment", "Bills"] },
  { name: "Electricity", intervalUnit: "month", intervalCount: 1, categories: ["Bills"] },
  { name: "Gym", intervalUnit: "month", intervalCount: 1, categories: ["Health", "Other"] },
  { name: "Vehicle insurance", intervalUnit: "year", intervalCount: 1, categories: ["Transport", "Bills"] },
];

/** The first preferred category that exists (case-insensitive), else "Bills", "Other", or the first one. */
export function matchCategory<T extends { id: string; name: string }>(preferred: string[], categories: T[]): T | undefined {
  const byName = (n: string) => categories.find((c) => c.name.toLowerCase() === n.toLowerCase());
  for (const name of [...preferred, "Bills", "Other"]) {
    const found = byName(name);
    if (found) return found;
  }
  return categories[0];
}
