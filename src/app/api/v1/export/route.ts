import { toCsv } from "@/lib/csv";
import { todayIst } from "@/lib/dates";
import { transactionFilters } from "@/lib/validators/transactions";
import { apiRoute, queryOf } from "@/server/api";
import { exportTransactions } from "@/server/services/transactions";

const TYPE_LABEL = { expense: "Expense", income: "Money in", transfer: "Transfer", adjustment: "Adjustment" } as const;

/**
 * CSV of transactions matching the same filters as the Transactions screen.
 * Amount is signed rupees from your accounts' point of view: expenses negative, money in positive.
 */
export const GET = apiRoute(async (user, request) => {
  // Export ignores paging: every matching row.
  const rows = await exportTransactions(user.id, transactionFilters.parse(queryOf(request)));

  const signed = (t: (typeof rows)[number]) => (t.type === "expense" ? -t.amountPaise : t.amountPaise);
  const csv = toCsv(
    ["Date", "Type", "Amount (INR)", "Category", "Payment method", "Account", "To account", "Note"],
    rows.map((t) => [
      t.txnDate,
      TYPE_LABEL[t.type],
      signed(t) / 100,
      t.categoryName,
      t.paymentMethodName,
      t.accountName,
      t.toAccountName,
      t.description,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses-${todayIst()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
