import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getAccountBalances } from "@/server/services/balances";
import { AccountsManager } from "./accounts-manager";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsSettingsPage() {
  const user = await requireUser();
  const accounts = await getAccountBalances(user.id);

  return (
    <AccountsManager
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        openingBalancePaise: a.openingBalancePaise,
        balancePaise: a.balancePaise,
        openingDate: a.openingDate,
        isArchived: a.isArchived,
      }))}
    />
  );
}
