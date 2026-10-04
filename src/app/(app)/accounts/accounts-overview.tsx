"use client";

import Link from "next/link";
import { ArrowLeftRight, ChevronRight, List, Plus, Scale, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { IconBadge } from "@/components/app-icon";
import { useMoneySheets } from "@/components/money/money-sheets";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatShortDay } from "@/lib/dates";
import { formatINR } from "@/lib/money";

type AccountItem = { id: string; name: string; type: string; balancePaise: number; openingDate: string };

const TYPE_ICON: Record<string, string> = { bank: "landmark", cash: "banknote", credit_card: "credit-card", wallet: "wallet" };

export function AccountsOverview({ accounts }: { accounts: AccountItem[] }) {
  const { openAddMoney, openTransfer, openReconcile } = useMoneySheets();
  const [selected, setSelected] = useState<AccountItem | null>(null);
  const total = accounts.reduce((sum, a) => sum + a.balancePaise, 0);

  if (accounts.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        <Link href="/settings/accounts" className="font-medium text-foreground underline underline-offset-4">
          Add an account
        </Link>{" "}
        to start tracking balances.
      </p>
    );
  }

  // Close the action sheet first so only one sheet is open at a time.
  const then = (fn: () => void) => () => {
    setSelected(null);
    fn();
  };

  return (
    <>
      <section className="mb-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
        <p className="text-sm opacity-80">Total balance</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatINR(total)}</p>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" className="h-11" onClick={() => openAddMoney()}>
          <Plus />
          Add money
        </Button>
        <Button variant="outline" size="lg" className="h-11" onClick={() => openTransfer()}>
          <ArrowLeftRight />
          Transfer
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border">
        {accounts.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setSelected(a)}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
            >
              <IconBadge icon={TYPE_ICON[a.type]} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{a.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Tracking since {formatShortDay(a.openingDate)}
                </span>
              </span>
              <span className={`font-semibold tabular-nums ${a.balancePaise < 0 ? "text-destructive" : ""}`}>
                {formatINR(a.balancePaise)}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 px-2 text-center text-xs text-muted-foreground">
        Transactions dated before an account&apos;s &ldquo;tracking since&rdquo; date aren&apos;t counted; its opening
        balance already includes them. Manage accounts in{" "}
        <Link href="/settings/accounts" className="underline underline-offset-4">
          Settings
        </Link>
      </p>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>Balance {formatINR(selected.balancePaise)}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col px-2">
                <ActionRow icon={Plus} label="Add money" onClick={then(() => openAddMoney(selected.id))} />
                <ActionRow
                  icon={ArrowLeftRight}
                  label="Transfer from this account"
                  onClick={then(() => openTransfer(selected.id))}
                />
                <ActionRow
                  icon={Scale}
                  label="Set actual balance"
                  hint="Match what your bank shows"
                  onClick={then(() => openReconcile(selected))}
                />
                <Link
                  href={`/transactions?account=${selected.id}`}
                  onClick={() => setSelected(null)}
                  className="flex min-h-14 items-center gap-3 rounded-lg px-3 hover:bg-muted"
                >
                  <List className="size-5 text-muted-foreground" aria-hidden />
                  <span className="flex-1 font-medium">View transactions</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ActionRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 items-center gap-3 rounded-lg px-3 text-left hover:bg-muted">
      <Icon className="size-5 text-muted-foreground" aria-hidden />
      <span className="flex flex-1 flex-col">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </button>
  );
}
