import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { IconBadge } from "@/components/app-icon";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatINR } from "@/lib/money";
import type { Budgets } from "@/server/services/budgets";
import { BudgetMeter, BudgetStatus } from "./budget-meter";

const SHOWN_CATEGORIES = 3;

/** Home: the overall budget and the categories closest to their limits (or a prompt to set one). */
export function BudgetCard({ budgets }: { budgets: Budgets }) {
  const { overall, byCategory } = budgets;
  if (!overall && byCategory.length === 0) {
    return (
      <Link href="/budgets" className="mb-4 flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 hover:bg-muted/60">
        <PiggyBank className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span className="text-sm font-medium">Set a monthly budget</span>
          <span className="text-xs text-muted-foreground">See what&apos;s left to spend as the month goes on</span>
        </span>
      </Link>
    );
  }
  return (
    <div className="mb-4">
      <DashboardCard
        title="Budgets"
        action={
          <Link href="/budgets" className="text-sm font-medium hover:underline">
            {byCategory.length > SHOWN_CATEGORIES ? "See all" : "Manage"}
          </Link>
        }
      >
        <ul className="flex flex-col gap-3">
          {overall && (
            <li className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">All spending</span>
                <BudgetStatus progress={overall.progress} />
              </span>
              <BudgetMeter progress={overall.progress} label="All spending" />
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatINR(overall.spentPaise)} of {formatINR(overall.amountPaise)}
                {overall.progress.state !== "over" && overall.progress.daysLeft > 1 && ` · about ${formatINR(overall.progress.perDayPaise)} a day`}
              </span>
            </li>
          )}
          {byCategory.slice(0, SHOWN_CATEGORIES).map((b) => (
            <li key={b.id} className="flex items-center gap-3">
              <IconBadge icon={b.categoryIcon} color={b.categoryColor} className="size-8 [&_svg]:size-4" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{b.categoryName}</span>
                  <span className="shrink-0">
                    <BudgetStatus progress={b.progress} />
                  </span>
                </span>
                <BudgetMeter progress={b.progress} label={b.categoryName ?? "Category"} />
              </span>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </div>
  );
}
