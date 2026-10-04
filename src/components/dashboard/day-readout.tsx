import { formatDayLabel } from "@/lib/dates";
import { formatINR } from "@/lib/money";

/**
 * The value line above a daily chart: the selected day's spend, or the period's
 * busiest day when nothing is selected. Value leads, label follows.
 */
export function DayReadout({
  selected,
  peak,
}: {
  selected: { date: string; spent: number } | null;
  peak: { date: string; spent: number } | null;
}) {
  const shown = selected ?? peak;
  return (
    <p className="flex h-6 items-baseline gap-2 text-sm" aria-live="polite">
      {shown ? (
        <>
          <span className="font-semibold tabular-nums">{formatINR(shown.spent)}</span>
          <span className="text-muted-foreground">
            {selected ? formatDayLabel(shown.date) : `highest, ${formatDayLabel(shown.date)}`}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">No spending yet</span>
      )}
    </p>
  );
}
