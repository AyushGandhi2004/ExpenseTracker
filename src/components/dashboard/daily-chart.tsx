"use client";

import { useState } from "react";
import { niceCeil } from "@/lib/chart";
import { formatDayLabel } from "@/lib/dates";
import { formatINR, formatINRCompact } from "@/lib/money";
import { DayReadout } from "./day-readout";

export type DayPoint = { date: string; spent: number; future: boolean };

const CHART_HEIGHT = 128;
const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Daily spending columns, one hue. Hover (mouse), tap or focus a column to read it;
 * the readout above defaults to the busiest day. Future days keep their slot, empty.
 */
export function DailyChart({ days, kind }: { days: DayPoint[]; kind: "week" | "month" }) {
  const [selected, setSelected] = useState<string | null>(null);
  const max = niceCeil(Math.max(0, ...days.map((d) => d.spent)));
  const peak = days.reduce<DayPoint | null>((best, d) => (d.spent > (best?.spent ?? 0) ? d : best), null);
  const selectedDay = days.find((d) => d.date === selected) ?? null;

  const xLabel = (d: DayPoint, i: number) =>
    kind === "week" ? WEEKDAY_INITIALS[i] : [1, 8, 15, 22, 29].includes(Number(d.date.slice(8))) ? Number(d.date.slice(8)) : "";

  return (
    <div>
      <DayReadout selected={selectedDay} peak={peak} />
      <div className="mt-2 grid grid-cols-[2.5rem_1fr] gap-x-2">
        {/* Y axis: 0, half, max */}
        <div className="relative text-right text-[11px] text-muted-foreground tabular-nums" style={{ height: CHART_HEIGHT }}>
          {max > 0 &&
            [max, max / 2].map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ top: CHART_HEIGHT - (v / max) * CHART_HEIGHT }}>
                {formatINRCompact(v)}
              </span>
            ))}
          <span className="absolute right-0 bottom-0 translate-y-1/2">₹0</span>
        </div>

        <div className="relative" style={{ height: CHART_HEIGHT }} onPointerLeave={(e) => e.pointerType === "mouse" && setSelected(null)}>
          {/* Hairline gridlines */}
          {[0, 0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 border-t border-border" style={{ top: CHART_HEIGHT - f * CHART_HEIGHT }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label="Daily spending">
            {days.map((d) => {
              const height = max > 0 ? Math.max(d.spent > 0 ? 2 : 0, (d.spent / max) * CHART_HEIGHT) : 0;
              const dimmed = selected !== null && selected !== d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="listitem"
                  disabled={d.future}
                  aria-label={`${formatDayLabel(d.date)}: ${d.future ? "upcoming" : formatINR(d.spent)}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && !d.future && setSelected(d.date)}
                  onClick={() => setSelected(d.date)}
                  onFocus={() => setSelected(d.date)}
                  className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                >
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] bg-viz-accent transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ring ${
                      dimmed ? "opacity-35" : ""
                    }`}
                    style={{ height }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div />
        <div className="mt-1.5 flex gap-[2px] text-[11px] text-muted-foreground tabular-nums" aria-hidden>
          {days.map((d, i) => (
            <span key={d.date} className={`min-w-0 flex-1 text-center ${d.future ? "opacity-40" : ""}`}>
              {xLabel(d, i)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
