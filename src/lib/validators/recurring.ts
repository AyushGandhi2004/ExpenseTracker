import { z } from "zod";
import { MAX_AMOUNT_PAISE } from "@/lib/validators/transactions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

const recurringFields = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(60, "Keep it under 60 characters."),
  amountPaise: z.number().int().positive("Enter an amount.").max(MAX_AMOUNT_PAISE, "That amount is too large."),
  categoryId: z.uuid("Pick a category."),
  paymentMethodId: z.uuid("Choose where it's paid from."),
  startDate: isoDate,
  intervalUnit: z.enum(["day", "month", "year"]),
  intervalCount: z.number().int().min(1, "Repeat at least every 1.").max(365, "That's too long a cycle."),
  endType: z.enum(["never", "on_date", "after_count"]).default("never"),
  endDate: isoDate.nullable().default(null),
  endCount: z.number().int().min(1).max(1000).nullable().default(null),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
});

type Fields = z.infer<typeof recurringFields>;

/** End fields must match the end type; an end date can't be before the first payment. */
function checkEnd(v: Fields, ctx: z.RefinementCtx) {
  if (v.endType === "on_date") {
    if (!v.endDate) ctx.addIssue({ code: "custom", message: "Pick an end date.", path: ["endDate"] });
    else if (v.endDate < v.startDate)
      ctx.addIssue({ code: "custom", message: "The end date is before the first payment.", path: ["endDate"] });
  }
  if (v.endType === "after_count" && !v.endCount)
    ctx.addIssue({ code: "custom", message: "Enter how many payments.", path: ["endCount"] });
}

/** Normalises end fields to exactly what the end type needs. */
const normaliseEnd = <T extends Fields>(v: T): T => ({
  ...v,
  endDate: v.endType === "on_date" ? v.endDate : null,
  endCount: v.endType === "after_count" ? v.endCount : null,
});

export const recurringInput = recurringFields
  .extend({
    /** Record payments whose dates are already in the past (first date before today). */
    recordPast: z.boolean().default(false),
  })
  .superRefine(checkEnd)
  .transform(normaliseEnd);

export const recurringUpdate = recurringFields.superRefine(checkEnd).transform(normaliseEnd);

export type RecurringInput = z.infer<typeof recurringInput>;
export type RecurringUpdate = z.infer<typeof recurringUpdate>;
