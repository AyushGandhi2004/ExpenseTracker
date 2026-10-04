"use client";

import { Plus } from "lucide-react";
import { useQuickAdd } from "./quick-add-provider";

/** Floating "+" above the bottom navigation, on every app screen. */
export function QuickAddFab() {
  const { openQuickAdd } = useQuickAdd();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40">
      <div className="mx-auto flex max-w-lg justify-end px-4">
        <button
          type="button"
          onClick={openQuickAdd}
          aria-label="Add expense"
          className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="size-7" aria-hidden />
        </button>
      </div>
    </div>
  );
}
