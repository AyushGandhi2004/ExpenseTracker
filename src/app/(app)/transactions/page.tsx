import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { formatDayLabel } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { transactionFilters, type TransactionFilters } from "@/lib/validators/transactions";
import { requireUser } from "@/server/auth";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { listPaymentMethods } from "@/server/services/payment-methods";
import { DEFAULT_PAGE_SIZE, listTransactions, type TransactionListItem } from "@/server/services/transactions";
import { TransactionsToolbar } from "./transactions-toolbar";

export const metadata: Metadata = { title: "Transactions" };

function toQuery(filters: TransactionFilters, overrides: Partial<TransactionFilters> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const user = await requireUser();
  const filters = transactionFilters.parse(await searchParams);

  const [data, categories, methods, accounts] = await Promise.all([
    listTransactions(user.id, filters),
    listCategories(user.id),
    listPaymentMethods(user.id),
    listAccounts(user.id),
  ]);

  const groups: { date: string; items: TransactionListItem[] }[] = [];
  for (const tx of data.items) {
    const last = groups.at(-1);
    if (last?.date === tx.txnDate) last.items.push(tx);
    else groups.push({ date: tx.txnDate, items: [tx] });
  }
  const totalsByDate = new Map(data.dayTotals.map((d) => [d.txnDate, d]));
  const filtered = Object.entries(filters).some(([k, v]) => k !== "limit" && v !== undefined);

  return (
    <>
      <PageHeader title="Transactions" />
      <TransactionsToolbar
        filters={filters}
        options={{
          categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, isArchived: c.isArchived })),
          methods: methods.map((m) => ({ id: m.id, name: m.name, isArchived: m.isArchived })),
          accounts: accounts.map((a) => ({ id: a.id, name: a.name, isArchived: a.isArchived })),
        }}
      />

      {data.summary.count > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          {data.summary.count} {data.summary.count === 1 ? "transaction" : "transactions"}
          {data.summary.spent > 0 && (
            <>
              {" · "}spent <span className="font-medium text-foreground tabular-nums">{formatINR(data.summary.spent)}</span>
            </>
          )}
          {data.summary.received > 0 && (
            <>
              {" · "}received{" "}
              <span className="font-medium text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatINR(data.summary.received)}
              </span>
            </>
          )}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {filtered ? "No transactions match these filters." : "No transactions yet. Tap + to add one."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const totals = totalsByDate.get(group.date);
            return (
              <section key={group.date} aria-label={formatDayLabel(group.date)}>
                <div className="mb-1.5 flex items-baseline justify-between px-1 text-sm">
                  <h2 className="font-medium">{formatDayLabel(group.date)}</h2>
                  <span className="flex gap-2 tabular-nums text-muted-foreground">
                    {!!totals?.received && (
                      <span className="text-emerald-600 dark:text-emerald-400">+{formatINR(totals.received)}</span>
                    )}
                    {!!totals?.spent && <span>−{formatINR(totals.spent)}</span>}
                  </span>
                </div>
                <ul className="divide-y overflow-hidden rounded-xl border">
                  {group.items.map((tx) => (
                    <li key={tx.id}>
                      <TransactionItem tx={tx} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {data.hasMore && (
            <Link
              href={`/transactions${toQuery(filters, { limit: data.limit + DEFAULT_PAGE_SIZE })}`}
              scroll={false}
              className="mx-auto rounded-full border px-5 py-2 text-sm font-medium hover:bg-muted"
            >
              Show more
            </Link>
          )}
        </div>
      )}
    </>
  );
}
