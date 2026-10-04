"use client";

import { useState } from "react";
import { intensityBucket } from "@/lib/chart";
import { formatDayLabel, monthGrid } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { DayReadout } from "./day-readout";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Sequential one-hue ramp (validated light & dark); text flips by fill luminance.
const BUCKET_CLASS = [
  "bg-viz-empty text-muted-foreground",
  "bg-viz-1 text-black dark:text-white",
  "bg-viz-2 text-black dark:text-white",
  "bg-viz-3 text-white",
  "bg-viz-4 text-white dark:text-black",
  "bg-viz-5 text-white dark:text-black",
];

/** Month heatmap: each day shaded by how much was spent relative to the busiest day. */
export function SpendCalendar({
  month,
  spentByDate,
  today,
}: {
  month: string;
  spentByDate: Record<string, number>;
  today: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const entries = Object.entries(spentByDate);
  const max = Math.max(0, ...entries.map(([, v]) => v));
  const peakEntry = entries.reduce<[string, number] | null>((best, e) => (e[1] > (best?.[1] ?? 0) ? e : best), null);

  return (
    <div>
      <DayReadout
        selected={selected ? { date: selected, spent: spentByDate[selected] ?? 0 } : null}
        peak={peakEntry ? { date: peakEntry[0], spent: peakEntry[1] } : null}
      />
      <div className="mt-2 grid grid-cols-7 gap-[3px]" role="grid" aria-label="Spending by day">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1 text-center text-[11px] text-muted-foreground" role="columnheader">
            {d}
          </span>
        ))}
        {monthGrid(month)
          .flat()
          .map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />;
            const future = day > today;
            const spent = spentByDate[day] ?? 0;
            const bucket = future ? 0 : intensityBucket(spent, max);
            return (
              <button
                key={day}
                type="button"
                role="gridcell"
                disabled={future}
                aria-selected={selected === day}
                aria-label={`${formatDayLabel(day)}: ${future ? "upcoming" : formatINR(spent)}`}
                onClick={() => setSelected(day)}
                onPointerEnter={(e) => e.pointerType === "mouse" && !future && setSelected(day)}
                onPointerLeave={(e) => e.pointerType === "mouse" && setSelected(null)}
                className={`flex aspect-square items-center justify-center rounded-md text-xs tabular-nums outline-none aria-selected:ring-2 aria-selected:ring-foreground focus-visible:ring-2 focus-visible:ring-ring ${
                  future ? "text-muted-foreground/40" : BUCKET_CLASS[bucket]
                } ${day === today ? "font-semibold" : ""}`}
              >
                {Number(day.slice(8))}
              </button>
            );
          })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
        Less
        {BUCKET_CLASS.slice(1).map((c) => (
          <span key={c} className={`size-3 rounded-[3px] ${c.split(" ")[0]}`} />
        ))}
        More
      </div>
    </div>
  );
}
