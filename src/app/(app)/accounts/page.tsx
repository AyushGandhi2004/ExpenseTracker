import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Accounts" };

// Balances, add money, transfers and reconcile are built in M5.
export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" />
      <p className="py-12 text-center text-sm text-muted-foreground">
        Balances are coming soon. Meanwhile, set up your accounts in{" "}
        <Link href="/settings/accounts" className="font-medium text-foreground underline underline-offset-4">
          Settings
        </Link>
        .
      </p>
    </>
  );
}
