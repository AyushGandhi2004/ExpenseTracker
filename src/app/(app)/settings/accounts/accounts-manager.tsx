"use client";

import { useState } from "react";
import { AddButton } from "@/components/add-button";
import { IconBadge } from "@/components/app-icon";
import { ArchiveDeleteButtons } from "@/components/archive-delete-buttons";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { SettingsList } from "@/components/settings-list";
import { useAction } from "@/hooks/use-action";
import { todayIst } from "@/lib/dates";
import { formatINR, paiseToRupeesString } from "@/lib/money";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/validators/settings";
import { archiveAccount, deleteAccount, moveAccount, saveAccount } from "../actions";

type AccountType = "bank" | "cash" | "credit_card" | "wallet";

export type AccountItem = {
  id: string;
  name: string;
  type: AccountType;
  openingBalancePaise: number;
  openingDate: string;
  isArchived: boolean;
};

type FormState = { name: string; type: "bank" | "cash"; openingBalance: string; openingDate: string };

const TYPE_LABEL: Record<AccountType, string> = {
  bank: "Bank account",
  cash: "Cash",
  credit_card: "Credit card",
  wallet: "Wallet",
};
const TYPE_ICON: Record<AccountType, string> = {
  bank: "landmark",
  cash: "banknote",
  credit_card: "credit-card",
  wallet: "wallet",
};

const emptyForm = (): FormState => ({ name: "", type: "bank", openingBalance: "", openingDate: todayIst() });

export function AccountsManager({ accounts }: { accounts: AccountItem[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccountItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const { pending, error, setError, run } = useAction();

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }

  function openEdit(id: string) {
    const account = accounts.find((a) => a.id === id);
    if (!account) return;
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type === "cash" ? "cash" : "bank",
      openingBalance: account.openingBalancePaise === 0 ? "" : paiseToRupeesString(account.openingBalancePaise),
      openingDate: account.openingDate,
    });
    setError(null);
    setOpen(true);
  }

  const close = () => setOpen(false);
  const toItem = (a: AccountItem) => ({
    id: a.id,
    title: a.name,
    subtitle: `${TYPE_LABEL[a.type]} · opening ${formatINR(a.openingBalancePaise)}`,
    leading: <IconBadge icon={TYPE_ICON[a.type]} />,
  });

  return (
    <>
      <PageHeader title="Accounts" backHref="/settings" action={<AddButton onClick={openNew} />} />
      <SettingsList
        active={accounts.filter((a) => !a.isArchived).map(toItem)}
        archived={accounts.filter((a) => a.isArchived).map(toItem)}
        onOpen={openEdit}
        move={moveAccount}
        emptyText="Add your bank account to start tracking its balance."
      />

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit account" : "Add account"}
        submitLabel={editing ? "Save" : "Add account"}
        pending={pending}
        error={error}
        onSubmit={() =>
          run(
            () =>
              saveAccount(editing?.id ?? null, {
                name: form.name,
                type: form.type,
                openingBalancePaise: form.openingBalance,
                openingDate: form.openingDate,
              }),
            { success: editing ? "Account saved" : "Account added", onSuccess: close },
          )
        }
        secondaryActions={
          editing && (
            <ArchiveDeleteButtons
              isArchived={editing.isArchived}
              pending={pending}
              deleteConfirm={`Delete "${editing.name}"? This can't be undone.`}
              onArchive={(archived) =>
                run(() => archiveAccount(editing.id, archived), {
                  success: archived ? "Account archived" : "Account restored",
                  onSuccess: close,
                })
              }
              onDelete={() => run(() => deleteAccount(editing.id), { success: "Account deleted", onSuccess: close })}
            />
          )
        }
      >
        <FormField label="Name" htmlFor="account-name">
          <input
            id="account-name"
            className={fieldClass}
            placeholder="e.g. HDFC Savings"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoComplete="off"
            required
          />
        </FormField>
        <FormField label="Type" htmlFor="account-type">
          <NativeSelect
            id="account-type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FormState["type"] }))}
          >
            {ACCOUNT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Opening balance (₹)"
          htmlFor="account-opening"
          hint="The balance on the opening date. Transactions from that date onward adjust it."
        >
          <input
            id="account-opening"
            className={fieldClass}
            inputMode="decimal"
            placeholder="0"
            value={form.openingBalance}
            onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
            autoComplete="off"
          />
        </FormField>
        <FormField label="Opening date" htmlFor="account-date">
          <input
            id="account-date"
            type="date"
            className={fieldClass}
            value={form.openingDate}
            max={todayIst()}
            onChange={(e) => setForm((f) => ({ ...f, openingDate: e.target.value }))}
            required
          />
        </FormField>
      </FormSheet>
    </>
  );
}
