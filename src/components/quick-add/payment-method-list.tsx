"use client";

import { Check, ChevronLeft } from "lucide-react";
import { AppIcon } from "@/components/app-icon";
import { paymentMethodIcon } from "@/lib/validators/settings";
import type { QuickAddOptions } from "@/server/services/quick-add";

type Method = QuickAddOptions["paymentMethods"][number];

/** Full-height list shown inside the quick-add sheet when choosing how you paid. */
export function PaymentMethodList({
  methods,
  selectedId,
  onSelect,
  onBack,
}: {
  methods: Method[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-2 pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <h2 className="text-base font-semibold">Paid with</h2>
      </div>
      <ul role="listbox" aria-label="Payment method" className="min-h-0 flex-1 divide-y overflow-y-auto border-t">
        {methods.map((m) => {
          const selected = m.id === selectedId;
          return (
            <li key={m.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <AppIcon name={paymentMethodIcon(m.kind)} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{m.name}</span>
                  <span className="truncate text-sm text-muted-foreground">from {m.accountName}</span>
                </span>
                {selected && <Check className="size-5 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
