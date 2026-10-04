import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Transactions" };

// Built in M5.
export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" />
      <p className="py-12 text-center text-sm text-muted-foreground">Your transaction list is coming soon.</p>
    </>
  );
}
