"use client";

import { Delete } from "lucide-react";
import type { AmountKey } from "@/lib/amount-input";

const KEYS: AmountKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

/** Phone-style number pad; avoids the system keyboard covering the sheet. */
export function AmountKeypad({ onKey }: { onKey: (key: AmountKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Amount keypad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          aria-label={key === "back" ? "Delete digit" : key === "." ? "Decimal point" : key}
          className="flex h-10 items-center justify-center rounded-xl bg-muted/60 text-xl font-medium tabular-nums transition-colors select-none hover:bg-muted active:bg-muted-foreground/20"
        >
          {key === "back" ? <Delete className="size-5" aria-hidden /> : key}
        </button>
      ))}
    </div>
  );
}
