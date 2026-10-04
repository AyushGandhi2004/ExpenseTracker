import { describe, expect, it, vi } from "vitest";
import {
  createExpenseQueue,
  QUEUE_STORAGE_KEY,
  syncExpenseQueue,
  type ExpensePayload,
  type PendingExpense,
} from "./offline-queue";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

const entry = (id: string, createdAt: number): PendingExpense => ({
  payload: {
    id,
    amountPaise: 25000,
    categoryId: "c",
    paymentMethodId: "p",
    txnDate: "2026-10-04",
    description: null,
  },
  display: { categoryName: "Food", categoryIcon: null, categoryColor: null, paymentMethodName: "UPI" },
  createdAt,
  status: "pending",
});

describe("expense queue", () => {
  it("persists entries to storage and reads them back in a new instance", () => {
    const storage = memoryStorage();
    createExpenseQueue(() => storage).add(entry("a", 1));
    expect(JSON.parse(storage.data.get(QUEUE_STORAGE_KEY)!)).toHaveLength(1);
    expect(createExpenseQueue(() => storage).getSnapshot()).toHaveLength(1);
  });

  it("adding the same id twice keeps one entry", () => {
    const queue = createExpenseQueue(() => memoryStorage());
    queue.add(entry("a", 1));
    queue.add(entry("a", 2));
    expect(queue.getSnapshot()).toHaveLength(1);
  });

  it("returns a stable snapshot until something changes", () => {
    const queue = createExpenseQueue(() => memoryStorage());
    const first = queue.getSnapshot();
    expect(queue.getSnapshot()).toBe(first);
    queue.add(entry("a", 1));
    expect(queue.getSnapshot()).not.toBe(first);
  });

  it("survives corrupt storage and missing storage", () => {
    const storage = memoryStorage();
    storage.setItem(QUEUE_STORAGE_KEY, "{not json");
    expect(createExpenseQueue(() => storage).getSnapshot()).toEqual([]);
    const noStorage = createExpenseQueue(() => null);
    noStorage.add(entry("a", 1));
    expect(noStorage.getSnapshot()).toHaveLength(1);
  });

  it("notifies subscribers", () => {
    const queue = createExpenseQueue(() => memoryStorage());
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.add(entry("a", 1));
    queue.remove("a");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("syncExpenseQueue", () => {
  it("sends oldest first and removes synced entries", async () => {
    const queue = createExpenseQueue(() => memoryStorage());
    queue.add(entry("b", 2));
    queue.add(entry("a", 1));
    const sent: string[] = [];
    const outcome = await syncExpenseQueue(queue, async (p: ExpensePayload) => {
      sent.push(p.id);
      return { ok: true };
    });
    expect(sent).toEqual(["a", "b"]);
    expect(outcome).toEqual({ synced: 2, failed: 0, offline: false });
    expect(queue.getSnapshot()).toEqual([]);
  });

  it("stops at a network error and keeps the rest", async () => {
    const queue = createExpenseQueue(() => memoryStorage());
    queue.add(entry("a", 1));
    queue.add(entry("b", 2));
    const outcome = await syncExpenseQueue(queue, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(outcome.offline).toBe(true);
    expect(queue.getSnapshot().map((i) => i.payload.id)).toEqual(["a", "b"]);
  });

  it("marks server rejections as failed, skips them next time, and continues", async () => {
    const queue = createExpenseQueue(() => memoryStorage());
    queue.add(entry("a", 1));
    queue.add(entry("b", 2));
    const outcome = await syncExpenseQueue(queue, async (p) =>
      p.id === "a" ? { ok: false, error: "Category archived" } : { ok: true },
    );
    expect(outcome).toEqual({ synced: 1, failed: 1, offline: false });
    expect(queue.getSnapshot()).toMatchObject([{ status: "failed", error: "Category archived" }]);

    const send = vi.fn();
    await syncExpenseQueue(queue, send);
    expect(send).not.toHaveBeenCalled();
  });
});
