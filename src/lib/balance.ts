/**
 * Ledger rules for account balances.
 *
 * balance = opening balance + Σ effect of each transaction dated on/after the opening date
 *   expense    on the paying account          → −amount
 *   income     into the account               → +amount
 *   adjustment on the account (signed amount) → +amount
 *   transfer   out of `account_id`            → −amount
 *   transfer   into `to_account_id`           → +amount
 */

export type TransactionType = "expense" | "income" | "transfer" | "adjustment";

/** One aggregated row: the sum of a transaction type on one side of an account. */
export type LedgerSum = {
  type: TransactionType;
  /** true when the account is `account_id` (source); false when it's `to_account_id`. */
  isSource: boolean;
  totalPaise: number;
};

export function ledgerEffect(type: TransactionType, isSource: boolean, amountPaise: number): number {
  if (!isSource) return type === "transfer" ? amountPaise : 0;
  switch (type) {
    case "expense":
    case "transfer":
      return -amountPaise;
    case "income":
    case "adjustment":
      return amountPaise;
  }
}

export function balanceFromSums(openingBalancePaise: number, sums: readonly LedgerSum[]): number {
  return sums.reduce((balance, s) => balance + ledgerEffect(s.type, s.isSource, s.totalPaise), openingBalancePaise);
}

/** Adjustment needed so the app balance matches the real one (positive adds money). */
export function reconcileDifference(appBalancePaise: number, actualBalancePaise: number): number {
  return actualBalancePaise - appBalancePaise;
}
