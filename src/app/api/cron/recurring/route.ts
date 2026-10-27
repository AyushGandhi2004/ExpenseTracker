import { timingSafeEqual } from "node:crypto";
import { materializeAllDue } from "@/server/services/recurring";

/**
 * Daily job (Vercel Cron, see vercel.json): records recurring payments that came due, so
 * balances are right even on days the app isn't opened. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`. Idempotent — safe to call more than once.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const authorised =
    !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!authorised) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await materializeAllDue();
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
