import { z } from "zod";
import { PRICE_DECIMALS, QTY_DECIMALS } from "@/lib/portfolio";
import { MAX_AMOUNT_PAISE } from "./transactions";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const decimal = (decimals: number, message: string) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`), message)
    .refine((v) => Number(v) > 0, message);

export const quantityText = decimal(QTY_DECIMALS, "Enter the units (up to 6 decimals).");
export const priceText = decimal(PRICE_DECIMALS, "Enter the price per unit (up to 4 decimals).");
const paise = z.number().int().min(0).max(MAX_AMOUNT_PAISE, "That amount is too large.");
const note = z
  .string()
  .trim()
  .max(200, "Keep the note under 200 characters.")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .default(null);

/** A fund or stock picked from search (created on first use). */
export const instrumentRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mutual_fund"), schemeCode: z.string().regex(/^\d{3,8}$/), name: z.string().trim().min(1).max(200) }),
  z.object({
    kind: z.literal("stock"),
    symbol: z.string().regex(/^[A-Z0-9&_.-]{1,20}$/i).transform((s) => s.toUpperCase()),
    exchange: z.enum(["NSE", "BSE"]),
    name: z.string().trim().min(1).max(200),
  }),
]);
export type InstrumentRef = z.infer<typeof instrumentRef>;

const tradeFields = z.object({
  tradeDate: isoDate,
  quantity: quantityText,
  price: priceText,
  /** Buy: total paid incl. charges. Sell: received after charges. */
  amountPaise: paise.refine((v) => v > 0, "Enter the amount."),
  chargesPaise: paise.default(0),
  /**
   * Where the cash went: buys are paid with a payment method (its account is debited);
   * sells are credited to an account. Null = holdings only, bank balance unchanged.
   */
  paymentMethodId: z.uuid().nullable().default(null),
  accountId: z.uuid().nullable().default(null),
  note,
});

export const tradeInput = tradeFields.extend({
  // Created with an id generated on the device, so retries are idempotent.
  id: z.uuid(),
  type: z.enum(["buy", "sell"]),
  instrumentId: z.uuid().optional(),
  instrument: instrumentRef.optional(),
}).refine((t) => !!t.instrumentId !== !!t.instrument, { message: "Pick a fund or stock.", path: ["instrument"] });
export const tradeUpdate = tradeFields;
export type TradeInput = z.infer<typeof tradeInput>;
export type TradeUpdate = z.infer<typeof tradeUpdate>;

export const manualPriceInput = z.object({ price: priceText, priceDate: isoDate });

export const convertExpenseInput = z
  .object({
    transactionId: z.uuid(),
    instrumentId: z.uuid().optional(),
    instrument: instrumentRef.optional(),
    quantity: quantityText,
    price: priceText,
  })
  .refine((t) => !!t.instrumentId !== !!t.instrument, { message: "Pick a fund or stock.", path: ["instrument"] });
export type ConvertExpenseInput = z.infer<typeof convertExpenseInput>;
