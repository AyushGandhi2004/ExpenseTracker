"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

export function ReorderButtons({
  id,
  isFirst,
  isLast,
  move,
}: {
  id: string;
  isFirst: boolean;
  isLast: boolean;
  move: (id: string, direction: -1 | 1) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();

  function onMove(direction: -1 | 1) {
    startTransition(async () => {
      const result = await move(id, direction);
      if (!result.ok) toast.error(result.error);
    });
  }

  const buttonClass =
    "flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";
  return (
    <div className="flex shrink-0 flex-col" aria-busy={pending}>
      <button type="button" className={buttonClass} aria-label="Move up" disabled={isFirst || pending} onClick={() => onMove(-1)}>
        <ChevronUp className="size-4" />
      </button>
      <button type="button" className={buttonClass} aria-label="Move down" disabled={isLast || pending} onClick={() => onMove(1)}>
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
}
