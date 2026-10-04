import "server-only";
import { and, asc, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, categories, paymentMethods, transactions } from "@/server/db/schema";

type CategoryOption = { id: string; name: string; icon: string | null; color: string | null };

export type QuickAddOptions = {
  categories: CategoryOption[];
  paymentMethods: { id: string; name: string; kind: string; accountName: string }[];
  defaultPaymentMethodId: string | null;
  /** For add money / transfer forms. */
  accounts: { id: string; name: string; type: string }[];
  incomeCategories: CategoryOption[];
};

/**
 * Everything the quick-add and money sheets need, in one round of parallel queries:
 * active expense categories (most recently used first), active payment methods,
 * and the method used for the latest expense as the default.
 */
export async function getQuickAddOptions(userId: string): Promise<QuickAddOptions> {
  const lastUsed = db
    .select({ categoryId: transactions.categoryId, lastUsedAt: max(transactions.createdAt).as("last_used_at") })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense"), isNull(transactions.deletedAt)))
    .groupBy(transactions.categoryId)
    .as("last_used");

  const [categoryRows, methodRows, [latest], accountRows, incomeRows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, icon: categories.icon, color: categories.color })
      .from(categories)
      .leftJoin(lastUsed, eq(lastUsed.categoryId, categories.id))
      .where(and(eq(categories.userId, userId), eq(categories.kind, "expense"), eq(categories.isArchived, false)))
      .orderBy(sql`${lastUsed.lastUsedAt} desc nulls last`, asc(categories.sortOrder), asc(categories.createdAt)),
    db
      .select({
        id: paymentMethods.id,
        name: paymentMethods.name,
        kind: paymentMethods.kind,
        accountName: accounts.name,
      })
      .from(paymentMethods)
      .innerJoin(accounts, eq(accounts.id, paymentMethods.accountId))
      .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isArchived, false)))
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.createdAt)),
    db
      .select({ paymentMethodId: transactions.paymentMethodId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense"), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.createdAt))
      .limit(1),
    db
      .select({ id: accounts.id, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, false)))
      .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt)),
    db
      .select({ id: categories.id, name: categories.name, icon: categories.icon, color: categories.color })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.kind, "income"), eq(categories.isArchived, false)))
      .orderBy(asc(categories.sortOrder), asc(categories.createdAt)),
  ]);

  const lastMethod = latest?.paymentMethodId;
  const defaultPaymentMethodId = methodRows.some((m) => m.id === lastMethod)
    ? lastMethod!
    : (methodRows[0]?.id ?? null);

  return {
    categories: categoryRows,
    paymentMethods: methodRows,
    defaultPaymentMethodId,
    accounts: accountRows,
    incomeCategories: incomeRows,
  };
}
