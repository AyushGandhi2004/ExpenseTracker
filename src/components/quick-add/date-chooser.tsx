"use client";

import { CalendarDays } from "lucide-react";
import { addDays, formatShortDay } from "@/lib/dates";

/** Today / Yesterday / pick-a-date segmented control; "pick" opens the in-sheet calendar. */
export function DateChooser({
  value,
  today,
  onChange,
  onPickDate,
}: {
  value: string;
  today: string;
  onChange: (date: string) => void;
  onPickDate: () => void;
}) {
  const yesterday = addDays(today, -1);
  const isOther = value !== today && value !== yesterday;
  const segment =
    "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-sm whitespace-nowrap transition-colors aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Date">
      <button type="button" className={segment} aria-pressed={value === today} onClick={() => onChange(today)}>
        Today
      </button>
      <button type="button" className={segment} aria-pressed={value === yesterday} onClick={() => onChange(yesterday)}>
        Yesterday
      </button>
      <button type="button" className={segment} aria-pressed={isOther} onClick={onPickDate}>
        <CalendarDays className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{isOther ? formatShortDay(value) : "Pick date"}</span>
      </button>
    </div>
  );
}
