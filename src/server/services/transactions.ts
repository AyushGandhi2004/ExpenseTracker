import "server-only";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { addDays, todayIst } from "@/lib/dates";
import type {
  ExpenseInput,
  ExpenseUpdate,
  IncomeInput,
  IncomeUpdate,
  TransactionFilters,
  TransferInput,
  TransferUpdate,
} from "@/lib/validators/transactions";
import { db } from "@/server/db";
import { accounts, categories, paymentMethods, transactions } from "@/server/db/schema";
import { UserError } from "@/server/errors";
import { getAccountBalance } from "./balances";

// ── Validation helpers ───────────────────────────────────────────────────────

function assertDateNotFuture(txnDate: string) {
  // Allow "tomorrow" in IST to absorb device clocks that are slightly ahead.
  if (txnDate > addDays(todayIst(), 1)) throw new UserError("The date can't be in the future.");
}

/** Archived items can't be newly chosen, but an edit may keep the one it already had. */
async function assertCategory(userId: string, id: string, kind: "expense" | "income", keepId?: string | null) {
  const [row] = await db
    .select({ kind: categories.kind, isArchived: categories.isArchived })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  if (!row || row.kind !== kind) throw new UserError(`Pick an ${kind} category.`);
  if (row.isArchived && id !== keepId) throw new UserError("That category was archived. Pick another one.");
}

async function getPaymentMethodAccount(userId: string, id: string, keepId?: string | null) {
  const [row] = await db
    .select({ accountId: paymentMethods.accountId, isArchived: paymentMethods.isArchived })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
  if (!row) throw new UserError("Pick how you paid.");
  if (row.isArchived && id !== keepId) throw new UserError("That payment method was archived. Pick another one.");
  return row.accountId;
}

async function assertAccount(userId: string, id: string, keepIds: (string | null | undefined)[] = []) {
  const [row] = await db
    .select({ isArchived: accounts.isArchived })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  if (!row) throw new UserError("Choose an account.");
  if (row.isArchived && !keepIds.includes(id)) throw new UserError("That account is archived. Choose another one.");
}

/** For idempotent creates: true if this id was already saved by this user. */
async function alreadySaved(userId: string, id: string): Promise<boolean> {
  const [existing] = await db
    .select({ userId: transactions.userId })
    .from(transactions)
    .where(eq(transactions.id, id));
  if (!existing) return false;
  if (existing.userId !== userId) throw new UserError("Couldn't save this transaction.");
  return true;
}

async function getOwnedTransaction(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  if (!row) throw new UserError("Transaction not found.");
  return row;
}

async function getEditableTransaction(userId: string, id: string, type: "expense" | "income" | "transfer") {
  const row = await getOwnedTransaction(userId, id);
  if (row.deletedAt) throw new UserError("This transaction was deleted.");
  if (row.type !== type) throw new UserError("This transaction can't be edited here.");
  return row;
}

const ownedWhere = (userId: string, id: string) => and(eq(transactions.id, id), eq(transactions.userId, userId));

// ── Expenses ─────────────────────────────────────────────────────────────────

/**
 * Records an expense. Idempotent on `input.id`: retrying the same entry (offline queue,
 * double tap, flaky network) returns success without inserting a second row.
 */
export async function createExpense(userId: string, input: ExpenseInput): Promise<void> {
  assertDateNotFuture(input.txnDate);
  if (await alreadySaved(userId, input.id)) return;
  await assertCategory(userId, input.categoryId, "expense");
  const accountId = await getPaymentMethodAccount(userId, input.paymentMethodId);

  await db
    .insert(transactions)
    .values({
      id: input.id,
      userId,
      type: "expense",
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      description: input.description,
      source: "manual",
    })
    // A concurrent retry of the same id may win the race; that's still a success.
    .onConflictDoNothing({ target: transactions.id });
}

export async function updateExpense(userId: string, id: string, input: ExpenseUpdate): Promise<void> {
  const current = await getEditableTransaction(userId, id, "expense");
  assertDateNotFuture(input.txnDate);
  await assertCategory(userId, input.categoryId, "expense", current.categoryId);
  const accountId = await getPaymentMethodAccount(userId, input.paymentMethodId, current.paymentMethodId);

  await db
    .update(transactions)
    .set({
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId,
      categoryId: input.categoryId,
      paymentMethodId: input.paymentMethodId,
      description: input.description,
    })
    .where(ownedWhere(userId, id));
}

// ── Income (add money) ───────────────────────────────────────────────────────

export async function createIncome(userId: string, input: IncomeInput): Promise<void> {
  assertDateNotFuture(input.txnDate);
  if (await alreadySaved(userId, input.id)) return;
  await assertAccount(userId, input.accountId);
  await assertCategory(userId, input.categoryId, "income");

  await db
    .insert(transactions)
    .values({
      id: input.id,
      userId,
      type: "income",
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId: input.accountId,
      categoryId: input.categoryId,
      description: input.description,
    })
    .onConflictDoNothing({ target: transactions.id });
}

export async function updateIncome(userId: string, id: string, input: IncomeUpdate): Promise<void> {
  const current = await getEditableTransaction(userId, id, "income");
  assertDateNotFuture(input.txnDate);
  await assertAccount(userId, input.accountId, [current.accountId]);
  await assertCategory(userId, input.categoryId, "income", current.categoryId);

  await db
    .update(transactions)
    .set({
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId: input.accountId,
      categoryId: input.categoryId,
      description: input.description,
    })
    .where(ownedWhere(userId, id));
}

// ── Transfers ────────────────────────────────────────────────────────────────

