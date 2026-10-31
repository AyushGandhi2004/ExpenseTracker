import { timingSafeEqual } from "node:crypto";
import { finalizeEstimatedUnits } from "@/server/services/investments";
import { refreshPrices } from "@/server/services/prices";
import { materializeAllDue } from "@/server/services/recurring";

/**
 * Daily job (Vercel Cron, see vercel.json): records recurring payments, credits and SIPs that came due, so
 * balances are right even on days the app isn't opened, then settles SIP units and refreshes
 * every holding's NAV/price. Vercel sends `Authorization: Bearer $CRON_SECRET`. Idempotent — safe to call
 * more than once.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorised =
    !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!authorised) return Response.json({ error: "unauthorized" }, { status: 401 });

  const recurring = await materializeAllDue();
  // A price-feed outage must not fail the job (payments above are already recorded).
  const prices = await finalizeEstimatedUnits(null)
    .then(() => refreshPrices(null, { force: true }))
    .catch((error: unknown) => {
    console.error("[cron] price refresh failed", error);
    return { error: "price refresh failed" };
  });
  return Response.json({ ok: true, recurring, prices }, { headers: { "Cache-Control": "no-store" } });
}
