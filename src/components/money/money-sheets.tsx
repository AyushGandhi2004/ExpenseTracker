"use client";

import { ArrowDownUp, Trash2 } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  addIncome,
  addTransfer,
  reconcileAccount,
  updateIncome,
  updateTransfer,
} from "@/app/(app)/actions";
import { IconBadge } from "@/components/app-icon";
import { FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { NativeSelect } from "@/components/native-select";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { deleteWithUndo } from "@/components/transactions/delete-with-undo";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { reconcileDifference } from "@/lib/balance";
import { formatDayLabel, todayIst } from "@/lib/dates";
import { formatINR, paiseToRupeesString, parseRupeesToPaise } from "@/lib/money";
import type { QuickAddOptions } from "@/server/services/quick-add";
import type { TransactionListItem } from "@/server/services/transactions";
import { AmountField, DateField, NoteField } from "./fields";

type Sheet =
  | { kind: "income"; editing?: TransactionListItem; accountId?: string }
  | { kind: "transfer"; editing?: TransactionListItem; fromAccountId?: string }
  | { kind: "reconcile"; account: { id: string; name: string; balancePaise: number } }
  | { kind: "adjustment"; tx: TransactionListItem };

type MoneySheetsValue = {
  openAddMoney: (accountId?: string) => void;
  openTransfer: (fromAccountId?: string) => void;
  openReconcile: (account: { id: string; name: string; balancePaise: number }) => void;
  /** Opens the right editor for any transaction. */
  openTransaction: (tx: TransactionListItem) => void;
};

const MoneySheetsContext = createContext<MoneySheetsValue | null>(null);

export function useMoneySheets() {
  const value = useContext(MoneySheetsContext);
  if (!value) throw new Error("useMoneySheets must be used inside MoneySheetsProvider");
  return value;
}

export function MoneySheetsProvider({ options, children }: { options: QuickAddOptions; children: ReactNode }) {
  const { openEditExpense } = useQuickAdd();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  const value = useMemo<MoneySheetsValue>(() => {
    const show = (next: Sheet) => {
      setSheet(next);
      setKey((k) => k + 1);
      setOpen(true);
    };
    return {
      openAddMoney: (accountId) => show({ kind: "income", accountId }),
      openTransfer: (fromAccountId) => show({ kind: "transfer", fromAccountId }),
      openReconcile: (account) => show({ kind: "reconcile", account }),
      openTransaction: (tx) => {
        switch (tx.type) {
          case "expense":
            openEditExpense({
              id: tx.id,
              amountPaise: tx.amountPaise,
              txnDate: tx.txnDate,
              description: tx.description,
              category: {
                id: tx.categoryId!,
                name: tx.categoryName ?? "Category",
                icon: tx.categoryIcon,
                color: tx.categoryColor,
              },
              paymentMethod: {
                id: tx.paymentMethodId!,
                name: tx.paymentMethodName ?? "Payment method",
                kind: tx.paymentMethodKind ?? "upi",
                accountName: tx.accountName,
              },
            });
            return;
          case "income":
            return show({ kind: "income", editing: tx });
          case "transfer":
            return show({ kind: "transfer", editing: tx });
          case "adjustment":
            return show({ kind: "adjustment", tx });
        }
      },
    };
  }, [openEditExpense]);

  const sheetProps = { open, onOpenChange: setOpen, options, close: () => setOpen(false) };

  return (
    <MoneySheetsContext.Provider value={value}>
      {children}
      {sheet?.kind === "income" && <IncomeSheet key={key} {...sheetProps} editing={sheet.editing} accountId={sheet.accountId} />}
      {sheet?.kind === "transfer" && (
        <TransferSheet key={key} {...sheetProps} editing={sheet.editing} fromAccountId={sheet.fromAccountId} />
      )}
      {sheet?.kind === "reconcile" && <ReconcileSheet key={key} {...sheetProps} account={sheet.account} />}
      {sheet?.kind === "adjustment" && <AdjustmentSheet key={key} {...sheetProps} tx={sheet.tx} />}
    </MoneySheetsContext.Provider>
  );
}

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: QuickAddOptions;
  close: () => void;
};

/** Account options: active accounts plus any the edited transaction already uses. */
function accountOptions(options: QuickAddOptions, keep: { id: string | null; name: string | null }[]) {
  const list = [...options.accounts];
  for (const k of keep) {
    if (k.id && k.name && !list.some((a) => a.id === k.id)) list.push({ id: k.id, name: k.name, type: "bank" });
  }
  return list;
}

