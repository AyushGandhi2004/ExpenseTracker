import { z } from "zod";
import { expenseUpdate, incomeUpdate, transferUpdate } from "@/lib/validators/transactions";
import { apiRoute } from "@/server/api";
import * as tx from "@/server/services/transactions";

type Ctx = { params: Promise<{ id: string }> };
const id = z.uuid();
const kind = z.object({ type: z.enum(["expense", "income", "transfer"]) });

/** Update. Body: { type, ...fields } — the type must match the existing transaction. */
export const PATCH = apiRoute<Ctx>(async (user, request, { params }) => {
  const txId = id.parse((await params).id);
  const body: unknown = await request.json();
  const { type } = kind.parse(body);
  if (type === "expense") await tx.updateExpense(user.id, txId, expenseUpdate.parse(body));
  else if (type === "income") await tx.updateIncome(user.id, txId, incomeUpdate.parse(body));
  else await tx.updateTransfer(user.id, txId, transferUpdate.parse(body));
});

/** Soft delete (restorable via POST /restore). */
export const DELETE = apiRoute<Ctx>(async (user, _request, { params }) => {
  await tx.softDeleteTransaction(user.id, id.parse((await params).id));
});
