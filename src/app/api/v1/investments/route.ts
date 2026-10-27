import { tradeInput } from "@/lib/validators/investments";
import { apiRoute, json } from "@/server/api";
import { listHoldings, recordTrade } from "@/server/services/investments";

/** Holdings (open + closed) and portfolio totals. Units/prices are decimal strings, cash in paise. */
export const GET = apiRoute(async (user) => listHoldings(user.id));

/**
 * Record a buy/sell. Body: { id: <uuid>, type, instrumentId | instrument: {kind, schemeCode|symbol+exchange, name},
 * tradeDate, quantity, price, amountPaise, chargesPaise?, paymentMethodId? (buy), accountId? (sell), note? }.
 * Idempotent on `id`.
 */
export const POST = apiRoute(async (user, request) => {
  const result = await recordTrade(user.id, tradeInput.parse(await request.json()));
  return json(result, 201);
});
