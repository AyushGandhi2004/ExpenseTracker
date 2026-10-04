import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listAccounts } from "@/server/services/accounts";
import { listPaymentMethods } from "@/server/services/payment-methods";
import { PaymentMethodsManager } from "./payment-methods-manager";

export const metadata: Metadata = { title: "Payment methods" };

export default async function PaymentMethodsSettingsPage() {
  const user = await requireUser();
  const [methods, accounts] = await Promise.all([listPaymentMethods(user.id), listAccounts(user.id)]);

  return (
    <PaymentMethodsManager
      methods={methods}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name, isArchived: a.isArchived }))}
    />
  );
}
