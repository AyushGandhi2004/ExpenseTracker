import { z } from "zod";
import { budgetUpdate } from "@/lib/validators/budgets";
import { apiRoute } from "@/server/api";
import { deleteBudget, updateBudget } from "@/server/services/budgets";

type Ctx = { params: Promise<{ id: string }> };
const id = z.uuid();

/** Change the monthly limit. Body: { amountPaise }. */
export const PATCH = apiRoute<Ctx>(async (user, request, { params }) => {
  await updateBudget(user.id, id.parse((await params).id), budgetUpdate.parse(await request.json()).amountPaise);
});

export const DELETE = apiRoute<Ctx>(async (user, _request, { params }) => {
  await deleteBudget(user.id, id.parse((await params).id));
});
