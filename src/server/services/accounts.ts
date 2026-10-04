import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { moveId } from "@/lib/reorder";
import type { AccountInput } from "@/lib/validators/settings";
import { db } from "@/server/db";
import { accounts, paymentMethods, transactions } from "@/server/db/schema";
import { toUserError, UserError } from "@/server/errors";

const DUPLICATE = "You already have an account with this name.";

export async function listAccounts(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.isArchived), asc(accounts.sortOrder), asc(accounts.createdAt));
}

async function getOwnedAccount(userId: string, id: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  if (!account) throw new UserError("Account not found.");
  return account;
}

export async function createAccount(userId: string, input: AccountInput) {
  try {
    const [created] = await db
      .insert(accounts)
      .values({
        userId,
        ...input,
        sortOrder: sql`(select coalesce(max(${accounts.sortOrder}), -1) + 1 from ${accounts} where ${accounts.userId} = ${userId})`,
      })
      .returning();
    return created;
  } catch (error) {
    toUserError(error, { duplicate: DUPLICATE });
  }
}

export async function updateAccount(userId: string, id: string, input: AccountInput) {
  await getOwnedAccount(userId, id);
  try {
    await db
      .update(accounts)
      .set(input)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  } catch (error) {
    toUserError(error, { duplicate: DUPLICATE });
  }
}

/** Archiving hides the account from pickers; its payment methods are archived with it. */
export async function setAccountArchived(userId: string, id: string, archived: boolean) {
  await getOwnedAccount(userId, id);
  await db.transaction(async (tx) => {
    await tx
      .update(accounts)
      .set({ isArchived: archived })
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    if (archived) {
      await tx
        .update(paymentMethods)
        .set({ isArchived: true })
        .where(and(eq(paymentMethods.accountId, id), eq(paymentMethods.userId, userId)));
    }
  });
}

/** Only accounts with no transactions can be deleted (their unused payment methods go too). */
export async function deleteAccount(userId: string, id: string) {
  await getOwnedAccount(userId, id);
  const [used] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`(${transactions.accountId} = ${id} or ${transactions.toAccountId} = ${id})`,
      ),
    )
    .limit(1);
  if (used) throw new UserError("This account has transactions. Archive it instead.");

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(paymentMethods)
        .where(and(eq(paymentMethods.accountId, id), eq(paymentMethods.userId, userId)));
      await tx.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    });
  } catch (error) {
    toUserError(error, { inUse: "This account is in use. Archive it instead." });
  }
}

export async function moveAccount(userId: string, id: string, direction: -1 | 1) {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, false)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
  const ordered = moveId(
    rows.map((r) => r.id),
    id,
    direction,
  );
  if (!ordered) return;

  await db.transaction(async (tx) => {
    for (const [index, accountId] of ordered.entries()) {
      await tx
        .update(accounts)
        .set({ sortOrder: index })
        .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    }
  });
}
