"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { addExpense, updateExpense } from "@/app/(app)/actions";
import { deleteWithUndo } from "@/components/transactions/delete-with-undo";
import {
  createExpenseQueue,
  QUEUE_STORAGE_KEY,
  syncExpenseQueue,
  type PendingExpense,
  type SyncOutcome,
} from "@/lib/offline-queue";
import { formatINR } from "@/lib/money";
import type { QuickAddOptions } from "@/server/services/quick-add";
import { QuickAddSheet, type EditableExpense } from "./quick-add-sheet";

const RETRY_MS = 30_000;

const expenseQueue = createExpenseQueue(() => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // storage blocked (private mode etc.)
  }
});

type QuickAddContextValue = {
  openQuickAdd: () => void;
  openEditExpense: (expense: EditableExpense) => void;
  pending: readonly PendingExpense[];
  syncNow: () => Promise<SyncOutcome | null>;
  enqueue: (item: PendingExpense) => void;
  retry: (id: string) => void;
  discard: (id: string) => void;
};

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export function useQuickAdd() {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error("useQuickAdd must be used inside QuickAddProvider");
  return value;
}

export function QuickAddProvider({ options, children }: { options: QuickAddOptions; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [lastMethodId, setLastMethodId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableExpense | null>(null);
  const pending = useSyncExternalStore(
    expenseQueue.subscribe,
    expenseQueue.getSnapshot,
    expenseQueue.getServerSnapshot,
  );

  // One sync at a time; a request made mid-sync runs once more afterwards.
  const syncing = useRef<Promise<SyncOutcome> | null>(null);
  const rerun = useRef(false);

  const syncNow = useCallback(async (): Promise<SyncOutcome | null> => {
    if (syncing.current) {
      rerun.current = true;
      return null;
    }
    let outcome: SyncOutcome;
    do {
      rerun.current = false;
      syncing.current = syncExpenseQueue(expenseQueue, addExpense);
      try {
        outcome = await syncing.current;
      } finally {
        syncing.current = null;
      }
    } while (rerun.current && !outcome.offline);
    return outcome;
  }, []);

  useEffect(() => {
    void syncNow();
    const onOnline = () => void syncNow();
    const onVisible = () => document.visibilityState === "visible" && void syncNow();
    const onStorage = (e: StorageEvent) => e.key === QUEUE_STORAGE_KEY && expenseQueue.invalidate();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncNow]);

  // Retry periodically while entries wait (covers server outages, where no "online" event fires).
  const hasPending = pending.some((p) => p.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void syncNow();
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [hasPending, syncNow]);

  const enqueue = useCallback(
    (item: PendingExpense) => {
      // Persist first, then send: the entry survives even if the request never completes.
      expenseQueue.add(item);
      void syncNow().then((outcome) => {
        if (outcome?.offline) toast.info("You're offline. It will sync automatically.");
        if (outcome && outcome.failed > 0) toast.error("An expense couldn't be saved. See Home.");
      });
    },
    [syncNow],
  );

  const value = useMemo<QuickAddContextValue>(
    () => ({
      openQuickAdd: () => {
        setEditing(null);
        setSheetKey((k) => k + 1);
        setOpen(true);
      },
      openEditExpense: (expense) => {
        setEditing(expense);
        setSheetKey((k) => k + 1);
        setOpen(true);
      },
      pending,
      syncNow,
      enqueue,
      retry: (id) => {
        expenseQueue.markPending(id);
        void syncNow();
      },
      discard: (id) => expenseQueue.remove(id),
    }),
    [pending, syncNow, enqueue],
  );

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <QuickAddSheet
        key={sheetKey}
        open={open}
        onOpenChange={setOpen}
        options={options}
        initialMethodId={lastMethodId}
        onSave={(item) => {
          setLastMethodId(item.payload.paymentMethodId);
          enqueue(item);
        }}
        editing={editing}
        onUpdate={updateExpense}
        onDelete={(id) => {
          setOpen(false);
          void deleteWithUndo(id, editing ? formatINR(editing.amountPaise) : "expense");
        }}
      />
    </QuickAddContext.Provider>
  );
}
