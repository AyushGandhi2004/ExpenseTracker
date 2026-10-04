"use client";

import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { NativeSelect } from "@/components/native-select";
import { CalendarView } from "@/components/quick-add/calendar-view";
import { formatShortDay, presetRange, todayIst, type RangePreset } from "@/lib/dates";
import type { TransactionFilters } from "@/lib/validators/transactions";

type Option = { id: string; name: string; isArchived: boolean };
type Options = {
  categories: (Option & { kind: "expense" | "income" })[];
  methods: Option[];
  accounts: Option[];
};

const TYPES = [
  { value: undefined, label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Money in" },
  { value: "transfer", label: "Transfers" },
] as const;

const PERIODS: { value: RangePreset; label: string }[] = [
  { value: "this-week", label: "This week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
];

function buildQuery(filters: TransactionFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "limit" && value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function TransactionsToolbar({ filters, options }: { filters: TransactionFilters; options: Options }) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, startNavigation] = useTransition();
  const [q, setQ] = useState(filters.q ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);

  const apply = (next: TransactionFilters) =>
    startNavigation(() => router.replace(`${pathname}${buildQuery(next)}`, { scroll: false }));

  // Debounced search: update the URL 300ms after typing stops.
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  function onSearch(value: string) {
    setQ(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => apply({ ...filters, q: value.trim() || undefined }), 300);
  }

  const nameOf = (list: Option[], id?: string) => list.find((o) => o.id === id)?.name;
  const chips: { label: string; clear: Partial<TransactionFilters> }[] = [];
  if (filters.type) chips.push({ label: TYPES.find((t) => t.value === filters.type)?.label ?? "Adjustments", clear: { type: undefined } });
  if (filters.from || filters.to) {
    const preset = PERIODS.find((p) => {
      const r = presetRange(p.value);
      return r.from === filters.from && r.to === filters.to;
    });
    chips.push({
      label:
        preset?.label ??
        `${filters.from ? formatShortDay(filters.from) : "Start"} – ${filters.to ? formatShortDay(filters.to) : "Today"}`,
      clear: { from: undefined, to: undefined },
    });
  }
  if (filters.category) chips.push({ label: nameOf(options.categories, filters.category) ?? "Category", clear: { category: undefined } });
  if (filters.method) chips.push({ label: nameOf(options.methods, filters.method) ?? "Payment method", clear: { method: undefined } });
  if (filters.account) chips.push({ label: nameOf(options.accounts, filters.account) ?? "Account", clear: { account: undefined } });

  return (
    <div className="mb-4 flex flex-col gap-2" aria-busy={navigating}>
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search transactions</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            placeholder="Search notes or categories"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            enterKeyHint="search"
            className="h-11 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setSheetKey((k) => k + 1);
            setSheetOpen(true);
          }}
          aria-label={chips.length ? `Filters (${chips.length} active)` : "Filters"}
          className="relative flex size-11 shrink-0 items-center justify-center rounded-lg border hover:bg-muted"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {chips.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
              {chips.length}
            </span>
          )}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => apply({ ...filters, ...chip.clear })}
              className="flex items-center gap-1 rounded-full bg-muted py-1 pr-2 pl-3 text-sm hover:bg-muted-foreground/15"
              aria-label={`Remove filter ${chip.label}`}
            >
              {chip.label}
              <X className="size-3.5" aria-hidden />
            </button>
          ))}
          {chips.length > 1 && (
            <button type="button" onClick={() => apply({ q: filters.q })} className="px-2 text-sm text-muted-foreground hover:underline">
              Clear all
            </button>
          )}
        </div>
      )}

      <FilterSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        options={options}
        onApply={(next) => {
          setSheetOpen(false);
          apply({ ...next, q: filters.q });
        }}
      />
    </div>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  filters,
  options,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TransactionFilters;
  options: Options;
  onApply: (filters: TransactionFilters) => void;
}) {
  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const [calendar, setCalendar] = useState<"from" | "to" | null>(null);
  const [today] = useState(todayIst);
  const set = (patch: Partial<TransactionFilters>) => setDraft((d) => ({ ...d, ...patch }));

  const activePeriod = PERIODS.find((p) => {
    const r = presetRange(p.value, today);
    return r.from === draft.from && r.to === draft.to;
  })?.value;
  const custom = !activePeriod && (draft.from || draft.to);

  const segment =
    "rounded-full border px-3 py-1.5 text-sm whitespace-nowrap aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background";
  const select = (id: string, value: string | undefined, onChange: (v: string | undefined) => void, list: Option[], all: string) => (
    <NativeSelect id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{all}</option>
      {list.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
          {o.isArchived ? " (archived)" : ""}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter transactions"
      submitLabel="Show results"
      pending={false}
      error={null}
      onSubmit={() => onApply(draft)}
      secondaryActions={
        <button
          type="button"
          onClick={() => setDraft({})}
          className="h-10 flex-1 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Reset filters
        </button>
      }
    >
      <FormField label="Type">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t.label} type="button" aria-pressed={draft.type === t.value} className={segment} onClick={() => set({ type: t.value })}>
              {t.label}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Period">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!draft.from && !draft.to}
            className={segment}
            onClick={() => {
              set({ from: undefined, to: undefined });
              setCalendar(null);
            }}
          >
            All time
          </button>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={activePeriod === p.value}
              className={segment}
              onClick={() => {
                set(presetRange(p.value, today));
                setCalendar(null);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["from", "to"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={calendar === side}
              onClick={() => setCalendar((c) => (c === side ? null : side))}
              className={`flex h-11 items-center gap-2 rounded-lg border px-3 text-left text-sm aria-pressed:border-foreground ${custom ? "border-foreground/50" : ""}`}
            >
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="text-xs text-muted-foreground">{side === "from" ? "From" : "To"}</span>
                <span className="font-medium">
                  {draft[side] ? formatShortDay(draft[side]!) : side === "from" ? "Any date" : "Today"}
                </span>
              </span>
            </button>
          ))}
        </div>
        {calendar && (
          <div className="rounded-xl border py-2">
            <CalendarView
              key={calendar}
              value={draft[calendar] ?? today}
              today={today}
              onSelect={(d) => {
                // Keep the range valid: picking a "from" after "to" (or vice versa) moves the other end.
                if (calendar === "from") set({ from: d, to: draft.to && draft.to < d ? d : draft.to });
                else set({ to: d, from: draft.from && draft.from > d ? d : draft.from });
                setCalendar(null);
              }}
            />
          </div>
        )}
      </FormField>

      <FormField label="Category" htmlFor="filter-category">
        <NativeSelect id="filter-category" value={draft.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })}>
          <option value="">All categories</option>
          {(["expense", "income"] as const).map((kind) => (
            <optgroup key={kind} label={kind === "expense" ? "Expense" : "Income"}>
              {options.categories
                .filter((c) => c.kind === kind)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isArchived ? " (archived)" : ""}
                  </option>
                ))}
            </optgroup>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Payment method" htmlFor="filter-method">
        {select("filter-method", draft.method, (v) => set({ method: v }), options.methods, "All payment methods")}
      </FormField>
      <FormField label="Account" htmlFor="filter-account">
        {select("filter-account", draft.account, (v) => set({ account: v }), options.accounts, "All accounts")}
      </FormField>
    </FormSheet>
  );
}
