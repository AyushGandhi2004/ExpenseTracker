"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { addMonths, formatMonthLabel, monthGrid, startOfMonth } from "@/lib/dates";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** In-sheet month calendar. Future days are disabled (you can't spend tomorrow's money yet). */
export function CalendarView({
  value,
  today,
  onSelect,
  onBack,
}: {
  value: string;
  today: string;
  onSelect: (date: string) => void;
  /** Shows a "Pick a date" header with a back button (sheet view); omit when embedded inline. */
  onBack?: () => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(value));
  const atCurrentMonth = month >= startOfMonth(today);
  const navButton =
    "flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2">
      {onBack && (
        <div className="flex items-center gap-2 pb-2">
          <button type="button" onClick={onBack} aria-label="Back" className={navButton}>
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="text-base font-semibold">Pick a date</h2>
        </div>
      )}

      <div className="flex items-center justify-between px-2 py-2">
        <button
          type="button"
          aria-label="Previous month"
          className={navButton}
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-medium" aria-live="polite">
          {formatMonthLabel(month)}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className={navButton}
          disabled={atCurrentMonth}
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div role="grid" aria-label={formatMonthLabel(month)} className="px-2">
        <div role="row" className="grid grid-cols-7 pb-1">
          {WEEKDAYS.map((d) => (
            <span key={d} role="columnheader" className="text-center text-xs text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        {monthGrid(month).map((week, i) => (
          <div key={i} role="row" className="grid grid-cols-7 gap-1 py-0.5">
            {week.map((day, j) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  role="gridcell"
                  aria-selected={day === value}
                  aria-current={day === today ? "date" : undefined}
                  disabled={day > today}
                  onClick={() => onSelect(day)}
                  className={`mx-auto flex size-11 items-center justify-center rounded-full text-sm tabular-nums transition-colors disabled:text-muted-foreground/40 ${
                    day === value
                      ? "bg-primary font-semibold text-primary-foreground"
                      : day === today
                        ? "font-semibold ring-1 ring-foreground/40 hover:bg-muted"
                        : "hover:bg-muted"
                  }`}
                >
                  {Number(day.slice(8))}
                </button>
              ) : (
                <span key={`blank-${j}`} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
