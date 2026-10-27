import { z } from "zod";
import { formatPrice } from "@/lib/portfolio";
import { apiRoute, queryOf } from "@/server/api";
import { priceForTrade } from "@/server/services/prices";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mutual_fund"), schemeCode: z.string().regex(/^\d{3,8}$/), date: isoDate }),
  z.object({ kind: z.literal("stock"), symbol: z.string().min(1).max(20), exchange: z.enum(["NSE", "BSE"]), date: isoDate }),
]);

/**
 * The price for a trade on `date`: a fund's NAV for that day (or the next published one),
 * a stock's close (or live price today). `{ price: "89.30", date, estimated }` or `{ price: null }`.
 */
export const GET = apiRoute(async (_user, request) => {
  const q = query.parse(queryOf(request));
  const found = await priceForTrade(
    q.kind === "mutual_fund"
      ? { kind: q.kind, schemeCode: q.schemeCode, symbol: null, exchange: null }
      : { kind: q.kind, schemeCode: null, symbol: q.symbol.toUpperCase(), exchange: q.exchange },
    q.date,
  );
  return found ? { price: formatPrice(found.price), date: found.date, estimated: found.estimated } : { price: null };
});
