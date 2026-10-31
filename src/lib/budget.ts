/** Monthly budget maths. Pure functions over paise and IST calendar dates. */

import { daysInRange, type IsoDate } from "@/lib/dates";

/** From this share of the limit, a budget counts as "close". */
export const NEAR_LIMIT_PCT = 80;

export type BudgetState = "ok" | "near" | "over";

export type BudgetProgress = {
  /** Share of the limit spent, rounded down so 99.9% never reads as 100%. May exceed 100. */
  pct: number;
  state: BudgetState;
  /** Left to spend; 0 once over. */
  remainingPaise: number;
  overPaise: number;
  /** Share of the month elapsed, including today. */
  pacePct: number;
  /** Days left in the month, including today. */
  daysLeft: number;
  /** What can be spent per remaining day, rounded down to a rupee. */
  perDayPaise: number;
};

export function budgetProgress(spentPaise: number, limitPaise: number, today: IsoDate, from: IsoDate, end: IsoDate): BudgetProgress {
  const pct = limitPaise > 0 ? Math.floor((spentPaise / limitPaise) * 100) : 0;
  const state: BudgetState = spentPaise > limitPaise ? "over" : pct >= NEAR_LIMIT_PCT ? "near" : "ok";
  const remainingPaise = Math.max(0, limitPaise - spentPaise);
  const total = daysInRange(from, end);
  const daysLeft = daysInRange(today, end);
  return {
    pct,
    state,
    remainingPaise,
    overPaise: Math.max(0, spentPaise - limitPaise),
    pacePct: Math.round(((total - daysLeft + 1) / total) * 100),
    daysLeft,
    perDayPaise: Math.floor(remainingPaise / daysLeft / 100) * 100,
  };
}
