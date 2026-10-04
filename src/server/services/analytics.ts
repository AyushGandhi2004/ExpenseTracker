import "server-only";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { DashboardPeriod } from "@/lib/dates";
import { db } from "@/server/db";
import { categories, paymentMethods, transactions } from "@/server/db/schema";
import { getAccountBalances } from "./balances";
import { listTopExpenses } from "./transactions";

const sumPaise = (condition?: ReturnType<typeof sql>) =>
  (condition
    ? sql<number>`coalesce(sum(case when ${condition} then ${transactions.amountPaise} end), 0)::bigint`
    : sql<number>`coalesce(sum(${transactions.amountPaise}), 0)::bigint`
  ).mapWith(Number);

function live(userId: string, from: string, to: string) {
  return and(
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    gte(transactions.txnDate, from),
    lte(transactions.txnDate, to),
  );
}

const isExpense = eq(transactions.type, "expense");

/** Everything the dashboard shows for one period, fetched in parallel. */
export async function getDashboard(userId: string, period: DashboardPeriod) {
  const inPeriod = live(userId, period.from, period.to);

  const [[totals], [compare], daily, byCategory, byMethod, topExpenses, balances] = await Promise.all([
    db
      .select({
        spent: sumPaise(sql`${transactions.type} = 'expense'`),
        received: sumPaise(sql`${transactions.type} = 'income'`),
        expenseCount: sql<number>`count(*) filter (where ${transactions.type} = 'expense')::int`,
      })
      .from(transactions)
      .where(inPeriod),
    db
      .select({ spent: sumPaise() })
      .from(transactions)
      .where(and(live(userId, period.compare.from, period.compare.to), isExpense)),
    db
      .select({ date: transactions.txnDate, spent: sumPaise() })
      .from(transactions)
      .where(and(inPeriod, isExpense))
      .groupBy(transactions.txnDate),
    db
      .select({
        id: categories.id,
        name: categories.name,
        icon: categories.icon,
        color: categories.color,
        spent: sumPaise(),
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(and(inPeriod, isExpense))
      .groupBy(categories.id)
      .orderBy(desc(sql`sum(${transactions.amountPaise})`)),
    db
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        kind: paymentMethods.kind,
        spent: sumPaise(),
        count: sql<number>`count(*)::int`,
      })
      .from(transactions)
      .innerJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
      .where(and(inPeriod, isExpense))
      .groupBy(paymentMethods.id)
      .orderBy(desc(sql`sum(${transactions.amountPaise})`)),
    listTopExpenses(userId, period.from, period.to, 5),
    getAccountBalances(userId),
  ]);

  return {
    spent: totals.spent,
    received: totals.received,
    expenseCount: totals.expenseCount,
    compareSpent: compare.spent,
    daily: new Map(daily.map((d) => [d.date, d.spent])),
    byCategory,
    byMethod,
    topExpenses,
    totalBalance: balances.filter((a) => !a.isArchived).reduce((sum, a) => sum + a.balancePaise, 0),
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
