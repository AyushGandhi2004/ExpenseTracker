"use client";

import Link from "next/link";
import { ChevronRight, NotebookPen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppIcon, IconBadge } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { applyAmountKey, formatAmountInput, type AmountKey } from "@/lib/amount-input";
import { todayIst } from "@/lib/dates";
import { formatINR, parseRupeesToPaise } from "@/lib/money";
import { newPendingExpense, type PendingExpense } from "@/lib/offline-queue";
import { MAX_AMOUNT_PAISE } from "@/lib/validators/transactions";
import type { QuickAddOptions } from "@/server/services/quick-add";
import { AmountKeypad } from "./amount-keypad";
import { CalendarView } from "./calendar-view";
import { DateChooser } from "./date-chooser";
import { PaymentMethodList, paymentMethodIcon } from "./payment-method-list";

export function QuickAddSheet({
  open,
  onOpenChange,
  options,
  initialMethodId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: QuickAddOptions;
  /** The provider remounts this sheet (new `key`) on every open, so state starts fresh. */
  initialMethodId: string | null;
  onSave: (item: PendingExpense) => void;
}) {
  const [view, setView] = useState<"main" | "method" | "date">("main");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState(() =>
    initialMethodId && options.paymentMethods.some((m) => m.id === initialMethodId)
      ? initialMethodId
      : options.defaultPaymentMethodId,
  );
  const [today] = useState(todayIst);
  const [txnDate, setTxnDate] = useState(today);
  const [note, setNote] = useState("");

  // Hardware keyboard support (desktop, or a phone with a keyboard attached).
  useEffect(() => {
    if (!open || view !== "main") return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const key: AmountKey | null = /^[0-9.]$/.test(e.key)
        ? (e.key as AmountKey)
        : e.key === "Backspace"
          ? "back"
          : null;
      if (!key) return;
      setAmount((value) => applyAmountKey(value, key));
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, view]);

  const amountPaise = parseRupeesToPaise(amount) ?? 0;
  const category = options.categories.find((c) => c.id === categoryId);
  const method = options.paymentMethods.find((m) => m.id === methodId);
  const missing =
    amountPaise <= 0 ? "Enter an amount" : !category ? "Pick a category" : !method ? "Choose how you paid" : null;

  function save() {
    if (missing || !category || !method) return;
    if (amountPaise > MAX_AMOUNT_PAISE) {
      toast.error("That amount is too large.");
      return;
    }
    onSave(
      newPendingExpense(
        {
          amountPaise,
          categoryId: category.id,
          paymentMethodId: method.id,
          txnDate,
          description: note.trim() || null,
        },
        {
          categoryName: category.name,
          categoryIcon: category.icon,
          categoryColor: category.color,
          paymentMethodName: method.name,
        },
      ),
    );
    toast.success(`Added ${formatINR(amountPaise)} · ${category.name}`);
    onOpenChange(false);
  }

  const noMethods = options.paymentMethods.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto flex max-h-[92dvh] max-w-lg flex-col gap-0 rounded-t-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
        <SheetTitle className="sr-only">Add expense</SheetTitle>

        {noMethods ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Add a payment method in{" "}
            <Link
              href="/settings/payment-methods"
              onClick={() => onOpenChange(false)}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Settings
            </Link>{" "}
            first.
          </p>
        ) : view === "method" ? (
          <PaymentMethodList
            methods={options.paymentMethods}
            selectedId={methodId}
            onBack={() => setView("main")}
            onSelect={(id) => {
              setMethodId(id);
              setView("main");
            }}
          />
        ) : view === "date" ? (
          <CalendarView
            value={txnDate}
            today={today}
            onBack={() => setView("main")}
            onSelect={(date) => {
              setTxnDate(date);
              setView("main");
            }}
          />
        ) : (
          <>
            {/* Scrollable top: amount, category, details */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-1 pb-3">
              <output
                aria-live="polite"
                aria-label="Amount"
                className="flex items-baseline justify-center gap-1 tabular-nums"
              >
                <span className="text-2xl text-muted-foreground">₹</span>
                <span
                  className={`text-[2.75rem] leading-tight font-semibold tracking-tight ${amount === "" ? "text-muted-foreground/40" : ""}`}
                >
                  {formatAmountInput(amount)}
                </span>
              </output>

              <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-1">
                {options.categories.map((c) => {
                  const selected = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCategoryId(c.id)}
                      className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl border-2 px-1 py-1 text-xs transition-colors ${
                        selected ? "bg-muted/60" : "border-transparent hover:bg-muted/40"
                      }`}
                      style={selected ? { borderColor: c.color ?? "currentColor" } : undefined}
                    >
                      <IconBadge icon={c.icon} color={c.color} className="size-8 [&_svg]:size-4" />
                      <span className="w-full truncate text-center">{c.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="divide-y rounded-xl border">
                <button
                  type="button"
                  onClick={() => setView("method")}
                  className="flex min-h-13 w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
                >
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">Paid with</span>
                  <AppIcon name={method ? paymentMethodIcon(method.kind) : null} className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {method?.name ?? "Choose…"}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
                <div className="px-2 py-2">
                  <DateChooser
                    value={txnDate}
                    today={today}
                    onChange={setTxnDate}
                    onPickDate={() => setView("date")}
                  />
                </div>
                <label className="flex min-h-13 items-center gap-3 px-3 py-2">
                  <span className="w-16 shrink-0 text-sm text-muted-foreground">Note</span>
                  <input
                    placeholder="Optional"
                    maxLength={200}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    enterKeyHint="done"
                    className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
                  />
                  <NotebookPen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </label>
              </div>
            </div>

            {/* Pinned bottom: keypad and save */}
            <div className="flex shrink-0 flex-col gap-2 border-t px-4 pt-3">
              <AmountKeypad onKey={(key) => setAmount((value) => applyAmountKey(value, key))} />
              <Button size="lg" className="h-12 w-full text-base" disabled={!!missing} onClick={save}>
                {missing ?? `Save ${formatINR(amountPaise)}`}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
