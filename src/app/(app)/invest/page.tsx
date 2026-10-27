import type { Metadata } from "next";
import { todayIst } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { listConvertibleExpenses, listHoldings } from "@/server/services/investments";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { InvestManager } from "./invest-manager";

export const metadata: Metadata = { title: "Invest" };

export default async function InvestPage() {
  const user = await requireUser();
  const [holdings, options, convertible] = await Promise.all([
    listHoldings(user.id),
    getQuickAddOptions(user.id),
    listConvertibleExpenses(user.id),
  ]);
  return <InvestManager holdings={holdings} options={options} convertible={convertible} today={todayIst()} />;
}
