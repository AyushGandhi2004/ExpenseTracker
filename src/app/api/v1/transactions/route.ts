import { z } from "zod";
import { expenseInput, incomeInput, transactionFilters, transferInput } from "@/lib/validators/transactions";
import { apiRoute, json, queryOf } from "@/server/api";
import * as tx from "@/server/services/transactions";

/** List with the same filters as the web app: ?q, category, method, account, type, from, to, limit. */
export const GET = apiRoute((user, request) => tx.listTransactions(user.id, transactionFilters.parse(queryOf(request))));

const kind = z.object({ type: z.enum(["expense", "income", "transfer"]) });

/**
 * Create. Body: { type: "expense" | "income" | "transfer", id: <uuid you generate>, ...fields }.
 * Idempotent on `id`, so retries are safe.
 */
export const POST = apiRoute(async (user, request) => {
  const body: unknown = await request.json();
  const { type } = kind.parse(body);
  if (type === "expense") await tx.createExpense(user.id, expenseInput.parse(body));
  else if (type === "income") await tx.createIncome(user.id, incomeInput.parse(body));
  else await tx.createTransfer(user.id, transferInput.parse(body));
  return json({ ok: true }, 201);
});
