import { apiRoute } from "@/server/api";
import { refreshPrices } from "@/server/services/prices";

/** Fetch latest NAVs/prices for your holdings (skips ones checked in the last 15 minutes). */
export const POST = apiRoute(async (user) => refreshPrices(user.id));
