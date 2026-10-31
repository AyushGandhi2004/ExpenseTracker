"use server";

import { z } from "zod";
import { budgetInput, budgetUpdate } from "@/lib/validators/budgets";
import { runAction } from "@/server/action-result";
import * as budgets from "@/server/services/budgets";

const id = z.uuid();

export async function addBudget(raw: unknown) {
  return runAction((user) => budgets.createBudget(user.id, budgetInput.parse(raw)));
}

export async function updateBudget(budgetId: string, raw: unknown) {
  return runAction((user) => budgets.updateBudget(user.id, id.parse(budgetId), budgetUpdate.parse(raw).amountPaise));
}

export async function deleteBudget(budgetId: string) {
  return runAction((user) => budgets.deleteBudget(user.id, id.parse(budgetId)));
}
