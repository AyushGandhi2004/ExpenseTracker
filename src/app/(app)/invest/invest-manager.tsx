"use client";

import Link from "next/link";
import { ChevronRight, RefreshCw, Repeat, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AddButton } from "@/components/add-button";
import { ConvertSheet } from "@/components/invest/convert-sheet";
import { pickedOf } from "@/components/invest/picked";
import { formatUnitPrice, kindLabel, Pnl, unitsLabel } from "@/components/invest/pnl";
import { TradeSheet } from "@/components/invest/trade-sheet";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatDueDate, formatShortDay } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { describeInterval, monthlyEquivalent } from "@/lib/recurrence";
import type { ConvertibleExpense, HoldingView, Holdings } from "@/server/services/investments";
import type { QuickAddOptions } from "@/server/services/quick-add";
import type { RecurringRow } from "@/server/services/recurring";
import { refreshAllPrices } from "./actions";

export function InvestManager({
  holdings,
  options,
  convertible,
  sips,
  today,
}: {
  holdings: Holdings;
  options: QuickAddOptions;
  convertible: ConvertibleExpense[];
  sips: RecurringRow[];
  today: string;
}) {
  const [sheet, setSheet] = useState<{ key: number; open: boolean; kind: "trade" | "convert" }>({ key: 0, open: false, kind: "trade" });
  const [refreshing, startRefresh] = useTransition();
  const { open: openHoldings, closed, summary } = holdings;
  const picks = [...openHoldings, ...closed].map(pickedOf);
  const hasAny = openHoldings.length > 0 || closed.length > 0;

  const show = (kind: "trade" | "convert") => setSheet((s) => ({ key: s.key + 1, open: true, kind }));

  function refresh() {
    startRefresh(async () => {
      try {
        const r = await refreshAllPrices();
        if (r.failed > 0) toast.error("Some prices couldn't be fetched. The last known prices are shown.");
        else if (r.checked === 0) toast("Prices are already up to date.");
        else toast.success(r.updated > 0 ? "Prices updated" : "No newer prices yet");
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <PageHeader title="Invest" action={<AddButton onClick={() => show("trade")} />} />

      {convertible.length > 0 && (
        <button
          type="button"
          onClick={() => show("convert")}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed px-4 py-3 text-left hover:bg-muted/60"
        >
          <TrendingUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">
              {convertible.length === 1 ? "1 expense looks like an investment" : `${convertible.length} expenses look like investments`}
            </span>
            <span className="text-xs text-muted-foreground">Convert so it counts in your portfolio, not your spending</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}

      {!hasAny ? (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center">
          <TrendingUp className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Track your mutual funds and stocks</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add what you bought — NAVs and share prices update automatically, and investing isn&apos;t counted as spending.
          </p>
          <Button className="mt-4" onClick={() => show("trade")}>
            Add investment
          </Button>
          <Link href="/recurring?new=sip" className="mt-3 block text-sm font-medium underline-offset-2 hover:underline">
            Or start a SIP
          </Link>
        </div>
      ) : (
        <>
          <section className="mb-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground" aria-label="Portfolio">
            <p className="text-sm opacity-80">Current value</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatINR(summary.valuePaise)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="opacity-80">Invested</dt>
                <dd className="font-medium tabular-nums">{formatINR(summary.costPaise)}</dd>
              </div>
              <div>
                <dt className="opacity-80">Profit / loss</dt>
                <dd className="font-medium">
                  <PnlOnPrimary paise={summary.unrealisedPaise} pct={summary.unrealisedPct} />
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-primary-foreground/20 pt-2 text-xs opacity-90">
              <span>{summary.pricesAsOf ? `Prices as of ${formatShortDay(summary.pricesAsOf)}` : "No prices yet"}</span>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="-mr-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2 font-medium hover:bg-primary-foreground/10 disabled:opacity-60"
              >
                <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </section>

          <Allocation fundsPaise={summary.byKind.mutual_fund} stocksPaise={summary.byKind.stock} />

          <Sips sips={sips} today={today} />

          {openHoldings.length > 0 && (
            <section aria-labelledby="holdings-title" className="mb-6">
              <h2 id="holdings-title" className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                Holdings
              </h2>
              <ul className="divide-y overflow-hidden rounded-xl border">
                {openHoldings.map((h) => (
                  <li key={h.id}>
                    <HoldingRow holding={h} today={today} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {closed.length > 0 && (
            <section aria-labelledby="closed-title" className="mb-6">
              <h2 id="closed-title" className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                Sold / archived
              </h2>
              <ul className="divide-y overflow-hidden rounded-xl border">
                {closed.map((h) => (
                  <li key={h.id}>
                    <Link href={`/invest/${h.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/60">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{h.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {h.isArchived && h.quantity !== "0" ? "Archived" : "Sold"} · {kindLabel(h.kind)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end text-sm">
                        <span className="text-xs text-muted-foreground">Realised</span>
                        <Pnl paise={h.realisedPaise} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
            Fund NAVs come from AMFI; share prices from Yahoo Finance and may be delayed. Profit is based on average cost.
          </p>
        </>
      )}

      {sheet.open && sheet.kind === "trade" && (
        <TradeSheet
          key={sheet.key}
          open
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
          mode={{ kind: "new", type: "buy" }}
          options={options}
          holdings={picks}
          today={today}
        />
      )}
      {sheet.open && sheet.kind === "convert" && (
        <ConvertSheet
          key={sheet.key}
          open
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
          expenses={convertible}
          holdings={picks}
        />
      )}
    </>
  );
}

/** P&L on the dark summary card: same arrow + sign, in the card's own colours. */
function PnlOnPrimary({ paise, pct }: { paise: number; pct: string | null }) {
  const sign = paise > 0 ? "+" : paise < 0 ? "−" : "";
  return (
    <span className="tabular-nums">
      <span aria-hidden>{paise > 0 ? "▲ " : paise < 0 ? "▼ " : ""}</span>
      <span className="sr-only">{paise > 0 ? "Gain " : paise < 0 ? "Loss " : ""}</span>
      {sign}
      {formatINR(Math.abs(paise))}
      {pct && <span className="opacity-80"> ({pct})</span>}
    </span>
  );
}

/** Active SIPs with their monthly total; managing them happens on the Recurring screen. */
function Sips({ sips, today }: { sips: RecurringRow[]; today: string }) {
  const running = sips.filter((s) => !s.isPaused && s.nextDueDate);
  const total = running.reduce((sum, s) => sum + monthlyEquivalent(s.amountPaise, s.intervalUnit, s.intervalCount), 0);
  return (
    <section aria-labelledby="sips-title" className="mb-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 id="sips-title" className="text-sm font-medium text-muted-foreground">
          SIPs{running.length > 0 && ` · about ${formatINR(Math.round(total / 100) * 100)} a month`}
        </h2>
        <Link href="/recurring?new=sip" className="text-sm font-medium hover:underline">
          Start a SIP
        </Link>
      </div>
      {sips.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {sips.map((s) => (
            <li key={s.id}>
              <Link href="/recurring" className={`flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/60 ${s.isPaused || !s.nextDueDate ? "opacity-60" : ""}`}>
                <Repeat className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{s.instrumentName ?? s.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {describeInterval(s.intervalUnit, s.intervalCount, s.monthEnd)}
                    {s.isPaused ? " · Paused" : s.nextDueDate ? ` · next ${formatDueDate(s.nextDueDate, today)}` : " · Ended"}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(s.amountPaise)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HoldingRow({ holding: h, today }: { holding: HoldingView; today: string }) {
  const stale = h.priceDate && h.priceDate < today && daysBetween(h.priceDate, today) > 4;
  return (
    <Link href={`/invest/${h.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/60">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{h.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {h.quantity} {unitsLabel(h.kind)}
          {h.kind === "stock" && h.exchange ? ` · ${h.exchange}` : ""}
          {h.lastPrice ? ` · ${formatUnitPrice(h.lastPrice)}` : ""}
          {stale ? " · price old" : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="font-semibold tabular-nums">{formatINR(h.valuePaise ?? h.costPaise)}</span>
        <Pnl paise={h.unrealisedPaise} pct={h.unrealisedPct} showAmount={false} className="text-xs" />
      </span>
    </Link>
  );
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Mutual funds vs stocks as one stacked bar, each labelled with its value and share. */
function Allocation({ fundsPaise, stocksPaise }: { fundsPaise: number; stocksPaise: number }) {
  const total = fundsPaise + stocksPaise;
  if (total <= 0) return null;
  const parts = [
    { label: "Mutual funds", value: fundsPaise, color: "bg-viz-3" },
    { label: "Stocks", value: stocksPaise, color: "bg-viz-5" },
  ].filter((p) => p.value > 0);
  return (
    <section aria-label="Allocation" className="mb-6 rounded-2xl border px-4 py-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) => (
          <div key={p.label} className={p.color} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${p.color}`} aria-hidden />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-medium tabular-nums">
              {formatINR(p.value)} · {Math.round((p.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
