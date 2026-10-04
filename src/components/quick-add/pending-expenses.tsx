"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { TransactionRow } from "@/components/transaction-row";
import { Button } from "@/components/ui/button";
import { formatDayLabel } from "@/lib/dates";
import { useQuickAdd } from "./quick-add-provider";

/** Entries saved on this device that haven't reached the server yet. */
export function PendingExpenses() {
  const { pending, syncNow, retry, discard } = useQuickAdd();
  const [syncing, setSyncing] = useState(false);
  if (pending.length === 0) return null;

  const failed = pending.filter((p) => p.status === "failed").length;

  return (
    <section aria-label="Waiting to sync" className="mb-6 overflow-hidden rounded-xl border border-amber-500/40">
      <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-sm">
        <CloudOff className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
        <span className="flex-1">
          {failed > 0
            ? `${failed} couldn't be saved`
            : `${pending.length} waiting to sync`}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            await syncNow();
            setSyncing(false);
          }}
        >
          <RefreshCw className={syncing ? "animate-spin" : ""} />
          Sync now
        </Button>
      </div>
      <ul className="divide-y">
        {pending.map((item) => (
          <li key={item.payload.id}>
            <TransactionRow
              icon={item.display.categoryIcon}
              color={item.display.categoryColor}
              title={item.payload.description ?? item.display.categoryName}
              subtitle={`${formatDayLabel(item.payload.txnDate)} · ${item.display.paymentMethodName}`}
              amountPaise={item.payload.amountPaise}
              badge={
                <span
                  className={`text-xs ${item.status === "failed" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}
                >
                  {item.status === "failed" ? "Not saved" : "Syncing…"}
                </span>
              }
            />
            {item.status === "failed" && (
              <div className="flex items-center gap-2 px-4 pb-3 text-sm">
                <p className="flex-1 text-destructive">{item.error}</p>
                <Button size="sm" variant="outline" onClick={() => retry(item.payload.id)}>
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Discard this expense? It hasn't been saved.")) discard(item.payload.id);
                  }}
                >
                  Discard
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
