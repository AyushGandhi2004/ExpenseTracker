import type { Metadata } from "next";
import { todayIst } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { finalizeEstimatedUnits, listConvertibleExpenses, listHoldings } from "@/server/services/investments";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { listRecurring } from "@/server/services/recurring";
import { InvestManager } from "./invest-manager";

export const metadata: Metadata = { title: "Invest" };

export default async function InvestPage() {
  const user = await requireUser();
  // Settle any SIP units waiting on that day's NAV (no network unless some are).
  await finalizeEstimatedUnits(user.id);
  const [holdings, options, convertible, rules] = await Promise.all([
    listHoldings(user.id),
    getQuickAddOptions(user.id),
    listConvertibleExpenses(user.id),
    listRecurring(user.id),
  ]);
  return <InvestManager holdings={holdings} options={options} convertible={convertible} sips={rules.filter((r) => r.kind === "sip")} today={todayIst()} />;
}
