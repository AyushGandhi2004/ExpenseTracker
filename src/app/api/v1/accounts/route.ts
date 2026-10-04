import { apiRoute } from "@/server/api";
import { getAccountBalances } from "@/server/services/balances";

/** Accounts with their current balances (amounts in paise). */
export const GET = apiRoute(async (user) => ({ accounts: await getAccountBalances(user.id) }));
