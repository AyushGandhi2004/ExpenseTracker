import "server-only";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { budgetProgress } from "@/lib/budget";
import { addMonths, endOfMonth, startOfMonth, todayIst } from "@/lib/dates";
import type { BudgetInput } from "@/lib/validators/budgets";
import { db } from "@/server/db";
import { budgets, categories, transactions } from "@/server/db/schema";
import { toUserError, UserError } from "@/server/errors";
import { assertCategory } from "./transactions";

/** Expense totals per category in a date range. Investing, transfers and income never count. */
async function spentByCategory(userId: string, from: string, to: string) {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      spent: sql<number>`coalesce(sum(${transactions.amountPaise}), 0)::bigint`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.type, "expense"),
        gte(transactions.txnDate, from),
        lte(transactions.txnDate, to),
      ),
    )
    .groupBy(transactions.categoryId);
  return new Map(rows.map((r) => [r.categoryId, r.spent]));
}

const total = (spent: Map<string | null, number>) => [...spent.values()].reduce((sum, v) => sum + v, 0);

/** Limits apply to every month; this reports them against the month containing `today`. */
export async function getBudgets(userId: string, today = todayIst()) {
  const from = startOfMonth(today);
  const end = endOfMonth(today);
  const lastFrom = addMonths(from, -1);
  const [rows, spent, lastSpent] = await Promise.all([
    db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        amountPaise: budgets.amountPaise,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(budgets)
      .leftJoin(categories, eq(categories.id, budgets.categoryId))
      .where(eq(budgets.userId, userId)),
    spentByCategory(userId, from, end),
    spentByCategory(userId, lastFrom, endOfMonth(lastFrom)),
  ]);

  const items = rows.map((r) => {
    const spentPaise = r.categoryId ? (spent.get(r.categoryId) ?? 0) : total(spent);
    return { ...r, spentPaise, progress: budgetProgress(spentPaise, r.amountPaise, today, from, end) };
  });
  const byCategory = items.filter((b) => b.categoryId).sort((a, b) => b.progress.pct - a.progress.pct);
  return {
    from,
    end,
    overall: items.find((b) => !b.categoryId) ?? null,
    byCategory,
    categoryLimitsPaise: byCategory.reduce((sum, b) => sum + b.amountPaise, 0),
    /** For suggesting a limit: what each category (and all spending, under "all") came to. */
    history: {
      thisMonth: { all: total(spent), ...Object.fromEntries([...spent].filter(([id]) => id)) } as Record<string, number>,
      lastMonth: { all: total(lastSpent), ...Object.fromEntries([...lastSpent].filter(([id]) => id)) } as Record<string, number>,
    },
  };
}
export type Budgets = Awaited<ReturnType<typeof getBudgets>>;
export type BudgetItem = Budgets["byCategory"][number];

export async function createBudget(userId: string, input: BudgetInput) {
  if (input.categoryId) await assertCategory(userId, input.categoryId, "expense");
  try {
    const [row] = await db.insert(budgets).values({ ...input, userId }).returning({ id: budgets.id });
    return row.id;
  } catch (error) {
    toUserError(error, { duplicate: "That already has a budget. Tap it to change the limit." });
  }
}

const owned = (userId: string, id: string) => and(eq(budgets.id, id), eq(budgets.userId, userId));

export async function updateBudget(userId: string, id: string, amountPaise: number) {
  const updated = await db.update(budgets).set({ amountPaise }).where(owned(userId, id)).returning({ id: budgets.id });
  if (updated.length === 0) throw new UserError("Budget not found.");
}

export async function deleteBudget(userId: string, id: string) {
  const deleted = await db.delete(budgets).where(owned(userId, id)).returning({ id: budgets.id });
  if (deleted.length === 0) throw new UserError("Budget not found.");
}
