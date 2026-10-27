import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { listRecurring } from "@/server/services/recurring";
import { RecurringManager } from "./recurring-manager";

export const metadata: Metadata = { title: "Recurring payments" };

export default async function RecurringPage() {
  const user = await requireUser();
  const [rules, options] = await Promise.all([listRecurring(user.id), getQuickAddOptions(user.id)]);

  return (
    <RecurringManager
      rules={rules}
      categories={options.categories}
      paymentMethods={options.paymentMethods}
    />
  );
}
