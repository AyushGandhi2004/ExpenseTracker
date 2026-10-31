"use client";

import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddButton } from "@/components/add-button";
import { IconBadge } from "@/components/app-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { InstrumentSearch, refOf, type PickedInstrument } from "@/components/invest/instrument-search";
import { AmountField, DateField } from "@/components/money/fields";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { INCOME_TEMPLATES, matchCategory, RECURRING_TEMPLATES, type RecurringTemplate } from "@/components/recurring/templates";
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
import type { QuickAddOptions } from "@/server/services/quick-add";
import type { RecurringRow } from "@/server/services/recurring";
import { addRecurring, deleteRecurring, pauseRecurring, updateRecurring } from "./actions";

type Kind = RecurringRow["kind"];
export type RecurringStart = { kind: Kind; fund: PickedInstrument | null };

type FormState = {
  kind: Kind;
  name: string;
  amount: string;
  categoryId: string;
  paymentMethodId: string;
  accountId: string;
  fund: PickedInstrument | null;
  startDate: string;
  intervalUnit: IntervalUnit;
  intervalCount: string;
  monthEnd: boolean;
  endType: EndType;
  endDate: string;
  endCount: string;
  recordPast: boolean;
};

const KINDS: { value: Kind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "sip", label: "SIP" },
];
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
/** How each kind is worded in the form. */
const WORDS: Record<Kind, { one: string; many: string; first: string; title: string; placeholder: string }> = {
  expense: { one: "payment", many: "payments", first: "First payment", title: "recurring payment", placeholder: "e.g. Medical insurance" },
  income: { one: "credit", many: "credits", first: "First credit", title: "recurring income", placeholder: "e.g. Salary" },
  sip: { one: "instalment", many: "instalments", first: "First instalment", title: "SIP", placeholder: "" },
};

const segment =
  "flex h-10 flex-1 items-center justify-center rounded-md text-sm aria-pressed:bg-background aria-pressed:font-medium aria-pressed:shadow-sm";

const monthly = (rows: RecurringRow[]) =>
  rows.reduce((sum, r) => sum + monthlyEquivalent(r.amountPaise, r.intervalUnit, r.intervalCount), 0);
const roundRupees = (paise: number) => Math.round(paise / 100) * 100;

