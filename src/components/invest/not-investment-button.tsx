"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setNotInvestment } from "@/app/(app)/invest/actions";
import { Button } from "@/components/ui/button";
import type { ConvertibleExpense } from "@/server/services/investments";

/** Keeps the expense as spending and stops suggesting it, with a short Undo. */
export function NotInvestmentButton({ expense }: { expense: ConvertibleExpense }) {
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      const result = await setNotInvestment(expense.id, true).catch(() => null);
      if (!result?.ok) {
        toast.error(result?.error ?? "Couldn't reach the server. Check your connection and try again.");
        return;
      }
      toast(`Kept ${expense.description ?? expense.categoryName} as an expense`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const undone = await setNotInvestment(expense.id, false).catch(() => null);
            if (!undone?.ok) toast.error(undone?.error ?? "Couldn't undo. Check your connection and try again.");
          },
        },
      });
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" className="h-9 text-muted-foreground" disabled={pending} onClick={dismiss}>
      Not an investment
    </Button>
  );
}
