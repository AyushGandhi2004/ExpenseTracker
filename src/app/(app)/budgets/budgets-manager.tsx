"use client";

import Link from "next/link";
import { PiggyBank, Trash2 } from "lucide-react";
import { useState } from "react";
import { AddButton } from "@/components/add-button";
import { IconBadge } from "@/components/app-icon";
import { BudgetMeter, BudgetStatus } from "@/components/budgets/budget-meter";
import { ConfirmButton } from "@/components/confirm-button";
import { FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { AmountField } from "@/components/money/fields";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatMonthLabel } from "@/lib/dates";
import { formatINR, paiseToRupeesString, parseRupeesToPaise } from "@/lib/money";
import type { BudgetItem, Budgets } from "@/server/services/budgets";
import type { QuickAddOptions } from "@/server/services/quick-add";
import { addBudget, deleteBudget, updateBudget } from "./actions";

type Category = QuickAddOptions["categories"][number];

export function BudgetsManager({ budgets, categories }: { budgets: Budgets; categories: Category[] }) {
  const [sheet, setSheet] = useState<{ key: number; editing: BudgetItem | null } | null>(null);
  const [open, setOpen] = useState(false);
  const { overall, byCategory, categoryLimitsPaise, from, end } = budgets;
  const show = (editing: BudgetItem | null) => {
    setSheet((s) => ({ key: (s?.key ?? 0) + 1, editing }));
    setOpen(true);
  };
  const range = `from=${from}&to=${end}`;
  const hasAny = !!overall || byCategory.length > 0;
  const available = categories.filter((c) => !byCategory.some((b) => b.categoryId === c.id));
  const canAdd = !overall || available.length > 0;

  return (
    <>
      <PageHeader title="Budgets" backHref="/" action={canAdd ? <AddButton onClick={() => show(null)} /> : undefined} />

      {!hasAny ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center">
          <PiggyBank className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Set a monthly budget</p>
          <p className="mt-1 text-sm text-muted-foreground">
            For all your spending, or just a category like Food. It applies every month, and investments don&apos;t count.
          </p>
          <Button className="mt-4" onClick={() => show(null)}>
            Add a budget
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-2 px-1 text-sm font-medium text-muted-foreground">{formatMonthLabel(from)}</p>

          {overall ? (
            <button type="button" onClick={() => show(overall)} className="mb-4 flex w-full flex-col gap-2 rounded-2xl border px-5 py-4 text-left hover:bg-muted/60">
              <span className="text-sm text-muted-foreground">All spending</span>
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {overall.progress.state === "over" ? `${formatINR(overall.progress.overPaise)} over` : `${formatINR(overall.progress.remainingPaise)} left`}
              </span>
              <BudgetMeter progress={overall.progress} label="All spending" />
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatINR(overall.spentPaise)} of {formatINR(overall.amountPaise)} · {overall.progress.pct}%
              </span>
              {overall.progress.state !== "over" && overall.progress.perDayPaise > 0 && (
                <span className="text-sm tabular-nums">
                  {overall.progress.daysLeft === 1
                    ? "Last day of the month"
                    : `About ${formatINR(overall.progress.perDayPaise)} a day for the next ${overall.progress.daysLeft} days`}
                </span>
              )}
            </button>
          ) : (
            <button type="button" onClick={() => show(null)} className="mb-4 w-full rounded-2xl border border-dashed px-4 py-3 text-left text-sm font-medium hover:bg-muted/60">
              Add a budget for all spending
            </button>
          )}

          {byCategory.length > 0 && (
            <section aria-labelledby="category-budgets">
              <h2 id="category-budgets" className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                By category
              </h2>
              <ul className="divide-y overflow-hidden rounded-xl border">
                {byCategory.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => show(b)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60">
                      <IconBadge icon={b.categoryIcon} color={b.categoryColor} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{b.categoryName}</span>
                          <span className="shrink-0 text-sm">
                            <BudgetStatus progress={b.progress} />
                          </span>
                        </span>
                        <BudgetMeter progress={b.progress} label={b.categoryName ?? "Category"} />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatINR(b.spentPaise)} of {formatINR(b.amountPaise)} · {b.progress.pct}%
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {overall && categoryLimitsPaise > overall.amountPaise && (
            <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm">
              Your category budgets add up to {formatINR(categoryLimitsPaise)}, more than your overall {formatINR(overall.amountPaise)}.
            </p>
          )}
          <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
            The small mark on each bar shows how far through the month today is. If the bar is past it, you&apos;re spending ahead of pace.{" "}
            <Link href={`/transactions?type=expense&${range}`} className="underline">
              See this month&apos;s expenses
            </Link>
          </p>
        </>
      )}

      {sheet && (
        <BudgetSheet
          key={sheet.key}
          open={open}
          onOpenChange={setOpen}
          editing={sheet.editing}
          hasOverall={!!overall}
          categories={available}
          history={budgets.history}
        />
      )}
    </>
  );
}

