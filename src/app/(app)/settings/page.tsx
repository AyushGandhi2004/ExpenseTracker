import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CreditCard, Download, Landmark, LogOut, Tags, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/server/auth";
import { listAccounts } from "@/server/services/accounts";
import { listCategories } from "@/server/services/categories";
import { listPaymentMethods } from "@/server/services/payment-methods";
import { AppearancePicker } from "./appearance";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [accounts, methods, categories] = await Promise.all([
    listAccounts(user.id),
    listPaymentMethods(user.id),
    listCategories(user.id),
  ]);
  const active = <T extends { isArchived: boolean }>(rows: T[]) => rows.filter((r) => !r.isArchived).length;

  const links: { href: string; label: string; detail: string; icon: LucideIcon }[] = [
    { href: "/settings/accounts", label: "Accounts", detail: `${active(accounts)} active`, icon: Landmark },
    { href: "/settings/payment-methods", label: "Payment methods", detail: `${active(methods)} active`, icon: CreditCard },
    { href: "/settings/categories", label: "Categories", detail: `${active(categories)} active`, icon: Tags },
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <ul className="divide-y overflow-hidden rounded-xl border">
        {links.map(({ href, label, detail, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/60">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              <span className="text-sm text-muted-foreground">{detail}</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-muted-foreground">Appearance</h2>
      <AppearancePicker />

      <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-muted-foreground">Your data</h2>
      <a
        href="/api/v1/export"
        download
        className="flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 hover:bg-muted/60"
      >
        <Download className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">Export all transactions</span>
          <span className="text-xs text-muted-foreground">CSV file for Excel or Google Sheets</span>
        </span>
      </a>

      <div className="mt-8 rounded-xl border px-4 py-3">
        <p className="text-xs text-muted-foreground">Signed in as</p>
        <p className="truncate font-medium">{user.email}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <button
            type="submit"
            className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
