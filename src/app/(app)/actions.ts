"use server";

import { expenseInput } from "@/lib/validators/transactions";
import { runAction } from "@/server/action-result";
import { createExpense } from "@/server/services/transactions";

/** Quick add. Safe to retry with the same payload (idempotent on its client-generated id). */
export async function addExpense(raw: unknown) {
  return runAction((user) => createExpense(user.id, expenseInput.parse(raw)));
}
