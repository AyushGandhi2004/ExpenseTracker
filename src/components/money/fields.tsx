"use client";

import { useState } from "react";
import { fieldClass, FormField } from "@/components/form-field";
import { CalendarView } from "@/components/quick-add/calendar-view";
import { DateChooser } from "@/components/quick-add/date-chooser";

/** Large rupee amount input; the value is the raw text the user typed. */
export function AmountField({
  id,
  label = "Amount",
  value,
  onChange,
  allowNegative = false,
  autoFocus,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  allowNegative?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xl text-muted-foreground">
          ₹
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            const pattern = allowNegative ? /[^\d.,-]/g : /[^\d.,]/g;
            onChange(e.target.value.replace(pattern, ""));
          }}
          className={`${fieldClass} h-14 pl-8 text-2xl font-semibold tabular-nums`}
        />
      </div>
    </FormField>
  );
}

/** Today / Yesterday / Pick date, with the month calendar opening inline below. */
export function DateField({ value, onChange, today }: { value: string; onChange: (d: string) => void; today: string }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  return (
    <FormField label="Date">
      <DateChooser
        value={value}
        today={today}
        onChange={(d) => {
          onChange(d);
          setCalendarOpen(false);
        }}
        onPickDate={() => setCalendarOpen((v) => !v)}
      />
      {calendarOpen && (
        <div className="rounded-xl border py-2">
          <CalendarView
            value={value}
            today={today}
            onSelect={(d) => {
              onChange(d);
              setCalendarOpen(false);
            }}
          />
        </div>
      )}
    </FormField>
  );
}

export function NoteField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <FormField label="Note" htmlFor={id}>
      <input
        id={id}
        className={fieldClass}
        placeholder="Optional"
        maxLength={200}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}