export async function createTransfer(userId: string, input: TransferInput): Promise<void> {
  assertDateNotFuture(input.txnDate);
  if (await alreadySaved(userId, input.id)) return;
  await assertAccount(userId, input.fromAccountId);
  await assertAccount(userId, input.toAccountId);

  await db
    .insert(transactions)
    .values({
      id: input.id,
      userId,
      type: "transfer",
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      description: input.description,
    })
    .onConflictDoNothing({ target: transactions.id });
}

export async function updateTransfer(userId: string, id: string, input: TransferUpdate): Promise<void> {
  const current = await getEditableTransaction(userId, id, "transfer");
  assertDateNotFuture(input.txnDate);
  const keep = [current.accountId, current.toAccountId];
  await assertAccount(userId, input.fromAccountId, keep);
  await assertAccount(userId, input.toAccountId, keep);

  await db
    .update(transactions)
    .set({
      amountPaise: input.amountPaise,
      txnDate: input.txnDate,
      accountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      description: input.description,
    })
    .where(ownedWhere(userId, id));
}

// ── Reconcile ────────────────────────────────────────────────────────────────

/**
 * Records the difference between the app's balance and the real one as an adjustment
 * dated today, so history stays honest. Returns the difference (0 = already matched).
 */
export async function reconcileAccount(
  userId: string,
  input: { id: string; accountId: string; actualBalancePaise: number },
): Promise<number> {
  if (await alreadySaved(userId, input.id)) return 0;
  await assertAccount(userId, input.accountId);
  const appBalance = await getAccountBalance(userId, input.accountId);
  const difference = input.actualBalancePaise - appBalance;
  if (difference === 0) return 0;

  await db
    .insert(transactions)
    .values({
      id: input.id,
      userId,
      type: "adjustment",
      amountPaise: difference,
      txnDate: todayIst(),
      accountId: input.accountId,
      description: "Balance adjustment",
    })
    .onConflictDoNothing({ target: transactions.id });
  return difference;
}

// ── Delete / restore ─────────────────────────────────────────────────────────

export async function softDeleteTransaction(userId: string, id: string): Promise<void> {
  await getOwnedTransaction(userId, id);
  await db.update(transactions).set({ deletedAt: new Date() }).where(ownedWhere(userId, id));
}

export async function restoreTransaction(userId: string, id: string): Promise<void> {
  await getOwnedTransaction(userId, id);
  await db.update(transactions).set({ deletedAt: null }).where(ownedWhere(userId, id));
}

// ── Reading ──────────────────────────────────────────────────────────────────

const toAccounts = alias(accounts, "to_accounts");

function filterConditions(userId: string, f: TransactionFilters): SQL[] {
  const conditions: SQL[] = [eq(transactions.userId, userId), isNull(transactions.deletedAt)];
  if (f.type) conditions.push(eq(transactions.type, f.type));
  if (f.category) conditions.push(eq(transactions.categoryId, f.category));
  if (f.method) conditions.push(eq(transactions.paymentMethodId, f.method));
  if (f.account) conditions.push(or(eq(transactions.accountId, f.account), eq(transactions.toAccountId, f.account))!);
  if (f.from) conditions.push(gte(transactions.txnDate, f.from));
  if (f.to) conditions.push(lte(transactions.txnDate, f.to));
  if (f.q) {
    const pattern = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(transactions.description, pattern), ilike(categories.name, pattern))!);
  }
  return conditions;
}

/** Joined columns every list/row needs. */
const listColumns = {
  id: transactions.id,
  type: transactions.type,
  amountPaise: transactions.amountPaise,
  txnDate: transactions.txnDate,
  description: transactions.description,
  createdAt: transactions.createdAt,
  categoryId: transactions.categoryId,
  categoryName: categories.name,
  categoryIcon: categories.icon,
  categoryColor: categories.color,
  paymentMethodId: transactions.paymentMethodId,
  paymentMethodName: paymentMethods.name,
  paymentMethodKind: paymentMethods.kind,
  accountId: transactions.accountId,
  accountName: accounts.name,
  toAccountId: transactions.toAccountId,
  toAccountName: toAccounts.name,
};

function listQuery() {
  return db
    .select(listColumns)
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(toAccounts, eq(toAccounts.id, transactions.toAccountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, transactions.paymentMethodId));
}

export const DEFAULT_PAGE_SIZE = 50;

/** Filtered transactions (newest first) plus per-day and overall totals for those filters. */
export async function listTransactions(userId: string, filters: TransactionFilters) {
  const limit = filters.limit ?? DEFAULT_PAGE_SIZE;
  const where = and(...filterConditions(userId, filters));

  const spent = sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountPaise} end), 0)::bigint`.mapWith(Number);
  const received = sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountPaise} end), 0)::bigint`.mapWith(Number);

  const [rows, [summary]] = await Promise.all([
    listQuery()
      .where(where)
      .orderBy(desc(transactions.txnDate), desc(transactions.createdAt), desc(transactions.id))
      .limit(limit + 1),
    db
      .select({ count: sql<number>`count(*)::int`, spent, received })
      .from(transactions)
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .where(where),
  ]);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const dates = [...new Set(items.map((i) => i.txnDate))];

  const dayTotals = dates.length
    ? await db
        .select({ txnDate: transactions.txnDate, spent, received })
        .from(transactions)
        .leftJoin(categories, eq(categories.id, transactions.categoryId))
        .where(and(where, inArray(transactions.txnDate, dates)))
        .groupBy(transactions.txnDate)
    : [];

  return { items, hasMore, limit, summary, dayTotals };
}

/** Latest transactions for the home screen. */
export async function listRecentTransactions(userId: string, limit = 10) {
  return listQuery()
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
    .limit(limit);
}
export type TransactionListItem = Awaited<ReturnType<typeof listRecentTransactions>>[number];