function DeleteButton({ id, label, onDone }: { id: string; label: string; onDone: () => void }) {
  return (
    <Button
      type="button"
      variant="destructive"
      className="h-10 flex-1"
      onClick={() => {
        onDone();
        void deleteWithUndo(id, label);
      }}
    >
      <Trash2 />
      Delete
    </Button>
  );
}

// ── Add money ────────────────────────────────────────────────────────────────

function IncomeSheet({
  open,
  onOpenChange,
  options,
  close,
  editing,
  accountId,
}: SheetProps & { editing?: TransactionListItem; accountId?: string }) {
  const [today] = useState(todayIst);
  const accounts = accountOptions(options, editing ? [{ id: editing.accountId, name: editing.accountName }] : []);
  const categories =
    editing?.categoryId && !options.incomeCategories.some((c) => c.id === editing.categoryId)
      ? [
          ...options.incomeCategories,
          { id: editing.categoryId, name: editing.categoryName ?? "", icon: editing.categoryIcon, color: editing.categoryColor },
        ]
      : options.incomeCategories;
  const defaultAccount = accounts.find((a) => a.type === "bank") ?? accounts[0];

  const [amount, setAmount] = useState(editing ? paiseToRupeesString(editing.amountPaise) : "");
  const [account, setAccount] = useState(editing?.accountId ?? accountId ?? defaultAccount?.id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? categories[0]?.id ?? "");
  const [txnDate, setTxnDate] = useState(editing?.txnDate ?? today);
  const [note, setNote] = useState(editing?.description ?? "");
  const [id] = useState(() => crypto.randomUUID());
  const { pending, error, setError, run } = useAction();

  function submit() {
    const amountPaise = parseRupeesToPaise(amount);
    if (!amountPaise) return setError("Enter an amount.");
    const fields = { amountPaise, accountId: account, categoryId, txnDate, description: note };
    run(() => (editing ? updateIncome(editing.id, fields) : addIncome({ id, ...fields })), {
      success: editing ? "Updated" : `Added ${formatINR(amountPaise)}`,
      onSuccess: close,
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit money added" : "Add money"}
      description="Salary, refunds or any money coming into an account."
      submitLabel={editing ? "Save changes" : "Add money"}
      pending={pending}
      error={error}
      onSubmit={submit}
      secondaryActions={editing && <DeleteButton id={editing.id} label={formatINR(editing.amountPaise)} onDone={close} />}
    >
      <AmountField id="income-amount" value={amount} onChange={setAmount} autoFocus={!editing} />
      <FormField label="Into account" htmlFor="income-account">
        <NativeSelect id="income-account" value={account} onChange={(e) => setAccount(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Category">
        <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === categoryId}
              onClick={() => setCategoryId(c.id)}
              className="flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm aria-checked:border-foreground aria-checked:bg-muted"
            >
              <IconBadge icon={c.icon} color={c.color} className="size-7 [&_svg]:size-4" />
              {c.name}
            </button>
          ))}
        </div>
      </FormField>
      <DateField value={txnDate} onChange={setTxnDate} today={today} />
      <NoteField id="income-note" value={note} onChange={setNote} />
    </FormSheet>
  );
}

// ── Transfer ─────────────────────────────────────────────────────────────────

