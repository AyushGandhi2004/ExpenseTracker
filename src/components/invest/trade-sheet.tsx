"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteTrade, recordTrade, restoreTrade, updateTrade } from "@/app/(app)/invest/actions";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { AmountField, DateField, NoteField } from "@/components/money/fields";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatShortDay } from "@/lib/dates";
import { formatINR, paiseToRupeesString, parseRupeesToPaise } from "@/lib/money";
import { formatPrice, formatQuantity, parsePrice, parseQuantity, stampDuty, unitsFor, valuePaise } from "@/lib/portfolio";
import type { QuickAddOptions } from "@/server/services/quick-add";
import type { TradeRow } from "@/server/services/investments";
import { fetchTradePrice, type FetchedPrice } from "./fetch-price";
import { InstrumentSearch, refOf, type PickedInstrument } from "./instrument-search";
import { formatUnitPrice, unitsLabel } from "./pnl";

export type TradeSheetMode =
  | { kind: "new"; type: "buy" | "sell"; instrument?: PickedInstrument; heldQuantity?: string }
  | { kind: "edit"; trade: TradeRow; instrument: PickedInstrument; heldQuantity: string };

export function TradeSheet({
  open,
  onOpenChange,
  mode,
  options,
  holdings,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TradeSheetMode;
  options: Pick<QuickAddOptions, "paymentMethods" | "accounts" | "defaultPaymentMethodId">;
  holdings: PickedInstrument[];
  today: string;
}) {
  const editing = mode.kind === "edit" ? mode.trade : null;
  const type = editing ? editing.type : (mode as { type: "buy" | "sell" }).type;
  const [id] = useState(() => crypto.randomUUID());
  const [instrument, setInstrument] = useState<PickedInstrument | null>(mode.instrument ?? null);
  const [date, setDate] = useState(editing?.tradeDate ?? today);
  const fundBuy = mode.instrument?.kind === "mutual_fund" && type === "buy";
  // On edit, keep a typed-looking value only if it differs from what the form would work out
  // itself — otherwise leave it blank so it follows changes to units/price.
  const [amount, setAmount] = useState(() => {
    if (!editing) return "";
    if (fundBuy) return paiseToRupeesString(editing.amountPaise);
    const gross = valuePaise(parseQuantity(editing.quantity)!, parsePrice(editing.price)!);
    const derived = type === "buy" ? gross + editing.chargesPaise : gross - editing.chargesPaise;
    return derived === editing.amountPaise ? "" : paiseToRupeesString(editing.amountPaise);
  });
  const [units, setUnits] = useState(() => {
    if (!editing) return "";
    if (!fundBuy) return editing.quantity;
    const derived = unitsFor(editing.amountPaise - editing.chargesPaise, parsePrice(editing.price)!);
    return derived === parseQuantity(editing.quantity) ? "" : editing.quantity;
  });
  const [price, setPrice] = useState(editing?.price ?? "");
  const [charges, setCharges] = useState(editing?.chargesPaise ? paiseToRupeesString(editing.chargesPaise) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(
    editing ? (editing.cashTransactionId ? (editing.paymentMethodId ?? "") : "") : (options.defaultPaymentMethodId ?? ""),
  );
  const [accountId, setAccountId] = useState(
    editing ? (editing.cashTransactionId ? (editing.accountId ?? "") : "") : (options.accounts[0]?.id ?? ""),
  );
  const [fetched, setFetched] = useState<FetchedPrice | null>(null);
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading" | "missing">(
    mode.instrument && !editing ? "loading" : "idle",
  );
  const priceTouched = useRef(!!editing);
  const priceRequest = useRef(0);
  const { pending, error, setError, run } = useAction();

  /** Fetches the NAV/price for a date; state changes only after the response (latest request wins). */
  async function fetchPrice(inst: PickedInstrument, onDate: string) {
    const ticket = ++priceRequest.current;
    const found = await fetchTradePrice(inst, onDate);
    if (ticket !== priceRequest.current) return;
    setFetched(found);
    setPriceStatus(found ? "idle" : "missing");
    if (found && !priceTouched.current) setPrice(found.price);
  }

  function loadPrice(inst: PickedInstrument, onDate: string) {
    setPriceStatus("loading");
    void fetchPrice(inst, onDate);
  }

  // Opened for a known fund/stock: fetch its price once (an edit keeps the saved price).
  useEffect(() => {
    if (mode.instrument && !editing) void fetchPrice(mode.instrument, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  if (!instrument) {
    return (
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={type === "buy" ? "Add investment" : "Sell"}
        pending={false}
        error={error}
        onSubmit={() => setError("Pick a fund or stock first.")}
      >
        <InstrumentSearch
          holdings={holdings}
          onPick={(p) => {
            setInstrument(p);
            setError(null);
            loadPrice(p, date);
          }}
        />
      </FormSheet>
    );
  }

  const isFundBuy = instrument.kind === "mutual_fund" && type === "buy";
  const what = unitsLabel(instrument.kind);
  const amountPaise = parseRupeesToPaise(amount);
  const priceValue = parsePrice(price);
  const chargesPaise = isFundBuy ? (amountPaise ? stampDuty(amountPaise) : 0) : (parseRupeesToPaise(charges) ?? 0);

  // Funds are bought by amount (units follow from the NAV); everything else by units × price.
  const derivedUnits = isFundBuy && amountPaise && priceValue ? unitsFor(amountPaise - chargesPaise, priceValue) : null;
  const quantity = units.trim() ? parseQuantity(units) : derivedUnits;
  const gross = quantity && priceValue ? valuePaise(quantity, priceValue) : null;
  const derivedAmount = !isFundBuy && gross !== null ? (type === "buy" ? gross + chargesPaise : gross - chargesPaise) : null;
  const finalAmount = isFundBuy ? amountPaise : amount.trim() ? amountPaise : derivedAmount;
  const heldNow = mode.heldQuantity ? parseQuantity(mode.heldQuantity) : null;
  // Editing a sale: its own units are back on the table.
  const held = heldNow !== null && editing?.type === "sell" ? heldNow + parseQuantity(editing.quantity)! : heldNow;

  function submit() {
    if (!quantity || quantity <= 0n) return setError(`Enter the number of ${what}.`);
    if (!priceValue) return setError("Enter the price per unit.");
    if (!finalAmount || finalAmount <= 0) return setError("Enter the amount.");
    const fields = {
      tradeDate: date,
      quantity: formatQuantity(quantity),
      price: formatPrice(priceValue),
      amountPaise: finalAmount,
      chargesPaise,
      paymentMethodId: type === "buy" ? paymentMethodId || null : null,
      accountId: type === "sell" ? accountId || null : null,
      note,
    };
    const verb = type === "buy" ? "Investment" : "Sale";
    if (editing) {
      run(() => updateTrade(editing.id, fields), { success: `${verb} updated`, onSuccess: () => onOpenChange(false) });
    } else {
      const target = instrument!.instrumentId ? { instrumentId: instrument!.instrumentId } : { instrument: refOf(instrument!) };
      run(() => recordTrade({ id, type, ...target, ...fields }), {
        success: type === "buy" ? `Added ${formatINR(finalAmount)} to ${instrument!.name}` : `Recorded sale of ${instrument!.name}`,
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  async function remove() {
    if (!editing) return;
    const result = await deleteTrade(editing.id).catch(() => null);
    if (!result?.ok) {
      setError(result?.error ?? "Couldn't reach the server. Check your connection and try again.");
      return;
    }
    onOpenChange(false);
    toast(`Deleted ${type === "buy" ? "investment" : "sale"} of ${formatINR(editing.amountPaise)}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: async () => {
          const restored = await restoreTrade(editing.id).catch(() => null);
          if (restored?.ok) toast.success("Restored");
          else toast.error(restored?.error ?? "Couldn't restore.");
        },
      },
    });
  }

  const priceHint =
    priceStatus === "loading" ? (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Getting {instrument.kind === "mutual_fund" ? "NAV" : "price"}…
      </span>
    ) : priceStatus === "missing" ? (
      "Price unavailable — type it in."
    ) : fetched ? (
      <>
        {instrument.kind === "mutual_fund" ? "NAV" : fetched.date === today ? "Price" : "Close"} {formatUnitPrice(fetched.price)} on{" "}
        {formatShortDay(fetched.date)}
        {fetched.estimated && " (latest available — correct it if needed)"}
        {price !== fetched.price && (
          <>
            {" · "}
            <button type="button" className="underline" onClick={() => setPrice(fetched.price)}>
              Use it
            </button>
          </>
        )}
      </>
    ) : null;

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? (type === "buy" ? "Edit investment" : "Edit sale") : type === "buy" ? "Add investment" : "Sell"}
      description={instrument.name}
      submitLabel={editing ? "Save" : type === "buy" ? "Add investment" : "Record sale"}
      pending={pending}
      error={error}
      onSubmit={submit}
      secondaryActions={
        editing ? (
          <Button type="button" variant="ghost" className="flex-1 text-destructive" onClick={() => void remove()}>
            <Trash2 /> Delete
          </Button>
        ) : !mode.instrument ? (
          <Button type="button" variant="ghost" className="flex-1" onClick={() => setInstrument(null)}>
            Change {instrument.kind === "mutual_fund" ? "fund" : "stock"}
          </Button>
        ) : undefined
      }
    >
      {isFundBuy ? (
        <AmountField id="trade-amount" label="Amount invested" value={amount} onChange={setAmount} autoFocus={!editing} />
      ) : (
        <FormField
          label={`${what[0].toUpperCase()}${what.slice(1)}`}
          htmlFor="trade-units"
          hint={
            type === "sell" && held !== null ? (
              <>
                You hold {formatQuantity(held)} {what}
                {held > 0n && (
                  <>
                    {" · "}
                    <button type="button" className="underline" onClick={() => setUnits(formatQuantity(held))}>
                      Sell all
                    </button>
                  </>
                )}
              </>
            ) : undefined
          }
        >
          <input
            id="trade-units"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            autoFocus={!editing}
            className={`${fieldClass} h-14 text-2xl font-semibold tabular-nums`}
            value={units}
            onChange={(e) => setUnits(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </FormField>
      )}

      <DateField
        label={type === "buy" ? "Date invested" : "Date sold"}
        value={date}
        today={today}
        onChange={(d) => {
          setDate(d);
          loadPrice(instrument, d);
        }}
      />

      <FormField label={instrument.kind === "mutual_fund" ? "NAV (₹ per unit)" : "Price (₹ per share)"} htmlFor="trade-price" hint={priceHint}>
        <input
          id="trade-price"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className={`${fieldClass} tabular-nums`}
          value={price}
          onChange={(e) => {
            priceTouched.current = true;
            setPrice(e.target.value.replace(/[^\d.]/g, ""));
          }}
        />
      </FormField>

      {isFundBuy ? (
        <FormField
          label="Units"
          htmlFor="trade-units"
          hint={
            amountPaise
              ? `Includes stamp duty ${formatINR(chargesPaise)}. Units are worked out from the NAV — type the exact units from your statement if they differ.`
              : "Worked out from the amount and NAV."
          }
        >
          <input
            id="trade-units"
            inputMode="decimal"
            autoComplete="off"
            placeholder={derivedUnits !== null ? formatQuantity(derivedUnits) : "0"}
            className={`${fieldClass} tabular-nums`}
            value={units}
            onChange={(e) => setUnits(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </FormField>
      ) : (
        <>
          <FormField label={instrument.kind === "stock" ? "Brokerage & charges" : "Exit load & charges"} htmlFor="trade-charges" hint="Optional">
            <input
              id="trade-charges"
              inputMode="decimal"
              autoComplete="off"
              placeholder="₹0"
              className={`${fieldClass} tabular-nums`}
              value={charges}
              onChange={(e) => setCharges(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </FormField>
          <FormField
            label={type === "buy" ? "Total paid" : "Amount received"}
            htmlFor="trade-amount"
            hint={type === "buy" ? "Units × price + charges, unless you type it." : "Units × price − charges, unless you type it."}
          >
            <input
              id="trade-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder={derivedAmount !== null ? `₹${paiseToRupeesString(derivedAmount)}` : "₹0"}
              className={`${fieldClass} tabular-nums`}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
          </FormField>
        </>
      )}

      {type === "buy" ? (
        <FormField label="Paid from" htmlFor="trade-from" hint={paymentMethodId ? "Deducted from that account's balance." : "Your bank balance won't change."}>
          <NativeSelect id="trade-from" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
            {options.paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (from {m.accountName})
              </option>
            ))}
            <option value="">Don&apos;t change my bank balance</option>
          </NativeSelect>
        </FormField>
      ) : (
        <FormField label="Money received in" htmlFor="trade-to" hint={accountId ? "Added to that account's balance." : "Your bank balance won't change."}>
          <NativeSelect id="trade-to" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {options.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="">Don&apos;t change my bank balance</option>
          </NativeSelect>
        </FormField>
      )}

      <NoteField id="trade-note" value={note} onChange={setNote} />
    </FormSheet>
  );
}
