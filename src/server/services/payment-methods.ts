import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { moveId } from "@/lib/reorder";
import type { PaymentMethodInput } from "@/lib/validators/settings";
import { db } from "@/server/db";
import { accounts, paymentMethods } from "@/server/db/schema";
import { toUserError, UserError } from "@/server/errors";

const DUPLICATE = "You already have a payment method with this name.";

export async function listPaymentMethods(userId: string) {
  return db
    .select({
      id: paymentMethods.id,
      name: paymentMethods.name,
      kind: paymentMethods.kind,
      icon: paymentMethods.icon,
      isArchived: paymentMethods.isArchived,
      accountId: paymentMethods.accountId,
      accountName: accounts.name,
      accountArchived: accounts.isArchived,
    })
    .from(paymentMethods)
    .innerJoin(accounts, eq(accounts.id, paymentMethods.accountId))
    .where(eq(paymentMethods.userId, userId))
    .orderBy(asc(paymentMethods.isArchived), asc(paymentMethods.sortOrder), asc(paymentMethods.createdAt));
}
export type PaymentMethodRow = Awaited<ReturnType<typeof listPaymentMethods>>[number];

async function getOwned(userId: string, id: string) {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
  if (!method) throw new UserError("Payment method not found.");
  return method;
}

/** The linked account must be the user's own and active (unless it is unchanged on edit). */
async function assertUsableAccount(userId: string, accountId: string, currentAccountId?: string) {
  const [account] = await db
    .select({ isArchived: accounts.isArchived })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  if (!account) throw new UserError("Choose an account.");
  if (account.isArchived && accountId !== currentAccountId) {
    throw new UserError("That account is archived. Choose another one.");
  }
}

export async function createPaymentMethod(userId: string, input: PaymentMethodInput) {
  await assertUsableAccount(userId, input.accountId);
  try {
    await db.insert(paymentMethods).values({
      userId,
      ...input,
      sortOrder: sql`(select coalesce(max(${paymentMethods.sortOrder}), -1) + 1 from ${paymentMethods} where ${paymentMethods.userId} = ${userId})`,
    });
  } catch (error) {
    toUserError(error, { duplicate: DUPLICATE });
  }
}

export async function updatePaymentMethod(userId: string, id: string, input: PaymentMethodInput) {
  const current = await getOwned(userId, id);
  await assertUsableAccount(userId, input.accountId, current.accountId);
  try {
    await db
      .update(paymentMethods)
      .set(input)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
  } catch (error) {
    toUserError(error, { duplicate: DUPLICATE });
  }
}

export async function setPaymentMethodArchived(userId: string, id: string, archived: boolean) {
  const current = await getOwned(userId, id);
  if (!archived) {
    const [account] = await db
      .select({ isArchived: accounts.isArchived })
      .from(accounts)
      .where(eq(accounts.id, current.accountId));
    if (account?.isArchived) throw new UserError("Restore its account first.");
  }
  await db
    .update(paymentMethods)
    .set({ isArchived: archived })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
}

export async function deletePaymentMethod(userId: string, id: string) {
  await getOwned(userId, id);
  try {
    await db
      .delete(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.userId, userId)));
  } catch (error) {
    toUserError(error, { inUse: "This payment method has transactions. Archive it instead." });
  }
}

export async function movePaymentMethod(userId: string, id: string, direction: -1 | 1) {
  const rows = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isArchived, false)))
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.createdAt));
  const ordered = moveId(
    rows.map((r) => r.id),
    id,
    direction,
  );
  if (!ordered) return;

  await db.transaction(async (tx) => {
    for (const [index, methodId] of ordered.entries()) {
      await tx
        .update(paymentMethods)
        .set({ sortOrder: index })
        .where(and(eq(paymentMethods.id, methodId), eq(paymentMethods.userId, userId)));
    }
  });
}
