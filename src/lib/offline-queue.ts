/**
 * Durable queue of expenses waiting to reach the server.
 *
 * Every quick-add entry is written here *before* it is sent, so a dropped network,
 * a closed tab or a crash never loses it. Entries carry a client-generated id that
 * the server treats as idempotent, so retrying an entry can never create a duplicate.
 */

import type { ActionResult } from "@/lib/action-result";

export type ExpensePayload = {
  id: string;
  amountPaise: number;
  categoryId: string;
  paymentMethodId: string;
  txnDate: string;
  description: string | null;
};

export type PendingExpense = {
  payload: ExpensePayload;
  /** Names captured at entry time so the UI can show the item before it syncs. */
  display: { categoryName: string; categoryIcon: string | null; categoryColor: string | null; paymentMethodName: string };
  createdAt: number;
  /** "failed" = the server rejected it (e.g. the category was archived); needs the user. */
  status: "pending" | "failed";
  error?: string;
};

/** A new queue entry with a fresh client-side id. */
export function newPendingExpense(
  fields: Omit<ExpensePayload, "id">,
  display: PendingExpense["display"],
): PendingExpense {
  return {
    payload: { id: crypto.randomUUID(), ...fields },
    display,
    createdAt: Date.now(),
    status: "pending",
  };
}

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export const QUEUE_STORAGE_KEY = "expense-tracker:pending-expenses:v1";
const EMPTY: readonly PendingExpense[] = Object.freeze([]);

export function createExpenseQueue(getStorage: () => KeyValueStorage | null) {
  let cache: readonly PendingExpense[] | null = null;
  const listeners = new Set<() => void>();

  function read(): readonly PendingExpense[] {
    if (cache) return cache;
    try {
      const raw = getStorage()?.getItem(QUEUE_STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(parsed) ? (parsed as PendingExpense[]) : [];
    } catch {
      cache = [];
    }
    return cache;
  }

  function write(items: PendingExpense[]) {
    cache = items;
    try {
      getStorage()?.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or blocked: the in-memory copy still syncs while this page is open.
    }
    listeners.forEach((listener) => listener());
  }

  const update = (fn: (items: readonly PendingExpense[]) => PendingExpense[]) => write(fn(read()));

  return {
    getSnapshot: read,
    getServerSnapshot: () => EMPTY,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Call when another tab changed storage. */
    invalidate() {
      cache = null;
      listeners.forEach((listener) => listener());
    },
    add(item: PendingExpense) {
      update((items) => [...items.filter((i) => i.payload.id !== item.payload.id), item]);
    },
    remove(id: string) {
      update((items) => items.filter((i) => i.payload.id !== id));
    },
    markFailed(id: string, error: string) {
      update((items) => items.map((i) => (i.payload.id === id ? { ...i, status: "failed", error } : i)));
    },
    markPending(id: string) {
      update((items) =>
        items.map((i) => (i.payload.id === id ? { ...i, status: "pending", error: undefined } : i)),
      );
    },
  };
}

export type ExpenseQueue = ReturnType<typeof createExpenseQueue>;

export type SyncOutcome = { synced: number; failed: number; offline: boolean };

/**
 * Sends pending entries oldest-first. Stops at the first network error (still offline);
 * a server rejection marks that entry failed and moves on.
 */
export async function syncExpenseQueue(
  queue: ExpenseQueue,
  send: (payload: ExpensePayload) => Promise<ActionResult>,
): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { synced: 0, failed: 0, offline: false };
  const pending = queue
    .getSnapshot()
    .filter((i) => i.status === "pending")
    .toSorted((a, b) => a.createdAt - b.createdAt);

  for (const item of pending) {
    let result: ActionResult;
    try {
      result = await send(item.payload);
    } catch {
      outcome.offline = true;
      break;
    }
    if (result.ok) {
      queue.remove(item.payload.id);
      outcome.synced++;
    } else {
      queue.markFailed(item.payload.id, result.error);
      outcome.failed++;
    }
  }
  return outcome;
}
