import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/auth";
import { getAccountBalances } from "@/server/services/balances";
import { AccountsOverview } from "./accounts-overview";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await requireUser();
  const balances = await getAccountBalances(user.id);

  return (
    <>
      <PageHeader title="Accounts" />
      <AccountsOverview
        accounts={balances
          .filter((a) => !a.isArchived)
          .map((a) => ({ id: a.id, name: a.name, type: a.type, balancePaise: a.balancePaise, openingDate: a.openingDate }))}
      />
    </>
  );
}
