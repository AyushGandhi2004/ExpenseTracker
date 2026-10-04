import { PageHeader } from "@/components/page-header";
import { PendingExpenses } from "@/components/quick-add/pending-expenses";
import { TransactionRow } from "@/components/transaction-row";
import { formatDayLabel } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { listRecentTransactions } from "@/server/services/transactions";

// Recent activity until the dashboard (M6) lands.
export default async function Home() {
  const user = await requireUser();
  const recent = await listRecentTransactions(user.id, 15);

  return (
    <>
      <PageHeader title="Expense Tracker" />
      <PendingExpenses />

      <h2 className="mb-2 text-sm font-medium text-muted-foreground">Recent</h2>
      {recent.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No expenses yet. Tap <span className="font-medium text-foreground">+</span> to add your first one.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {recent.map((t) => (
            <li key={t.id}>
              <TransactionRow
                icon={t.categoryIcon}
                color={t.categoryColor}
                title={t.description ?? t.categoryName ?? "Transaction"}
                subtitle={[formatDayLabel(t.txnDate), t.description ? t.categoryName : null, t.paymentMethodName]
                  .filter(Boolean)
                  .join(" · ")}
                amountPaise={t.amountPaise}
                sign={t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