function BudgetSheet({
  open,
  onOpenChange,
  editing,
  hasOverall,
  categories,
  history,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: BudgetItem | null;
  hasOverall: boolean;
  categories: Category[];
  history: Budgets["history"];
}) {
  const [target, setTarget] = useState<string>(editing ? (editing.categoryId ?? "all") : hasOverall ? (categories[0]?.id ?? "") : "all");
  const [amount, setAmount] = useState(editing ? paiseToRupeesString(editing.amountPaise) : "");
  const { pending, error, setError, run } = useAction();
  const close = () => onOpenChange(false);
  const name = editing ? (editing.categoryName ?? "All spending") : "";
  const last = history.lastMonth[target] ?? 0;
  const current = history.thisMonth[target] ?? 0;

  function submit() {
    const amountPaise = parseRupeesToPaise(amount);
    if (!amountPaise) return setError("Enter a monthly limit.");
    if (editing) run(() => updateBudget(editing.id, { amountPaise }), { success: "Budget updated", onSuccess: close });
    else if (!target) setError("Pick a category.");
    else run(() => addBudget({ categoryId: target === "all" ? null : target, amountPaise }), { success: "Budget added", onSuccess: close });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `${name} budget` : "New budget"}
      submitLabel={editing ? "Save" : "Add budget"}
      pending={pending}
      error={error}
      onSubmit={submit}
      secondaryActions={
        editing && (
          <ConfirmButton
            variant="destructive"
            className="h-10 w-full"
            disabled={pending}
            message="Removes this budget. Your transactions aren't affected."
            onConfirm={() => run(() => deleteBudget(editing.id), { success: "Budget removed", onSuccess: close })}
          >
            <Trash2 />
            Delete
          </ConfirmButton>
        )
      }
    >
      {!editing && (
        <FormField label="Budget for">
          <div role="radiogroup" aria-label="Budget for" className="flex flex-wrap gap-2">
            {!hasOverall && (
              <button
                type="button"
                role="radio"
                aria-checked={target === "all"}
                onClick={() => setTarget("all")}
                className="rounded-full border px-3 py-2 text-sm aria-checked:border-foreground aria-checked:bg-muted"
              >
                All spending
              </button>
            )}
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={target === c.id}
                onClick={() => setTarget(c.id)}
                className="flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm aria-checked:border-foreground aria-checked:bg-muted"
              >
                <IconBadge icon={c.icon} color={c.color} className="size-7 [&_svg]:size-4" />
                {c.name}
              </button>
            ))}
          </div>
        </FormField>
      )}

      <AmountField id="budget-amount" label="Monthly limit" value={amount} onChange={setAmount} autoFocus={!editing} />

      <p className="-mt-2 text-xs text-muted-foreground tabular-nums">
        This month so far {formatINR(current)} · last month {formatINR(last)}
        {last > 0 && (
          <>
            {" · "}
            <button type="button" className="underline" onClick={() => setAmount(paiseToRupeesString(last))}>
              Use last month&apos;s
            </button>
          </>
        )}
      </p>
    </FormSheet>
  );
}
