import Link from "next/link";
import { Repeat } from "lucide-react";
import { IconBadge } from "@/components/app-icon";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatDueDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { RecurringRow } from "@/server/services/recurring";

/** Home card: recurring payments due in the next 7 days (or a prompt to set them up). */
export function UpcomingPaymentsCard({ upcoming, hasAny, today }: { upcoming: RecurringRow[]; hasAny: boolean; today: string }) {
  if (!hasAny) {
    return (
      <Link
        href="/recurring"
        className="mb-6 flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3 hover:bg-muted/60"
      >
        <Repeat className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span className="text-sm font-medium">Automate fixed costs</span>
          <span className="text-xs text-muted-foreground">Insurance, Wi‑Fi, rent… recorded on their due dates</span>
        </span>
      </Link>
    );
  }

  return (
    <div className="mb-6">
      <DashboardCard
        title="Upcoming payments"
        action={
          <Link href="/recurring" className="text-sm font-medium hover:underline">
            Manage
          </Link>
        }
      >
        {upcoming.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="-mx-1 flex flex-col">
            {upcoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-1 py-1.5">
                <IconBadge icon={r.categoryIcon} color={r.categoryColor} className="size-8 [&_svg]:size-4" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDueDate(r.nextDueDate!, today)} · {r.paymentMethodName}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{formatINR(r.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </div>
  );
}
