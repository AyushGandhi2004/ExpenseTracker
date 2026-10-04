import { z } from "zod";

/** Up to ₹99,99,99,999.99 — far above any single personal expense, well inside safe integers. */
export const MAX_AMOUNT_PAISE = 99_99_99_999_99;

const amount = z
  .number()
  .int()
  .positive("Enter an amount.")
  .max(MAX_AMOUNT_PAISE, "That amount is too large.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const note = z
  .string()
  .trim()
  .max(200, "Keep the note under 200 characters.")
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

const expenseFields = z.object({
  amountPaise: amount,
  categoryId: z.uuid("Pick a category."),
  paymentMethodId: z.uuid("Pick how you paid."),
  txnDate: isoDate,
  description: note,
});
// Created with an id generated on the device, so offline retries are idempotent.
export const expenseInput = expenseFields.extend({ id: z.uuid() });
export const expenseUpdate = expenseFields;
export type ExpenseInput = z.infer<typeof expenseInput>;
export type ExpenseUpdate = z.infer<typeof expenseUpdate>;

const incomeFields = z.object({
  amountPaise: amount,
  accountId: z.uuid("Choose an account."),
  categoryId: z.uuid("Pick a category."),
  txnDate: isoDate,
  description: note,
});
export const incomeInput = incomeFields.extend({ id: z.uuid() });
export const incomeUpdate = incomeFields;
export type IncomeInput = z.infer<typeof incomeInput>;
export type IncomeUpdate = z.infer<typeof incomeUpdate>;

const transferFields = z.object({
  amountPaise: amount,
  fromAccountId: z.uuid("Choose where the money comes from."),
  toAccountId: z.uuid("Choose where the money goes."),
  txnDate: isoDate,
  description: note,
});
const differentAccounts = (t: { fromAccountId: string; toAccountId: string }) => t.fromAccountId !== t.toAccountId;
const differentAccountsError = { message: "Pick two different accounts.", path: ["toAccountId"] };
export const transferInput = transferFields.extend({ id: z.uuid() }).refine(differentAccounts, differentAccountsError);
export const transferUpdate = transferFields.refine(differentAccounts, differentAccountsError);
export type TransferInput = z.infer<typeof transferInput>;
export type TransferUpdate = z.infer<typeof transferUpdate>;

export const reconcileInput = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  // The real balance may legitimately be negative (overdraft) or zero.
  actualBalancePaise: z.number().int().min(-MAX_AMOUNT_PAISE).max(MAX_AMOUNT_PAISE),
});
export type ReconcileInput = z.infer<typeof reconcileInput>;

/** Transactions list filters, read leniently from the URL. */
export const transactionFilters = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  method: z.uuid().optional().catch(undefined),
  account: z.uuid().optional().catch(undefined),
  type: z.enum(["expense", "income", "transfer", "adjustment"]).optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  limit: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});
export type TransactionFilters = z.infer<typeof transactionFilters>;
