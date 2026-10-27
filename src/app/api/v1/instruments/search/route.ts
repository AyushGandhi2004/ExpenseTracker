import { z } from "zod";
import { apiRoute, queryOf } from "@/server/api";
import { searchFunds, searchStocks } from "@/server/services/prices";

const query = z.object({ kind: z.enum(["mutual_fund", "stock"]), q: z.string().trim().min(2).max(80) });

/** Fund (mfapi) or NSE/BSE stock (Yahoo) search. `?kind=mutual_fund|stock&q=…` */
export const GET = apiRoute(async (_user, request) => {
  const { kind, q } = query.parse(queryOf(request));
  return { results: kind === "mutual_fund" ? await searchFunds(q) : await searchStocks(q) };
});
