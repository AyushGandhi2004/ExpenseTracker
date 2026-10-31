import type { Metadata } from "next";
import { pickedOf } from "@/components/invest/picked";
import { requireUser } from "@/server/auth";
import { listHoldings } from "@/server/services/investments";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { listRecurring } from "@/server/services/recurring";
import { RecurringManager, type RecurringStart } from "./recurring-manager";

export const metadata: Metadata = { title: "Recurring" };

/** `?new=income|sip|expense` opens the form on that type; `&fund=<id>` preselects a SIP's fund. */
export default async function RecurringPage({ searchParams }: PageProps<"/recurring">) {
  const user = await requireUser();
  const query = await searchParams;
  const [rules, options, holdings] = await Promise.all([
    listRecurring(user.id),
    getQuickAddOptions(user.id),
    listHoldings(user.id),
  ]);
  const funds = [...holdings.open, ...holdings.closed].filter((h) => h.kind === "mutual_fund");
  const fund = funds.find((h) => h.id === query.fund);
  const start: RecurringStart | null =
    query.new === "expense" || query.new === "income" || query.new === "sip"
      ? { kind: query.new, fund: fund ? pickedOf(fund) : null }
      : null;

  return <RecurringManager rules={rules} options={options} funds={funds.map(pickedOf)} start={start} />;
}
