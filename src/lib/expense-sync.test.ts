import { describe, expect, it, vi } from "vitest";
import { createExpenseSender } from "./expense-sync";
import type { ExpensePayload } from "./offline-queue";

const payload: ExpensePayload = {
  id: "7d2b8f7e-2a6b-4f4f-9a43-5f2f1c1d9e01",
  amountPaise: 25000,
  categoryId: "c",
  paymentMethodId: "p",
  txnDate: "2026-10-10",
  description: null,
};

const respond = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("createExpenseSender", () => {
  it("posts the expense to the stable REST endpoint", async () => {
    const fetchMock = respond(201, { ok: true });
    await expect(createExpenseSender(fetchMock)(payload)).resolves.toEqual({ ok: true });
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/v1/transactions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ type: "expense", ...payload });
  });

  it("returns the server's reason for a rejected entry", async () => {
    const issue = respond(400, { error: "invalid_request", issues: [{ message: "Pick a category." }] });
    await expect(createExpenseSender(issue)(payload)).resolves.toEqual({ ok: false, error: "Pick a category." });
    const userError = respond(400, { error: "That category was archived. Pick another one." });
    await expect(createExpenseSender(userError)(payload)).resolves.toEqual({
      ok: false,
      error: "That category was archived. Pick another one.",
    });
  });

  it("throws (keep queued, retry later) when signed out, on server errors and offline", async () => {
    await expect(createExpenseSender(respond(401))(payload)).rejects.toThrow();
    await expect(createExpenseSender(respond(503))(payload)).rejects.toThrow();
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(createExpenseSender(offline)(payload)).rejects.toThrow();
  });
});
