import { z } from "zod";

/** Up to ₹99,99,99,999.99 — far above any single personal expense, well inside safe integers. */
export const MAX_AMOUNT_PAISE = 99_99_99_999_99;

export const expenseInput = z.object({
  // Generated on the device so offline retries are idempotent.
  id: z.uuid(),
  amountPaise: z
    .number()
    .int()
    .positive("Enter an amount.")
    .max(MAX_AMOUNT_PAISE, "That amount is too large."),
  categoryId: z.uuid("Pick a category."),
  paymentMethodId: z.uuid("Pick how you paid."),
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  description: z
    .string()
    .trim()
    .max(200, "Keep the note under 200 characters.")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
});
export type ExpenseInput = z.infer<typeof expenseInput>;