function TransferSheet({
  open,
  onOpenChange,
  options,
  close,
  editing,
  fromAccountId,
}: SheetProps & { editing?: TransactionListItem; fromAccountId?: string }) {
  const [today] = useState(todayIst);
  const accounts = accountOptions(
    options,
    editing
      ? [
          { id: editing.accountId, name: editing.accountName },
          { id: editing.toAccountId, name: editing.toAccountName },
        ]
      : [],
  );
  const initialFrom = editing?.accountId ?? fromAccountId ?? accounts.find((a) => a.type === "bank")?.id ?? accounts[0]?.id ?? "";
  const initialTo = editing?.toAccountId ?? accounts.find((a) => a.id !== initialFrom)?.id ?? "";

  const [amount, setAmount] = useState(editing ? paiseToRupeesString(editing.amountPaise) : "");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [txnDate, setTxnDate] = useState(editing?.txnDate ?? today);
  const [note, setNote] = useState(editing?.description ?? "");
  const [id] = useState(() => crypto.randomUUID());
  const { pending, error, setError, run } = useAction();

  function submit() {
    const amountPaise = parseRupeesToPaise(amount);
    if (!amountPaise) return setError("Enter an amount.");
    if (from === to) return setError("Pick two different accounts.");
    const fields = { amountPaise, fromAccountId: from, toAccountId: to, txnDate, description: note };
    run(() => (editing ? updateTransfer(editing.id, fields) : addTransfer({ id, ...fields })), {
      success: editing ? "Updated" : `Moved ${formatINR(amountPaise)}`,
      onSuccess: close,
    });
  }

  const accountSelect = (id: string, value: string, onChange: (v: string) => void) => (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit transfer" : "Transfer"}
      description="Move money between your accounts, like withdrawing cash from the bank."
      submitLabel={editing ? "Save changes" : "Transfer"}
      pending={pending}
      error={error}
      onSubmit={submit}
      secondaryActions={editing && <DeleteButton id={editing.id} label={formatINR(editing.amountPaise)} onDone={close} />}
    >
      {accounts.length < 2 ? (
        <p className="text-sm text-muted-foreground">You need at least two accounts to transfer money.</p>
      ) : (
        <>
          <AmountField id="transfer-amount" value={amount} onChange={setAmount} autoFocus={!editing} />
          <FormField label="From" htmlFor="transfer-from">
            {accountSelect("transfer-from", from, setFrom)}
          </FormField>
          <div className="-my-2 flex justify-center">
            <button
              type="button"
              aria-label="Swap accounts"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="flex size-9 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowDownUp className="size-4" />
            </button>
          </div>
          <FormField label="To" htmlFor="transfer-to">
            {accountSelect("transfer-to", to, setTo)}
          </FormField>
          <DateField value={txnDate} onChange={setTxnDate} today={today} />
          <NoteField id="transfer-note" value={note} onChange={setNote} />
        </>
      )}
    </FormSheet>
  );
}

// ── Set actual balance ───────────────────────────────────────────────────────

function ReconcileSheet({
  open,
  onOpenChange,
  close,
  account,
}: SheetProps & { account: { id: string; name: string; balancePaise: number } }) {
  const [actual, setActual] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  const { pending, error, setError, run } = useAction();

  const negative = actual.trim().startsWith("-");
  const parsed = parseRupeesToPaise(actual.replace("-", ""));
  const actualPaise = parsed === null ? null : negative ? -parsed : parsed;
  const difference = actualPaise === null ? null : reconcileDifference(account.balancePaise, actualPaise);

  function submit() {
    if (actualPaise === null) return setError("Enter the balance your bank shows.");
    if (difference === 0) {
      toast.success("Already matches");
      return close();
    }
    run(() => reconcileAccount({ id, accountId: account.id, actualBalancePaise: actualPaise }), {
      success: "Balance updated",
      onSuccess: close,
    });
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Set actual balance · ${account.name}`}
      description="Enter what your bank or wallet shows. The difference is recorded as an adjustment, so your history stays intact."
      submitLabel={difference ? "Save adjustment" : "Done"}
      pending={pending}
      error={error}
      onSubmit={submit}
    >
      <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
        <span className="text-sm text-muted-foreground">Balance in the app</span>
        <span className="font-semibold tabular-nums">{formatINR(account.balancePaise)}</span>
      </div>
      <AmountField id="reconcile-actual" label="Actual balance" value={actual} onChange={setActual} allowNegative autoFocus />
      {difference !== null && (
        <p className="text-sm" aria-live="polite">
          {difference === 0 ? (
            <span className="text-muted-foreground">Already matches. Nothing to adjust.</span>
          ) : (
            <>
              Adjustment:{" "}
              <span
                className={`font-semibold tabular-nums ${difference > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
              >
                {difference > 0 ? "+" : "−"}
                {formatINR(Math.abs(difference))}
              </span>
            </>
          )}
        </p>
      )}
    </FormSheet>
  );
}

// ── Adjustment details ───────────────────────────────────────────────────────

function AdjustmentSheet({ open, onOpenChange, close, tx }: SheetProps & { tx: TransactionListItem }) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Balance adjustment"
      description="Created when you set an account's actual balance. Delete it to undo that correction."
      submitLabel="Close"
      pending={false}
      error={null}
      onSubmit={close}
      secondaryActions={<DeleteButton id={tx.id} label="adjustment" onDone={close} />}
    >
      <dl className="divide-y rounded-xl border text-sm">
        {[
          ["Account", tx.accountName],
          ["Amount", `${tx.amountPaise > 0 ? "+" : "−"}${formatINR(Math.abs(tx.amountPaise))}`],
          ["Date", formatDayLabel(tx.txnDate)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </FormSheet>
  );
}
