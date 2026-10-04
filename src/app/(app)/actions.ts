"use server";

import { z } from "zod";
import {
  expenseInput,
  expenseUpdate,
  incomeInput,
  incomeUpdate,
  reconcileInput,
  transferInput,
  transferUpdate,
} from "@/lib/validators/transactions";
import { runAction } from "@/server/action-result";
import * as txService from "@/server/services/transactions";

const id = z.uuid();

/** Quick add. Safe to retry with the same payload (idempotent on its client-generated id). */
export async function addExpense(raw: unknown) {
  return runAction((user) => txService.createExpense(user.id, expenseInput.parse(raw)));
}

export async function updateExpense(txId: string, raw: unknown) {
  return runAction((user) => txService.updateExpense(user.id, id.parse(txId), expenseUpdate.parse(raw)));
}

export async function addIncome(raw: unknown) {
  return runAction((user) => txService.createIncome(user.id, incomeInput.parse(raw)));
}

export async function updateIncome(txId: string, raw: unknown) {
  return runAction((user) => txService.updateIncome(user.id, id.parse(txId), incomeUpdate.parse(raw)));
}

export async function addTransfer(raw: unknown) {
  return runAction((user) => txService.createTransfer(user.id, transferInput.parse(raw)));
}

export async function updateTransfer(txId: string, raw: unknown) {
  return runAction((user) => txService.updateTransfer(user.id, id.parse(txId), transferUpdate.parse(raw)));
}

export async function reconcileAccount(raw: unknown) {
  return runAction((user) => txService.reconcileAccount(user.id, reconcileInput.parse(raw)));
}

export async function deleteTransaction(txId: string) {
  return runAction((user) => txService.softDeleteTransaction(user.id, id.parse(txId)));
}

export async function restoreTransaction(txId: string) {
  return runAction((user) => txService.restoreTransaction(user.id, id.parse(txId)));
}
