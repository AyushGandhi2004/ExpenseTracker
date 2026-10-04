import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PendingExpenses } from "@/components/quick-add/pending-expenses";
import { TransactionItem } from "@/components/transactions/transaction-item";
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

      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
        {recent.length > 0 && (
          <Link href="/transactions" className="text-sm font-medium hover:underline">
            See all
          </Link>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No expenses yet. Tap <span className="font-medium text-foreground">+</span> to add your first one.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {recent.map((tx) => (
            <li key={tx.id}>
              <TransactionItem tx={tx} showDate />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
