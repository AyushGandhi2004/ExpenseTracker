import { recurringInput } from "@/lib/validators/recurring";
import { apiRoute, json } from "@/server/api";
import { createRecurring, listRecurring } from "@/server/services/recurring";

/** Recurring payments with their next due date (amounts in paise). */
export const GET = apiRoute(async (user) => ({ recurring: await listRecurring(user.id) }));

/** Create. Body: name, amountPaise, categoryId, paymentMethodId, startDate, intervalUnit, intervalCount, end…, recordPast. */
export const POST = apiRoute(async (user, request) => {
  const id = await createRecurring(user.id, recurringInput.parse(await request.json()));
  return json({ id }, 201);
});
