"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/** Runs server actions with pending state, an inline error, and a success toast. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>, options: { success?: string; onSuccess?: () => void } = {}) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (options.success) toast.success(options.success);
        options.onSuccess?.();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return { pending, error, setError, run };
}
