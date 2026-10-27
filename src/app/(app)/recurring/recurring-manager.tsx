"use client";

import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddButton } from "@/components/add-button";
import { IconBadge } from "@/components/app-icon";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { AmountField, DateField } from "@/components/money/fields";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { matchCategory, RECURRING_TEMPLATES } from "@/components/recurring/templates";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatDueDate, formatShortDay, todayIst } from "@/lib/dates";
import { formatINR, paiseToRupeesString, parseRupeesToPaise } from "@/lib/money";
import {
  countOccurrencesBefore,
  describeInterval,
  monthlyEquivalent,
  shortInterval,
  upcomingDates,
  type EndType,
  type IntervalUnit,
  type Schedule,
} from "@/lib/recurrence";
import type { RecurringRow } from "@/server/services/recurring";
import type { QuickAddOptions } from "@/server/services/quick-add";
import { addRecurring, deleteRecurring, pauseRecurring, updateRecurring } from "./actions";

type Category = QuickAddOptions["categories"][number];
type Method = QuickAddOptions["paymentMethods"][number];

type FormState = {
  name: string;
  amount: string;
  categoryId: string;
  paymentMethodId: string;
  startDate: string;
  intervalUnit: IntervalUnit;
  intervalCount: string;
  endType: EndType;
  endDate: string;
  endCount: string;
  recordPast: boolean;
};

const UNITS: { value: IntervalUnit; label: string }[] = [
  { value: "day", label: "Days" },
  { value: "month", label: "Months" },
  { value: "year", label: "Years" },
];
const ENDS: { value: EndType; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "on_date", label: "On a date" },
  { value: "after_count", label: "After N times" },
];

const segment =
  "flex h-10 flex-1 items-center justify-center rounded-md text-sm aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

