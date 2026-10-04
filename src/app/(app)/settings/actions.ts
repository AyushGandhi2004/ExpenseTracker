"use server";

import { z } from "zod";
import {
  accountInput,
  categoryInput,
  directionInput,
  idInput,
  paymentMethodInput,
} from "@/lib/validators/settings";
import { runAction } from "@/server/action-result";
import * as accountsService from "@/server/services/accounts";
import * as categoriesService from "@/server/services/categories";
import * as paymentMethodsService from "@/server/services/payment-methods";

const optionalId = idInput.nullable();
const SETTINGS = "/settings";
const ACCOUNTS = ["/settings/accounts", "/settings/payment-methods", SETTINGS];
const PAYMENT_METHODS = ["/settings/payment-methods", SETTINGS];
const CATEGORIES = ["/settings/categories", SETTINGS];

// ── Accounts ────────────────────────────────────────────────────────────────

export async function saveAccount(id: string | null, raw: unknown) {
  return runAction(async (user) => {
    const accountId = optionalId.parse(id);
    const input = accountInput.parse(raw);
    if (accountId) await accountsService.updateAccount(user.id, accountId, input);
    else await accountsService.createAccount(user.id, input);
  }, ACCOUNTS);
}

export async function archiveAccount(id: string, archived: boolean) {
  return runAction(
    (user) => accountsService.setAccountArchived(user.id, idInput.parse(id), z.boolean().parse(archived)),
    ACCOUNTS,
  );
}

export async function deleteAccount(id: string) {
  return runAction((user) => accountsService.deleteAccount(user.id, idInput.parse(id)), ACCOUNTS);
}

export async function moveAccount(id: string, direction: -1 | 1) {
  return runAction(
    (user) => accountsService.moveAccount(user.id, idInput.parse(id), directionInput.parse(direction)),
    ACCOUNTS,
  );
}

// ── Payment methods ─────────────────────────────────────────────────────────

export async function savePaymentMethod(id: string | null, raw: unknown) {
  return runAction(async (user) => {
    const methodId = optionalId.parse(id);
    const input = paymentMethodInput.parse(raw);
    if (methodId) await paymentMethodsService.updatePaymentMethod(user.id, methodId, input);
    else await paymentMethodsService.createPaymentMethod(user.id, input);
  }, PAYMENT_METHODS);
}

export async function archivePaymentMethod(id: string, archived: boolean) {
  return runAction(
    (user) =>
      paymentMethodsService.setPaymentMethodArchived(user.id, idInput.parse(id), z.boolean().parse(archived)),
    PAYMENT_METHODS,
  );
}

export async function deletePaymentMethod(id: string) {
  return runAction((user) => paymentMethodsService.deletePaymentMethod(user.id, idInput.parse(id)), PAYMENT_METHODS);
}

export async function movePaymentMethod(id: string, direction: -1 | 1) {
  return runAction(
    (user) => paymentMethodsService.movePaymentMethod(user.id, idInput.parse(id), directionInput.parse(direction)),
    PAYMENT_METHODS,
  );
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function saveCategory(id: string | null, raw: unknown) {
  return runAction(async (user) => {
    const categoryId = optionalId.parse(id);
    const input = categoryInput.parse(raw);
    if (categoryId) await categoriesService.updateCategory(user.id, categoryId, input);
    else await categoriesService.createCategory(user.id, input);
  }, CATEGORIES);
}

export async function archiveCategory(id: string, archived: boolean) {
  return runAction(
    (user) => categoriesService.setCategoryArchived(user.id, idInput.parse(id), z.boolean().parse(archived)),
    CATEGORIES,
  );
}

export async function deleteCategory(id: string) {
  return runAction((user) => categoriesService.deleteCategory(user.id, idInput.parse(id)), CATEGORIES);
}

export async function moveCategory(id: string, direction: -1 | 1) {
  return runAction(
    (user) => categoriesService.moveCategory(user.id, idInput.parse(id), directionInput.parse(direction)),
    CATEGORIES,
  );
}
