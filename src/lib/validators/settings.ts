import { z } from "zod";
import { CATEGORY_COLORS, ICON_NAMES } from "@/lib/icon-names";
import { parseRupeesToPaise } from "@/lib/money";

const name = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(40, "Keep it under 40 characters.");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

/** Rupee text from an input ("1,23,456.50") → integer paise. */
const rupees = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const paise = parseRupeesToPaise(value === "" ? "0" : value);
    if (paise === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 12500 or 12500.50." });
      return z.NEVER;
    }
    return paise;
  });

// Phase 1 offers bank and cash; credit cards and wallets arrive in Phase 2.
export const ACCOUNT_TYPE_OPTIONS = [
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
] as const;

export const PAYMENT_METHOD_KIND_OPTIONS = [
  { value: "upi", label: "UPI" },
  { value: "debit_card", label: "Debit card" },
  { value: "net_banking", label: "Net banking" },
  { value: "cash", label: "Cash" },
] as const;

export const accountInput = z.object({
  name,
  type: z.enum(["bank", "cash"]),
  openingBalancePaise: rupees,
  openingDate: isoDate,
});
export type AccountInput = z.infer<typeof accountInput>;

export const paymentMethodInput = z.object({
  name,
  kind: z.enum(["upi", "debit_card", "net_banking", "cash"]),
  accountId: z.uuid("Choose an account."),
  icon: z.enum(ICON_NAMES).nullable().default(null),
});
export type PaymentMethodInput = z.infer<typeof paymentMethodInput>;

export const categoryInput = z.object({
  name,
  kind: z.enum(["expense", "income"]),
  icon: z.enum(ICON_NAMES),
  color: z.enum(CATEGORY_COLORS),
});
export type CategoryInput = z.infer<typeof categoryInput>;

export const idInput = z.uuid();
export const directionInput = z.union([z.literal(-1), z.literal(1)]);

/** Default icon for a payment method kind when none is chosen. */
export const PAYMENT_KIND_ICON = {
  upi: "smartphone",
  debit_card: "credit-card",
  net_banking: "globe",
  cash: "banknote",
  credit_card: "credit-card",
  wallet: "wallet",
} as const;
