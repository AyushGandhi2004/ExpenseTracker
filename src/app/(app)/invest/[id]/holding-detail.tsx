"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, Minus, Plus, Repeat } from "lucide-react";
import { useState } from "react";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { DateField } from "@/components/money/fields";
import { pickedOf } from "@/components/invest/picked";
import { formatUnitPrice, kindLabel, Pnl, unitsLabel } from "@/components/invest/pnl";
import { TradeSheet, type TradeSheetMode } from "@/components/invest/trade-sheet";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { formatShortDay } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { HoldingDetail as Detail, HoldingView } from "@/server/services/investments";
import type { QuickAddOptions } from "@/server/services/quick-add";
import { setArchived, setManualPrice } from "../actions";

const SOURCE_LABEL = { amfi: "AMFI", yahoo: "Yahoo Finance", manual: "typed by you" } as const;
const TRADE_SOURCE = { manual: null, sip: "SIP", import: "Imported", converted: "Converted" } as const;

export function HoldingDetail({
  detail,
  options,
  holdings,
  today,
}: {
  detail: Detail;
  options: QuickAddOptions;
  holdings: HoldingView[];
  today: string;
}) {
  const { holding: h, trades } = detail;
  const [sheet, setSheet] = useState<{ key: number; mode: TradeSheetMode | "price" } | null>(null);
  const [open, setOpen] = useState(false);
  const archive = useAction();
  const picked = pickedOf(h);
  const what = unitsLabel(h.kind);
  const show = (mode: TradeSheetMode | "price") => {
    setSheet((s) => ({ key: (s?.key ?? 0) + 1, mode }));
    setOpen(true);
  };

  return (
    <>
      <PageHeader title={h.name} backHref="/invest" />

      <section className="mb-4 rounded-2xl border px-5 py-4" aria-label="Holding">
        <p className="text-xs text-muted-foreground">
          {kindLabel(h.kind)}
          {h.symbol ? ` · ${h.symbol} · ${h.exchange}` : ""}
          {h.isArchived ? " · Archived" : ""}
        </p>
        {h.quantity === "0" ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">All sold · realised profit</p>
            <Pnl paise={h.realisedPaise} className="text-3xl font-semibold tracking-tight [&_svg]:size-6" />
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Current value</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatINR(h.valuePaise ?? h.costPaise)}</p>
            <Pnl paise={h.unrealisedPaise} pct={h.unrealisedPct} className="mt-0.5 text-sm font-medium" />
          </>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Stat label={what[0].toUpperCase() + what.slice(1)} value={h.quantity} />
          <Stat label="Invested" value={formatINR(h.costPaise)} />
          <Stat label="Average cost" value={h.averagePrice ? formatUnitPrice(h.averagePrice) : "—"} />
          <Stat
            label={h.kind === "mutual_fund" ? "Latest NAV" : "Latest price"}
            value={
              h.lastPrice ? (
                <>
                  {formatUnitPrice(h.lastPrice)}
                  {h.priceDate && <span className="block text-xs font-normal text-muted-foreground">{formatShortDay(h.priceDate)}{h.priceSource ? ` · ${SOURCE_LABEL[h.priceSource]}` : ""}</span>}
                </>
              ) : (
                "—"
              )
            }
          />
          {h.realisedPaise !== 0 && h.quantity !== "0" && <Stat label="Realised profit" value={<Pnl paise={h.realisedPaise} />} />}
        </dl>
        <button type="button" onClick={() => show("price")} className="mt-3 text-sm font-medium underline-offset-2 hover:underline">
          Set price manually
        </button>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <Button size="lg" className="h-11" onClick={() => show({ kind: "new", type: "buy", instrument: picked, heldQuantity: h.quantity })}>
          <Plus /> {h.kind === "mutual_fund" ? "Invest more" : "Buy more"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11"
          disabled={h.quantity === "0"}
          onClick={() => show({ kind: "new", type: "sell", instrument: picked, heldQuantity: h.quantity })}
        >
          <Minus /> Sell
        </Button>
      </div>

      {h.kind === "mutual_fund" && (
        <Link
          href={`/recurring?new=sip&fund=${h.id}`}
          className="-mt-3 mb-6 flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium hover:bg-muted"
        >
          <Repeat className="size-4" aria-hidden /> Start a SIP in this fund
        </Link>
      )}

      <section aria-labelledby="trades-title" className="mb-6">
        <h2 id="trades-title" className="mb-2 px-1 text-sm font-medium text-muted-foreground">
          Transactions
        </h2>
        {trades.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No transactions.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {trades.map((t) => {
              const tag = TRADE_SOURCE[t.source];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => show({ kind: "edit", trade: t, instrument: picked, heldQuantity: h.quantity })}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {t.type === "buy" ? (h.kind === "mutual_fund" ? "Invested" : "Bought") : "Sold"}
                        {tag && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tag}</span>}
                        {t.unitsEstimated && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Units estimated</span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatShortDay(t.tradeDate)} · {t.quantity} {what} @ {formatUnitPrice(t.price)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t.cashTransactionId && t.accountName
                          ? t.type === "buy"
                            ? `from ${t.paymentMethodName ?? t.accountName}`
                            : `into ${t.accountName}`
                          : "Balance not changed"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {t.type === "buy" ? "−" : "+"}
                      {formatINR(t.amountPaise)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(h.quantity === "0" || h.isArchived) && (
        <>
          {archive.error && <p role="alert" className="mb-2 text-sm text-destructive">{archive.error}</p>}
          <Button
            variant="ghost"
            className="w-full"
            disabled={archive.pending}
            onClick={() => archive.run(() => setArchived(h.id, !h.isArchived), { success: h.isArchived ? "Restored" : "Archived" })}
          >
            {h.isArchived ? <ArchiveRestore /> : <Archive />}
            {h.isArchived ? "Unarchive" : "Archive (hide from portfolio)"}
          </Button>
        </>
      )}

      {sheet && sheet.mode !== "price" && (
        <TradeSheet
          key={sheet.key}
          open={open}
          onOpenChange={setOpen}
          mode={sheet.mode}
          options={options}
          holdings={holdings.map(pickedOf)}
          today={today}
        />
      )}
      {sheet && sheet.mode === "price" && (
        <PriceSheet key={sheet.key} open={open} onOpenChange={setOpen} holding={h} today={today} />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function PriceSheet({
  open,
  onOpenChange,
  holding,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: HoldingView;
  today: string;
}) {
  const [price, setPrice] = useState(holding.lastPrice ?? "");
  const [date, setDate] = useState(today);
  const { pending, error, run } = useAction();
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Set price"
      description="Used until a newer price is published automatically."
      submitLabel="Save price"
      pending={pending}
      error={error}
      onSubmit={() => run(() => setManualPrice(holding.id, { price, priceDate: date }), { success: "Price saved", onSuccess: () => onOpenChange(false) })}
    >
      <FormField label={holding.kind === "mutual_fund" ? "NAV (₹ per unit)" : "Price (₹ per share)"} htmlFor="manual-price">
        <input
          id="manual-price"
          inputMode="decimal"
          autoFocus
          className={`${fieldClass} h-14 text-2xl font-semibold tabular-nums`}
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
        />
      </FormField>
      <DateField label="Price date" value={date} onChange={setDate} today={today} />
    </FormSheet>
  );
}
