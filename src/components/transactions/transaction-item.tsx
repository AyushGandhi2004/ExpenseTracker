"use client";

import { useMoneySheets } from "@/components/money/money-sheets";
import { TransactionRow } from "@/components/transaction-row";
import { formatDayLabel } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { TransactionListItem } from "@/server/services/transactions";
import { deleteWithUndo } from "./delete-with-undo";
import { SwipeRow } from "./swipe-row";

/** How each transaction type reads in a list. */
export function describeTransaction(tx: TransactionListItem) {
  switch (tx.type) {
    case "expense":
      return {
        icon: tx.categoryIcon,
        color: tx.categoryColor,
        title: tx.description ?? tx.categoryName ?? "Expense",
        detail: [tx.description ? tx.categoryName : null, tx.paymentMethodName],
        amount: tx.amountPaise,
        sign: "-" as const,
      };
    case "income":
      return {
        icon: tx.categoryIcon,
        color: tx.categoryColor,
        title: tx.description ?? tx.categoryName ?? "Money added",
        detail: [tx.description ? tx.categoryName : null, `into ${tx.accountName}`],
        amount: tx.amountPaise,
        sign: "+" as const,
      };
    case "transfer":
      return {
        icon: "transfer",
        color: null,
        title: tx.description ?? "Transfer",
        detail: [`${tx.accountName} → ${tx.toAccountName}`],
        amount: tx.amountPaise,
        sign: "" as const,
      };
    case "adjustment":
      return {
        icon: "adjustment",
        color: null,
        title: "Balance adjustment",
        detail: [tx.accountName],
        amount: Math.abs(tx.amountPaise),
        sign: tx.amountPaise > 0 ? ("+" as const) : ("-" as const),
      };
  }
}

/** A tappable, swipeable transaction. Set `showDate` when the list isn't grouped by day. */
export function TransactionItem({ tx, showDate = false }: { tx: TransactionListItem; showDate?: boolean }) {
  const { openTransaction } = useMoneySheets();
  const d = describeTransaction(tx);
  const subtitle = [showDate ? formatDayLabel(tx.txnDate) : null, ...d.detail].filter(Boolean).join(" · ");
  const label = `${d.title}, ${d.sign === "+" ? "+" : d.sign === "-" ? "minus " : ""}${formatINR(d.amount)}`;

  return (
    <SwipeRow
      label={label}
      onTap={() => openTransaction(tx)}
      onEdit={() => openTransaction(tx)}
      onDelete={() => void deleteWithUndo(tx.id, `${formatINR(d.amount)} · ${d.title}`)}
    >
      <TransactionRow
        icon={d.icon}
        color={d.color}
        title={d.title}
        subtitle={subtitle}
        amountPaise={d.amount}
        sign={d.sign}
      />
    </SwipeRow>
  );
}
