import { budgetInput } from "@/lib/validators/budgets";
import { apiRoute, json } from "@/server/api";
import { createBudget, getBudgets } from "@/server/services/budgets";

/** This month's budgets with spending and progress (amounts in paise). */
export const GET = apiRoute(async (user) => getBudgets(user.id));

/** Create. Body: { categoryId: <uuid> | null (all spending), amountPaise }. */
export const POST = apiRoute(async (user, request) => {
  const id = await createBudget(user.id, budgetInput.parse(await request.json()));
  return json({ id }, 201);
});
