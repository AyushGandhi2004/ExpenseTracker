"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { convertExpense } from "@/app/(app)/invest/actions";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatShortDay } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatPrice, formatQuantity, parsePrice, parseQuantity, stampDuty, unitsFor } from "@/lib/portfolio";
import type { ConvertibleExpense } from "@/server/services/investments";
import { fetchTradePrice, type FetchedPrice } from "./fetch-price";
import { InstrumentSearch, refOf, type PickedInstrument } from "./instrument-search";
import { NotInvestmentButton } from "./not-investment-button";
import { unitsLabel } from "./pnl";

/**
 * Turns an expense filed under "Investment" into a buy: pick the expense, then the fund or
 * stock; units come from that day's NAV. The bank balance doesn't change; spending drops.
 */
export function ConvertSheet({
  open,
  onOpenChange,
  expenses,
  holdings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: ConvertibleExpense[];
  holdings: PickedInstrument[];
}) {
  const [expense, setExpense] = useState<ConvertibleExpense | null>(expenses.length === 1 ? expenses[0] : null);
  const [instrument, setInstrument] = useState<PickedInstrument | null>(null);
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("");
  const [fetched, setFetched] = useState<FetchedPrice | null>(null);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);
  const { pending, error, setError, run } = useAction();

  async function pick(p: PickedInstrument, exp: ConvertibleExpense) {
    setInstrument(p);
    setError(null);
    setLoading(true);
    const mine = ++ticket.current;
    const found = await fetchTradePrice(p, exp.txnDate);
    if (mine !== ticket.current) return;
    setLoading(false);
    setFetched(found);
    if (found) setPrice(found.price);
  }

  if (!expense) {
    return (
      <FormSheet open={open} onOpenChange={onOpenChange} title="Convert to investment" pending={false} error={error} onSubmit={() => setError("Pick an expense.")}>
        <p className="text-sm text-muted-foreground">Which of these was an investment?</p>
        <ul className="divide-y overflow-hidden rounded-xl border">
          {expenses.map((e) => (
            <li key={e.id}>
              <button type="button" className="flex w-full items-center gap-3 px-4 pt-3 pb-1 text-left hover:bg-muted/60" onClick={() => setExpense(e)}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{e.description ?? e.categoryName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatShortDay(e.txnDate)} · {e.categoryName}
                    {e.paymentMethodName ? ` · ${e.paymentMethodName}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatINR(e.amountPaise)}</span>
              </button>
              <div className="px-2 pb-2">
                <NotInvestmentButton expense={e} />
              </div>
            </li>
          ))}
        </ul>
      </FormSheet>
    );
  }

  const summary = (
    <div className="rounded-xl bg-muted px-4 py-3 text-sm">
      <p className="font-medium">
        {formatINR(expense.amountPaise)} · {expense.description ?? expense.categoryName}
      </p>
      <p className="text-muted-foreground">
        {formatShortDay(expense.txnDate)}
        {expense.paymentMethodName ? ` · ${expense.paymentMethodName}` : ""}
      </p>
    </div>
  );

  if (!instrument) {
    return (
      <FormSheet open={open} onOpenChange={onOpenChange} title="Which fund or stock?" pending={false} error={error} onSubmit={() => setError("Pick a fund or stock.")}>
        {summary}
        <InstrumentSearch holdings={holdings} onPick={(p) => void pick(p, expense)} />
      </FormSheet>
    );
  }

  const isFund = instrument.kind === "mutual_fund";
  const priceValue = parsePrice(price);
  const charges = isFund ? stampDuty(expense.amountPaise) : 0;
  const derived = priceValue ? unitsFor(expense.amountPaise - charges, priceValue, isFund ? 3 : 0) : null;
  const quantity = units.trim() ? parseQuantity(units) : derived;

  function submit() {
    if (!priceValue) return setError("Enter the price per unit.");
    if (!quantity || quantity <= 0n) return setError(`Enter the number of ${unitsLabel(instrument!.kind)}.`);
    const target = instrument!.instrumentId ? { instrumentId: instrument!.instrumentId } : { instrument: refOf(instrument!) };
    run(
      () => convertExpense({ transactionId: expense!.id, ...target, quantity: formatQuantity(quantity), price: formatPrice(priceValue) }),
      { success: "Converted to an investment", onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Convert to investment"
      description={instrument.name}
      submitLabel="Convert"
      pending={pending}
      error={error}
      onSubmit={submit}
      secondaryActions={
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setInstrument(null)}>
          Change {isFund ? "fund" : "stock"}
        </Button>
      }
    >
      {summary}
      <FormField
        label={isFund ? "NAV (₹ per unit)" : "Price (₹ per share)"}
        htmlFor="convert-price"
        hint={
          loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden /> Getting price…
            </span>
          ) : fetched ? (
            `${isFund ? "NAV" : "Close"} on ${formatShortDay(fetched.date)}${fetched.estimated ? " (latest available)" : ""}`
          ) : (
            "Price unavailable — type it in."
          )
        }
      >
        <input
          id="convert-price"
          inputMode="decimal"
          className={`${fieldClass} tabular-nums`}
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </FormField>
      <FormField
        label={isFund ? "Units" : "Shares"}
        htmlFor="convert-units"
        hint={isFund ? `After stamp duty ${formatINR(charges)}. Type the exact units from your statement if they differ.` : undefined}
      >
        <input
          id="convert-units"
          inputMode="decimal"
          className={`${fieldClass} tabular-nums`}
          placeholder={derived !== null ? formatQuantity(derived) : "0"}
          value={units}
          onChange={(e) => setUnits(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Your balance stays the same. This stops counting as spending and appears in your portfolio instead.
      </p>
    </FormSheet>
  );
}
