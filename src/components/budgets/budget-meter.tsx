import { CircleAlert, TriangleAlert } from "lucide-react";
import type { BudgetProgress } from "@/lib/budget";
import { formatINR } from "@/lib/money";

/** Spent vs limit: one hue, red only past the limit. A tick marks how far through the month today is. */
export function BudgetMeter({ progress, label }: { progress: BudgetProgress; label: string }) {
  const { pct, state, pacePct } = progress;
  return (
    <span className="relative block h-2 rounded-full bg-muted" role="img" aria-label={`${label}: ${pct}% of the limit spent`}>
      <span
        className={`block h-full rounded-full ${state === "over" ? "bg-viz-bad" : "bg-viz-accent"}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
      <span
        className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/60 ring-1 ring-background"
        style={{ left: `${pacePct}%` }}
      />
    </span>
  );
}

/** What the numbers mean, in words: never colour alone. */
export function BudgetStatus({ progress }: { progress: BudgetProgress }) {
  const { state, remainingPaise, overPaise, pct } = progress;
  if (state === "over") {
    return (
      <span className="inline-flex items-center gap-1 font-medium">
        <CircleAlert className="size-3.5 shrink-0 text-viz-bad" aria-hidden />
        {formatINR(overPaise)} over
      </span>
    );
  }
  if (state === "near") {
    return (
      <span className="inline-flex items-center gap-1 font-medium">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
        {pct >= 100 ? "Limit reached" : `${formatINR(remainingPaise)} left`}
      </span>
    );
  }
  return <span className="text-muted-foreground">{formatINR(remainingPaise)} left</span>;
}
