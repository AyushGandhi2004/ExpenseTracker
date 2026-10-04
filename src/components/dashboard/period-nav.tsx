import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatRangeLabel, formatShortMonthLabel, type DashboardPeriod } from "@/lib/dates";

const href = (kind: string, anchor?: string) => `/?period=${kind}${anchor ? `&anchor=${anchor}` : ""}`;

/** Week/Month switch and ‹ period › navigation. One row, above everything it scopes. */
export function PeriodNav({ period }: { period: DashboardPeriod }) {
  const title = period.kind === "month" ? formatShortMonthLabel(period.from) : formatRangeLabel(period.from, period.end);
  const arrow =
    "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-30";
  const segment = "rounded-md px-3 py-1.5 text-sm aria-[current=true]:bg-background aria-[current=true]:font-medium aria-[current=true]:shadow-sm";

  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center">
        <Link href={href(period.kind, period.prevAnchor)} aria-label="Previous period" className={arrow} scroll={false}>
          <ChevronLeft className="size-5" />
        </Link>
        <span className="min-w-0 truncate font-semibold">{title}</span>
        <Link
          href={period.nextAnchor ? href(period.kind, period.nextAnchor) : "#"}
          aria-label="Next period"
          aria-disabled={!period.nextAnchor}
          tabIndex={period.nextAnchor ? undefined : -1}
          className={arrow}
          scroll={false}
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>
      <div className="flex shrink-0 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Period">
        {(["week", "month"] as const).map((kind) => (
          <Link key={kind} href={href(kind)} aria-current={period.kind === kind} className={segment} scroll={false}>
            {kind === "week" ? "Week" : "Month"}
          </Link>
        ))}
      </div>
    </div>
  );
}
