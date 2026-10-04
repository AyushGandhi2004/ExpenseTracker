import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { addDays, todayIst } from "@/lib/dates";
import type { ExpenseInput } from "@/lib/validators/transactions";
import { db } from "@/server/db";
import { categories, paymentMethods, transactions } from "@/server/db/schema";
import { UserError } from "@/server/errors";

/**
 * Records an expense. Idempotent on `input.id`: retrying the same entry (offline queue,
 * double tap, flaky network) returns success without inserting a second row.
 */
export async function createExpense(userId: string, input: ExpenseInput): Promise<void> {
  // Allow "tomorrow" in IST to absorb device clocks that are slightly ahead.
  if (input.txnDate > addDays(todayIst(), 1)) throw new UserError("The date can't be in the future.");

  const [existing] = await db
    .select({ userId: transactions.userId })
    .from(transactions)
    .where(eq(transactions.id, input.id));
  if (existing) {
    if (existing.userId !== userId) throw new UserError("Couldn't save this expense.");
    return;
  }

  const [category] = await db
    .select({ kind: categories.kind, isArchived: categories.isArchived })
    .from(categories)
    .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId)));
  if (!category || category.kind !== "expense") throw new UserError("Pick an expense category.");
  if (category.isArchived) throw new UserError("That category was archived. Pick another one.");

  const [method] = await db
    .select({ accountId: paymentMethods.accountId, isArchived: paymentMethods.isArchived })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, input.paymentMethodId), eq(paymentMethods.userId, userId)));
  if (!method) throw new UserError("Pick how you paid.");
  if (method.isArchived) throw new UserError("That payment method was archived. Pick another one.");

  await db
    .insert(transactions)
    .values({
      id: input.id,
      userId,
      type: "expense",
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId: method.accountId,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      description: input.description,
      source: "manual",
    })
    // A concurrent retry of the same id may win the race; that's still a success.
    .onConflictDoNothing({ target: transactions.id });
}

/** Latest transactions for the home screen. */
export async function listRecentTransactions(userId: string, limit = 10) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amountPaise: transactions.amountPaise,
      txnDate: transactions.txnDate,
      description: transactions.description,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      paymentMethodName: paymentMethods.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId))
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
    .limit(limit);
}
export type RecentTransaction = Awaited<ReturnType<typeof listRecentTransactions>>[number];