export function RecurringManager({
  rules,
  categories,
  paymentMethods,
}: {
  rules: RecurringRow[];
  categories: Category[];
  paymentMethods: Method[];
}) {
  const [today] = useState(todayIst);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [editing, setEditing] = useState<RecurringRow | null>(null);

  const active = rules.filter((r) => !r.isPaused && r.nextDueDate);
  const monthly = active.reduce((sum, r) => sum + monthlyEquivalent(r.amountPaise, r.intervalUnit, r.intervalCount), 0);
  const next = active[0];

  const openSheet = (rule: RecurringRow | null) => {
    setEditing(rule);
    setKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <PageHeader title="Recurring payments" backHref="/" action={<AddButton onClick={() => openSheet(null)} />} />

      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center">
          <Repeat className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Automate fixed costs</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Insurance, Wi‑Fi, rent, subscriptions… Add them once and each payment is recorded on its due date.
          </p>
          <Button className="mt-4" onClick={() => openSheet(null)}>
            Add a recurring payment
          </Button>
        </div>
      ) : (
        <>
          <section className="mb-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground" aria-label="Summary">
            <p className="text-sm opacity-80">Recurring payments cost about</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {formatINR(Math.round(monthly / 100) * 100)}
              <span className="text-base font-normal opacity-80"> / month</span>
            </p>
            {next?.nextDueDate && (
              <p className="mt-1 text-sm opacity-80">
                Next: {next.name} {formatINR(next.amountPaise)} · {formatDueDate(next.nextDueDate, today)}
              </p>
            )}
          </section>

          <ul className="divide-y overflow-hidden rounded-xl border">
            {rules.map((r) => {
              const ended = !r.nextDueDate;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openSheet(r)}
                    className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 ${
                      r.isPaused || ended ? "opacity-60" : ""
                    }`}
                  >
                    <IconBadge icon={r.categoryIcon} color={r.categoryColor} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        {(r.isPaused || ended) && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {r.isPaused ? "Paused" : "Ended"}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {describeInterval(r.intervalUnit, r.intervalCount)} · {r.paymentMethodName}
                      </span>
                      {r.nextDueDate && !r.isPaused && (
                        <span className="truncate text-xs text-muted-foreground">
                          Next {formatDueDate(r.nextDueDate, today)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatINR(r.amountPaise)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
            Each payment is recorded as an expense on its due date and deducted from the account it&apos;s paid from.
          </p>
        </>
      )}

      {open && (
        <RecurringSheet
          key={key}
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          categories={categories}
          paymentMethods={paymentMethods}
          today={today}
        />
      )}
    </>
  );
}

function RecurringSheet({
  open,
  onOpenChange,
  editing,
  categories: baseCategories,
  paymentMethods: baseMethods,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringRow | null;
  categories: Category[];
  paymentMethods: Method[];
  today: string;
}) {
  // Keep the payment's own category/method selectable even if archived since.
  const categories =
    editing && !baseCategories.some((c) => c.id === editing.categoryId)
      ? [
          ...baseCategories,
          { id: editing.categoryId, name: editing.categoryName, icon: editing.categoryIcon, color: editing.categoryColor },
        ]
      : baseCategories;
  const methods =
    editing && !baseMethods.some((m) => m.id === editing.paymentMethodId)
      ? [
          ...baseMethods,
          {
            id: editing.paymentMethodId,
            name: editing.paymentMethodName,
            kind: editing.paymentMethodKind,
            accountName: editing.accountName,
          },
        ]
      : baseMethods;

  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          amount: paiseToRupeesString(editing.amountPaise),
          categoryId: editing.categoryId,
          paymentMethodId: editing.paymentMethodId,
          startDate: editing.startDate,
          intervalUnit: editing.intervalUnit,
          intervalCount: String(editing.intervalCount),
          endType: editing.endType,
          endDate: editing.endDate ?? today,
          endCount: editing.endCount ? String(editing.endCount) : "12",
          recordPast: false,
        }
      : {
          name: "",
          amount: "",
          categoryId: matchCategory(["Bills"], categories)?.id ?? "",
          paymentMethodId: (methods.find((m) => m.kind !== "cash") ?? methods[0])?.id ?? "",
          startDate: today,
          intervalUnit: "month",
          intervalCount: "1",
          endType: "never",
          endDate: today,
          endCount: "12",
          recordPast: false,
        },
  );
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const { pending, error, setError, run } = useAction();

  const count = Number.parseInt(form.intervalCount, 10);
  const endCount = Number.parseInt(form.endCount, 10);
  const schedule: Schedule | null =
    count >= 1 && count <= 365
      ? {
          startDate: form.startDate,
          intervalUnit: form.intervalUnit,
          intervalCount: count,
          endType: form.endType,
          endDate: form.endType === "on_date" ? form.endDate : null,
          endCount: form.endType === "after_count" && endCount >= 1 ? endCount : null,
        }
      : null;
  const pastCount = !editing && schedule ? countOccurrencesBefore(schedule, today) : 0;
  const preview = schedule ? upcomingDates(schedule, countOccurrencesBefore(schedule, today), 3) : [];

  function submit() {
    const amountPaise = parseRupeesToPaise(form.amount);
    if (!amountPaise) return setError("Enter an amount.");
    if (!schedule) return setError("Repeat every 1 to 365.");
    const payload = {
      name: form.name,
      amountPaise,
      categoryId: form.categoryId,
      paymentMethodId: form.paymentMethodId,
      startDate: form.startDate,
      intervalUnit: form.intervalUnit,
      intervalCount: count,
      endType: form.endType,
      endDate: form.endType === "on_date" ? form.endDate : null,
      endCount: form.endType === "after_count" ? (Number.isFinite(endCount) ? endCount : null) : null,
    };
    run(
      () =>
        editing
          ? updateRecurring(editing.id, payload)
          : addRecurring({ ...payload, recordPast: pastCount > 0 && form.recordPast }),
      { success: editing ? "Saved" : `Added ${form.name || "recurring payment"}`, onSuccess: () => onOpenChange(false) },
    );
  }

  const close = () => onOpenChange(false);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit recurring payment" : "New recurring payment"}
      submitLabel={editing ? "Save changes" : "Add"}
      pending={pending}
      error={error}
      onSubmit={submit}
      secondaryActions={
        editing && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              disabled={pending}
              onClick={() =>
                run(() => pauseRecurring(editing.id, !editing.isPaused), {
                  success: editing.isPaused ? "Resumed" : "Paused",
                  onSuccess: close,
                })
              }
            >
              {editing.isPaused ? <Play /> : <Pause />}
              {editing.isPaused ? "Resume" : "Pause"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-10 flex-1"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete "${editing.name}"? Payments already recorded are kept.`))
                  run(() => deleteRecurring(editing.id), { success: "Deleted", onSuccess: close });
              }}
            >
              <Trash2 />
              Delete
            </Button>
          </>
        )
      }
    >
      {!editing && (
        <FormField label="Quick pick">
          <div className="flex flex-wrap gap-2">
            {RECURRING_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                aria-pressed={form.name === t.name}
                onClick={() =>
                  set({
                    name: t.name,
                    intervalUnit: t.intervalUnit,
                    intervalCount: String(t.intervalCount),
                    categoryId: matchCategory(t.categories, categories)?.id ?? form.categoryId,
                  })
                }
                className="rounded-full border px-3 py-1.5 text-sm aria-pressed:border-foreground aria-pressed:bg-muted"
              >
                {t.name}
                <span className="text-muted-foreground"> · {shortInterval(t.intervalUnit, t.intervalCount)}</span>
              </button>
            ))}
          </div>
        </FormField>
      )}

      <FormField label="Name" htmlFor="rec-name">
        <input
          id="rec-name"
          className={fieldClass}
          placeholder="e.g. Medical insurance"
          maxLength={60}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          autoComplete="off"
        />
      </FormField>

      <AmountField id="rec-amount" value={form.amount} onChange={(amount) => set({ amount })} />
      {editing && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Changes apply from the next payment; payments already recorded stay as they are.
        </p>
      )}

      <FormField label="Category">
        <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === form.categoryId}
              onClick={() => set({ categoryId: c.id })}
              className="flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm aria-checked:border-foreground aria-checked:bg-muted"
            >
              <IconBadge icon={c.icon} color={c.color} className="size-7 [&_svg]:size-4" />
              {c.name}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Pay from" htmlFor="rec-method">
        <NativeSelect id="rec-method" value={form.paymentMethodId} onChange={(e) => set({ paymentMethodId: e.target.value })}>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} (from {m.accountName})
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <DateField
        label="First payment"
        value={form.startDate}
        onChange={(startDate) => set({ startDate })}
        today={today}
        allowFuture
      />

      <FormField label="Repeat every" htmlFor="rec-count">
        <div className="flex gap-2">
          <div className="w-16 shrink-0">
            <input
              id="rec-count"
              inputMode="numeric"
              className={`${fieldClass} text-center`}
              value={form.intervalCount}
              onChange={(e) => set({ intervalCount: e.target.value.replace(/\D/g, "").slice(0, 3) })}
            />
          </div>
          <div className="flex flex-1 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Cycle unit">
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                aria-pressed={form.intervalUnit === u.value}
                className={segment}
                onClick={() => set({ intervalUnit: u.value })}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </FormField>

      <FormField label="Ends">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Ends">
          {ENDS.map((e) => (
            <button
              key={e.value}
              type="button"
              aria-pressed={form.endType === e.value}
              className={`${segment} text-xs`}
              onClick={() => set({ endType: e.value })}
            >
              {e.label}
            </button>
          ))}
        </div>
      </FormField>
      {form.endType === "on_date" && (
        <DateField
          label="Last payment on or before"
          value={form.endDate}
          onChange={(endDate) => set({ endDate })}
          today={today}
          allowFuture
        />
      )}
      {form.endType === "after_count" && (
        <FormField label="Number of payments" htmlFor="rec-end-count">
          <div className="w-24">
            <input
              id="rec-end-count"
              inputMode="numeric"
              className={`${fieldClass} text-center`}
              value={form.endCount}
              onChange={(e) => set({ endCount: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </div>
        </FormField>
      )}

      {pastCount > 0 && (
        <label className="flex items-start gap-3 rounded-xl border px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-current"
            checked={form.recordPast}
            onChange={(e) => set({ recordPast: e.target.checked })}
          />
          <span>
            Also record the {pastCount} past {pastCount === 1 ? "payment" : "payments"} since{" "}
            {formatShortDay(form.startDate)}
            <span className="block text-xs text-muted-foreground">
              Leave unchecked to start from the next due date.
            </span>
          </span>
        </label>
      )}

      <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
        {preview.length === 0 ? (
          <span className="text-muted-foreground">No upcoming payments with these settings.</span>
        ) : (
          <>
            <span className="text-muted-foreground">Next: </span>
            {preview.map((d) => formatDueDate(d, today)).join(" · ")}
          </>
        )}
      </p>
    </FormSheet>
  );
}
