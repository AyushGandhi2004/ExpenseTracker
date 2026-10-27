"use server";

import { z } from "zod";
import { recurringInput, recurringUpdate } from "@/lib/validators/recurring";
import { runAction } from "@/server/action-result";
import * as recurring from "@/server/services/recurring";

const id = z.uuid();

export async function addRecurring(raw: unknown) {
  return runAction((user) => recurring.createRecurring(user.id, recurringInput.parse(raw)));
}

export async function updateRecurring(ruleId: string, raw: unknown) {
  return runAction((user) => recurring.updateRecurring(user.id, id.parse(ruleId), recurringUpdate.parse(raw)));
}

export async function pauseRecurring(ruleId: string, paused: boolean) {
  return runAction((user) => recurring.setRecurringPaused(user.id, id.parse(ruleId), z.boolean().parse(paused)));
}

export async function deleteRecurring(ruleId: string) {
  return runAction((user) => recurring.deleteRecurring(user.id, id.parse(ruleId)));
}
