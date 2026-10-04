import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { z } from "zod";
import { AppIcon, IconBadge } from "@/components/app-icon";
import { BreakdownList } from "@/components/dashboard/breakdown-list";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { DashboardCard, StatTile } from "@/components/dashboard/dashboard-card";
import { PeriodNav } from "@/components/dashboard/period-nav";
import { SpendCalendar } from "@/components/dashboard/spend-calendar";
import { PageHeader } from "@/components/page-header";
import { PendingExpenses } from "@/components/quick-add/pending-expenses";
import { TransactionItem } from "@/components/transactions/transaction-item";
import { percentChange } from "@/lib/chart";
import { dashboardPeriod, daysInRange, eachDay, formatMonthLabel, formatRangeLabel, todayIst } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { paymentMethodIcon } from "@/lib/validators/settings";
import { requireUser } from "@/server/auth";
import { getDashboard } from "@/server/services/analytics";
import { listRecentTransactions } from "@/server/services/transactions";

const params = z.object({
  period: z.enum(["week", "month"]).catch("month"),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const today = todayIst();
  const { period: kind, anchor } = params.parse(await searchParams);
  const period = dashboardPeriod(kind, anchor && anchor <= today ? anchor : today, today);

  const [data, recent] = await Promise.all([getDashboard(user.id, period), listRecentTransactions(user.id, 5)]);

  const range = `from=${period.from}&to=${period.to}`;
  const periodName =
    kind === "month"
      ? period.isCurrent
        ? "this month"
        : `in ${formatMonthLabel(period.from)}`
      : period.isCurrent
        ? "this week"
        : formatRangeLabel(period.from, period.end);
  const compareName =
    period.isCurrent || kind === "week"
      ? formatRangeLabel(period.compare.from, period.compare.to)
      : formatMonthLabel(period.compare.from);
  const change = percentChange(data.spent, data.compareSpent);
  const days = eachDay(period.from, period.end).map((date) => ({
    date,
    spent: data.daily.get(date) ?? 0,
    future: date > today,
  }));

  return (
    <>
      <PageHeader title="Expense Tracker" />
      <PendingExpenses />
      <PeriodNav period={period} />

      {/* Hero: the one number this view leads with */}
      <section className="mb-4" aria-label="Spending summary">
        <p className="text-sm text-muted-foreground">Spent {periodName}</p>
        <p className="text-5xl font-semibold tracking-tight tabular-nums">{formatINR(data.spent)}</p>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          {change === null ? (
            <>Nothing spent in {compareName}</>
          ) : change === 0 ? (
            <>Same as {compareName}</>
          ) : (
            <>
              {change < 0 ? (
                <ArrowDownRight className="size-4 text-viz-good" aria-hidden />
              ) : (
                <ArrowUpRight className="size-4 text-viz-bad" aria-hidden />
              )}
              <span>
                <span className="font-medium text-foreground">
                  {Math.abs(change)}% {change < 0 ? "less" : "more"}
                </span>{" "}
                than {compareName} ({formatINR(data.compareSpent)})
              </span>
            </>
          )}
        </p>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatTile
          label="Per day"
          value={formatINR(Math.round(data.spent / daysInRange(period.from, period.to) / 100) * 100)}
        />
        <StatTile label="Money in" value={formatINR(data.received)} href={`/transactions?type=income&${range}`} />
        <StatTile label="Balance" value={formatINR(data.totalBalance)} href="/accounts" />
      </div>

      {data.spent === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No expenses {periodName}. Tap <span className="font-medium text-foreground">+</span> to add one.
        </p>
      ) : (
        <div className="mb-6 flex flex-col gap-4">
          <DashboardCard title="Daily spending">
            <DailyChart days={days} kind={kind} />
          </DashboardCard>

          {kind === "month" && (
            <DashboardCard title="Calendar">
              <SpendCalendar month={period.from} spentByDate={Object.fromEntries(data.daily)} today={today} />
            </DashboardCard>
          )}

          <DashboardCard title="By category">
            <BreakdownList
              total={data.spent}
              rows={data.byCategory.map((c) => ({
                id: c.id,
                name: c.name,
                spent: c.spent,
                count: c.count,
                leading: <IconBadge icon={c.icon} color={c.color} className="size-8 [&_svg]:size-4" />,
                href: `/transactions?category=${c.id}&${range}`,
              }))}
            />
          </DashboardCard>

          <DashboardCard title="By payment method">
            <BreakdownList
              total={data.spent}
              rows={data.byMethod.map((m) => ({
                id: m.id,
                name: m.name,
                spent: m.spent,
                count: m.count,
                leading: (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <AppIcon name={paymentMethodIcon(m.kind)} className="size-4" />
                  </span>
                ),
                href: `/transactions?method=${m.id}&${range}`,
              }))}
            />
          </DashboardCard>

          <DashboardCard
            title="Biggest expenses"
            action={
              <Link href={`/transactions?type=expense&${range}`} className="text-sm font-medium hover:underline">
                See all
              </Link>
            }
          >
            <ul className="-mx-4 -mb-4 divide-y overflow-hidden rounded-b-2xl border-t">
              {data.topExpenses.map((tx) => (
                <li key={tx.id}>
                  <TransactionItem tx={tx} showDate />
                </li>
              ))}
            </ul>
          </DashboardCard>
        </div>
      )}

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
          No transactions yet.
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
