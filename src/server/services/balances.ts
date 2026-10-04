import "server-only";
import { and, asc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { balanceFromSums, type LedgerSum } from "@/lib/balance";
import { db } from "@/server/db";
import { accounts, transactions } from "@/server/db/schema";
import { UserError } from "@/server/errors";

/**
 * Per-account sums by transaction type and side (source vs transfer destination),
 * counting only live transactions dated on/after each account's opening date.
 */
async function ledgerSums(userId: string, accountId?: string) {
  const isSource = sql<boolean>`${transactions.accountId} = ${accounts.id}`;
  return db
    .select({
      accountId: accounts.id,
      type: transactions.type,
      isSource,
      totalPaise: sql<number>`sum(${transactions.amountPaise})::bigint`.mapWith(Number),
    })
    .from(accounts)
    .innerJoin(
      transactions,
      and(
        or(eq(transactions.accountId, accounts.id), eq(transactions.toAccountId, accounts.id)),
        isNull(transactions.deletedAt),
        gte(transactions.txnDate, accounts.openingDate),
      ),
    )
    .where(and(eq(accounts.userId, userId), accountId ? eq(accounts.id, accountId) : undefined))
    .groupBy(accounts.id, transactions.type, isSource);
}

export async function getAccountBalances(userId: string) {
  const [rows, sums] = await Promise.all([
    db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        openingBalancePaise: accounts.openingBalancePaise,
        openingDate: accounts.openingDate,
        isArchived: accounts.isArchived,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.isArchived), asc(accounts.sortOrder), asc(accounts.createdAt)),
    ledgerSums(userId),
  ]);

  const byAccount = new Map<string, LedgerSum[]>();
  for (const s of sums) {
    const list = byAccount.get(s.accountId) ?? [];
    list.push({ type: s.type, isSource: s.isSource, totalPaise: s.totalPaise });
    byAccount.set(s.accountId, list);
  }

  return rows.map((a) => ({
    ...a,
    balancePaise: balanceFromSums(a.openingBalancePaise, byAccount.get(a.id) ?? []),
  }));
}
export type AccountBalance = Awaited<ReturnType<typeof getAccountBalances>>[number];

export async function getAccountBalance(userId: string, accountId: string): Promise<number> {
  const [account] = await db
    .select({ openingBalancePaise: accounts.openingBalancePaise })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  if (!account) throw new UserError("Account not found.");
  const sums = await ledgerSums(userId, accountId);
  return balanceFromSums(account.openingBalancePaise, sums);
}