export function RecurringManager({
  rules,
  options,
  funds,
  start,
}: {
  rules: RecurringRow[];
  options: QuickAddOptions;
  funds: PickedInstrument[];
  start: RecurringStart | null;
}) {
  const [today] = useState(todayIst);
  const [open, setOpen] = useState(!!start);
  const [key, setKey] = useState(0);
  const [editing, setEditing] = useState<RecurringRow | null>(null);

  const active = rules.filter((r) => !r.isPaused && r.nextDueDate);
  const monthlyOut = monthly(active.filter((r) => r.kind === "expense"));
  const monthlySip = monthly(active.filter((r) => r.kind === "sip"));
  const monthlyIn = monthly(active.filter((r) => r.kind === "income"));
  const next = active[0];

  const openSheet = (rule: RecurringRow | null) => {
    setEditing(rule);
    setKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <>
      <PageHeader title="Recurring" backHref="/" action={<AddButton onClick={() => openSheet(null)} />} />

      {rules.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center">
          <Repeat className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Automate what repeats</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Salary, rent, insurance, subscriptions, SIPs… Add them once and each one is recorded on its date.
          </p>
          <Button className="mt-4" onClick={() => openSheet(null)}>
            Add recurring
          </Button>
        </div>
      ) : (
        <>
          <section className="mb-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground" aria-label="Summary">
            <p className="text-sm opacity-80">Each month, about</p>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: "Comes in", value: monthlyIn },
                { label: "Goes out", value: monthlyOut },
                { label: "SIPs", value: monthlySip },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="text-xs opacity-80">{s.label}</dt>
                  <dd className="truncate text-lg font-semibold tracking-tight tabular-nums">{formatINR(roundRupees(s.value))}</dd>
                </div>
              ))}
            </dl>
            {next?.nextDueDate && (
              <p className="mt-2 text-sm opacity-80">
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
                    <IconBadge icon={r.kind === "sip" ? "invest" : r.categoryIcon} color={r.categoryColor} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.name}</span>
                        {r.kind === "sip" && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">SIP</span>
                        )}
                        {(r.isPaused || ended) && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {r.isPaused ? "Paused" : "Ended"}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-sm text-muted-foreground">
                        {describeInterval(r.intervalUnit, r.intervalCount, r.monthEnd)} ·{" "}
                        {r.kind === "income" ? `into ${r.accountName}` : r.paymentMethodName}
                      </span>
                      {r.nextDueDate && !r.isPaused && (
                        <span className="truncate text-xs text-muted-foreground">Next {formatDueDate(r.nextDueDate, today)}</span>
                      )}
                    </span>
                    <span className={`shrink-0 font-semibold tabular-nums ${r.kind === "income" ? "text-viz-good" : ""}`}>
                      {r.kind === "income" ? "+" : ""}
                      {formatINR(r.amountPaise)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
            Each one is recorded on its date and updates the account&apos;s balance. If an amount differs one month, edit that
            transaction.
          </p>
        </>
      )}

      {open && (
        <RecurringSheet
          key={key}
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          start={editing ? null : start}
          options={options}
          funds={funds}
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
  start,
  options,
  funds,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RecurringRow | null;
  start: RecurringStart | null;
  options: QuickAddOptions;
  funds: PickedInstrument[];
  today: string;
}) {
  const defaultMethod = (options.paymentMethods.find((m) => m.kind !== "cash") ?? options.paymentMethods[0])?.id ?? "";
  const defaultCategory = (kind: Kind) =>
    kind === "income"
      ? (matchCategory(["Salary"], options.incomeCategories)?.id ?? "")
      : (matchCategory(["Bills"], options.categories)?.id ?? "");

  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          kind: editing.kind,
          name: editing.name,
          amount: paiseToRupeesString(editing.amountPaise),
          categoryId: editing.categoryId ?? "",
          paymentMethodId: editing.paymentMethodId ?? defaultMethod,
          accountId: editing.accountId,
          fund: null,
          startDate: editing.startDate,
          intervalUnit: editing.intervalUnit,
          intervalCount: String(editing.intervalCount),
          monthEnd: editing.monthEnd,
          endType: editing.endType,
          endDate: editing.endDate ?? today,
          endCount: editing.endCount ? String(editing.endCount) : "12",
          recordPast: false,
        }
      : {
          kind: start?.kind ?? "expense",
          name: start?.fund?.name ?? "",
          amount: "",
          categoryId: defaultCategory(start?.kind ?? "expense"),
          paymentMethodId: defaultMethod,
          accountId: options.accounts[0]?.id ?? "",
          fund: start?.fund ?? null,
          startDate: today,
          intervalUnit: "month",
          intervalCount: "1",
          monthEnd: false,
          endType: "never",
          endDate: today,
          endCount: "12",
          recordPast: false,
        },
  );
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const { pending, error, setError, run } = useAction();
  const words = WORDS[form.kind];

  // Keep the rule's own category/method/account selectable even if archived since.
  const baseCategories = form.kind === "income" ? options.incomeCategories : options.categories;
  const categories =
    editing?.categoryId && !baseCategories.some((c) => c.id === editing.categoryId)
      ? [
          ...baseCategories,
          { id: editing.categoryId, name: editing.categoryName ?? "Category", icon: editing.categoryIcon, color: editing.categoryColor },
        ]
      : baseCategories;
  const methods =
    editing?.paymentMethodId && !options.paymentMethods.some((m) => m.id === editing.paymentMethodId)
      ? [
          ...options.paymentMethods,
          {
            id: editing.paymentMethodId,
            name: editing.paymentMethodName ?? "Payment method",
            kind: editing.paymentMethodKind ?? "upi",
            accountName: editing.accountName,
          },
        ]
      : options.paymentMethods;
  const accounts =
    editing && !options.accounts.some((a) => a.id === editing.accountId)
      ? [...options.accounts, { id: editing.accountId, name: editing.accountName, type: "bank" }]
      : options.accounts;

  const count = Number.parseInt(form.intervalCount, 10);
  const endCount = Number.parseInt(form.endCount, 10);
  const monthEnd = form.intervalUnit === "month" && form.monthEnd;
  const schedule: Schedule | null =
    count >= 1 && count <= 365
      ? {
          startDate: form.startDate,
          intervalUnit: form.intervalUnit,
          intervalCount: count,
          monthEnd,
          endType: form.endType,
          endDate: form.endType === "on_date" ? form.endDate : null,
          endCount: form.endType === "after_count" && endCount >= 1 ? endCount : null,
        }
      : null;
  const pastCount = !editing && schedule ? countOccurrencesBefore(schedule, today) : 0;
  const preview = schedule ? upcomingDates(schedule, countOccurrencesBefore(schedule, today), 3) : [];
  const templates = form.kind === "income" ? INCOME_TEMPLATES : form.kind === "expense" ? RECURRING_TEMPLATES : [];

  function applyTemplate(t: RecurringTemplate) {
    set({
      name: t.name,
      intervalUnit: t.intervalUnit,
      intervalCount: String(t.intervalCount),
      monthEnd: !!t.monthEnd,
      categoryId: matchCategory(t.categories, baseCategories)?.id ?? form.categoryId,
    });
  }

  function submit() {
    const amountPaise = parseRupeesToPaise(form.amount);
    if (form.kind === "sip" && !editing && !form.fund) return setError("Pick a fund.");
    if (!amountPaise) return setError("Enter an amount.");
    if (!schedule) return setError("Repeat every 1 to 365.");
    const fund = form.kind === "sip" && !editing ? form.fund : null;
    const payload = {
      kind: form.kind,
      name: form.name,
      amountPaise,
      categoryId: form.kind === "sip" ? null : form.categoryId || null,
      paymentMethodId: form.kind === "income" ? null : form.paymentMethodId || null,
      accountId: form.kind === "income" ? form.accountId || null : null,
      instrumentId: fund?.instrumentId ?? null,
      instrument: fund && !fund.instrumentId ? refOf(fund) : undefined,
      startDate: form.startDate,
      intervalUnit: form.intervalUnit,
      intervalCount: count,
      monthEnd,
      endType: form.endType,
      endDate: form.endType === "on_date" ? form.endDate : null,
      endCount: form.endType === "after_count" ? (Number.isFinite(endCount) ? endCount : null) : null,
    };
    run(
      () =>
        editing
          ? updateRecurring(editing.id, payload)
          : addRecurring({ ...payload, recordPast: pastCount > 0 && form.recordPast }),
      { success: editing ? "Saved" : `Added ${form.name || words.title}`, onSuccess: () => onOpenChange(false) },
    );
  }

  const close = () => onOpenChange(false);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${words.title}` : `New ${words.title}`}
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
              className="h-10 flex-1 self-end"
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
            <ConfirmButton
              variant="destructive"
              className="h-10 w-full"
              disabled={pending}
              message={`Deletes "${editing.name}". Anything already recorded is kept.`}
              onConfirm={() => run(() => deleteRecurring(editing.id), { success: "Deleted", onSuccess: close })}
            >
              <Trash2 />
              Delete
            </ConfirmButton>
          </>
        )
      }
    >
      {!editing && (
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Type">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={form.kind === k.value}
              className={segment}
              onClick={() =>
                set({ kind: k.value, name: k.value === "sip" ? (form.fund?.name ?? "") : "", categoryId: defaultCategory(k.value), monthEnd: false })
              }
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {form.kind === "sip" &&
        (editing ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm font-medium">{editing.instrumentName}</p>
        ) : form.fund ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
            <span className="min-w-0 flex-1 text-sm font-medium">{form.fund.name}</span>
            <button type="button" className="shrink-0 text-sm underline" onClick={() => set({ fund: null, name: "" })}>
              Change
            </button>
          </div>
        ) : (
          <InstrumentSearch fundsOnly holdings={funds} onPick={(fund) => set({ fund, name: fund.name })} />
        ))}

      {!editing && templates.length > 0 && (
        <FormField label="Quick pick">
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.name}
                type="button"
                aria-pressed={form.name === t.name}
                onClick={() => applyTemplate(t)}
                className="rounded-full border px-3 py-1.5 text-sm aria-pressed:border-foreground aria-pressed:bg-muted"
              >
                {t.name}
                <span className="text-muted-foreground"> · {t.monthEnd ? "month end" : shortInterval(t.intervalUnit, t.intervalCount)}</span>
              </button>
            ))}
          </div>
        </FormField>
      )}

      {form.kind !== "sip" && (
        <FormField label="Name" htmlFor="rec-name">
          <input
            id="rec-name"
            className={fieldClass}
            placeholder={words.placeholder}
            maxLength={60}
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            autoComplete="off"
          />
        </FormField>
      )}

      <AmountField id="rec-amount" value={form.amount} onChange={(amount) => set({ amount })} />
      {editing && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Changes apply from the next {words.one}; {words.many} already recorded stay as they are.
        </p>
      )}

      {form.kind !== "sip" && (
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
      )}

      {form.kind === "income" ? (
        <FormField label="Credit to" htmlFor="rec-account">
          <NativeSelect id="rec-account" value={form.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      ) : (
        <FormField label="Pay from" htmlFor="rec-method">
          <NativeSelect id="rec-method" value={form.paymentMethodId} onChange={(e) => set({ paymentMethodId: e.target.value })}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (from {m.accountName})
              </option>
            ))}
          </NativeSelect>
        </FormField>
      )}

      <DateField label={words.first} value={form.startDate} onChange={(startDate) => set({ startDate })} today={today} allowFuture />

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

      {form.intervalUnit === "month" && (
        <label className="flex items-center gap-3 rounded-xl border px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-current"
            checked={form.monthEnd}
            onChange={(e) => set({ monthEnd: e.target.checked })}
          />
          Always on the last day of the month
        </label>
      )}

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
          label={`Last ${words.one} on or before`}
          value={form.endDate}
          onChange={(endDate) => set({ endDate })}
          today={today}
          allowFuture
        />
      )}
      {form.endType === "after_count" && (
        <FormField label={`Number of ${words.many}`} htmlFor="rec-end-count">
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
            Also record the {pastCount} past {pastCount === 1 ? words.one : words.many} since {formatShortDay(form.startDate)}
            <span className="block text-xs text-muted-foreground">Leave unchecked to start from the next due date.</span>
          </span>
        </label>
      )}

      <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
        {preview.length === 0 ? (
          <span className="text-muted-foreground">Nothing upcoming with these settings.</span>
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
