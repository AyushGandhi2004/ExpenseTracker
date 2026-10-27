import type { ActionResult } from "@/lib/action-result";
import type { ExpensePayload } from "@/lib/offline-queue";

/**
 * Sends a queued expense to the stable REST endpoint.
 *
 * Deliberately not a Server Action: action IDs are tied to a build, so an installed app
 * still running an older version would get "Failed to find Server Action" after a deploy
 * and its queued expenses would never sync. A fixed URL works across versions.
 *
 * - 2xx            → saved (creates are idempotent on payload.id, so retries are safe)
 * - 400            → rejected; the user must act (shown with Retry/Discard)
 * - network / 401 / 5xx → thrown, so the entry stays queued and is retried later
 */
export function createExpenseSender(fetchImpl: typeof fetch = (...args) => fetch(...args)) {
  return async (payload: ExpensePayload): Promise<ActionResult> => {
    const response = await fetchImpl("/api/v1/transactions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "expense", ...payload }),
    });
    if (response.ok) return { ok: true };
    if (response.status === 400) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: { message?: string }[];
      };
      return { ok: false, error: body.issues?.[0]?.message ?? body.error ?? "Couldn't save this expense." };
    }
    throw new Error(`Sync failed with HTTP ${response.status}`);
  };
}
