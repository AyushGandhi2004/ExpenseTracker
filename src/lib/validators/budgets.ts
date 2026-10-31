import { z } from "zod";
import { MAX_AMOUNT_PAISE } from "./transactions";

const amountPaise = z.number().int().positive("Enter a monthly limit.").max(MAX_AMOUNT_PAISE, "That amount is too large.");

/** `categoryId: null` is the budget for all spending. */
export const budgetInput = z.object({ categoryId: z.uuid("Pick a category.").nullable(), amountPaise });
export const budgetUpdate = z.object({ amountPaise });
export type BudgetInput = z.infer<typeof budgetInput>;
