"use client";

import Link from "next/link";
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
import { PAYMENT_KIND_ICON, PAYMENT_METHOD_KIND_OPTIONS } from "@/lib/validators/settings";
import { archivePaymentMethod, deletePaymentMethod, movePaymentMethod, savePaymentMethod } from "../actions";

type Kind = (typeof PAYMENT_METHOD_KIND_OPTIONS)[number]["value"];
type MethodKind = Kind | "credit_card" | "wallet";

export type PaymentMethodItem = {
  id: string;
  name: string;
  kind: MethodKind;
  isArchived: boolean;
  accountId: string;
  accountName: string;
};
type AccountOption = { id: string; name: string; isArchived: boolean };
type FormState = { name: string; kind: Kind; accountId: string };

const KIND_LABEL: Record<MethodKind, string> = {
  upi: "UPI",
  debit_card: "Debit card",
  net_banking: "Net banking",
  cash: "Cash",
  credit_card: "Credit card",
  wallet: "Wallet",
};

export function PaymentMethodsManager({
  methods,
  accounts,
}: {
  methods: PaymentMethodItem[];
  accounts: AccountOption[];
}) {
  const activeAccounts = accounts.filter((a) => !a.isArchived);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodItem | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", kind: "upi", accountId: "" });
  const { pending, error, setError, run } = useAction();

  // Default to the first bank account, so "UPI" etc. land on the bank rather than Cash.
  const defaultAccountId = (activeAccounts.find((a) => a.name !== "Cash") ?? activeAccounts[0])?.id ?? "";

  function openNew() {
    setEditing(null);
    setForm({ name: "", kind: "upi", accountId: defaultAccountId });
    setError(null);
    setOpen(true);
  }

  function openEdit(id: string) {
    const method = methods.find((m) => m.id === id);
    if (!method) return;
    setEditing(method);
    setForm({
      name: method.name,
      kind: method.kind === "credit_card" || method.kind === "wallet" ? "upi" : method.kind,
      accountId: method.accountId,
    });
    setError(null);
    setOpen(true);
  }

  // Offer active accounts, plus the current one when editing a method on an archived account.
  const accountOptions = accounts.filter((a) => !a.isArchived || a.id === editing?.accountId);
  const selectedAccount = accounts.find((a) => a.id === form.accountId);
  const suggestedName = selectedAccount
    ? form.kind === "cash"
      ? "Cash"
      : `${selectedAccount.name} ${KIND_LABEL[form.kind]}`
    : KIND_LABEL[form.kind];

  const close = () => setOpen(false);
  const toItem = (m: PaymentMethodItem) => ({
    id: m.id,
    title: m.name,
    subtitle: `${KIND_LABEL[m.kind]} · from ${m.accountName}`,
    leading: <IconBadge icon={PAYMENT_KIND_ICON[m.kind]} />,
  });

  return (
    <>
      <PageHeader
        title="Payment methods"
        backHref="/settings"
        action={activeAccounts.length > 0 && <AddButton onClick={openNew} />}
      />
      {activeAccounts.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          <Link href="/settings/accounts" className="font-medium text-foreground underline underline-offset-4">
            Add an account
          </Link>{" "}
          first. Payment methods take money from an account.
        </p>
      ) : (
        <SettingsList
          active={methods.filter((m) => !m.isArchived).map(toItem)}
          archived={methods.filter((m) => m.isArchived).map(toItem)}
          onOpen={openEdit}
          move={movePaymentMethod}
          emptyText="Add how you pay, like HDFC UPI or SBI Debit card."
        />
      )}

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit payment method" : "Add payment method"}
        description="Expenses paid this way are deducted from the linked account."
        submitLabel={editing ? "Save" : "Add payment method"}
        pending={pending}
        error={error}
        onSubmit={() =>
          run(
            () =>
              savePaymentMethod(editing?.id ?? null, {
                name: form.name.trim() || suggestedName,
                kind: form.kind,
                accountId: form.accountId,
                icon: null,
              }),
            { success: editing ? "Payment method saved" : "Payment method added", onSuccess: close },
          )
        }
        secondaryActions={
          editing && (
            <ArchiveDeleteButtons
              isArchived={editing.isArchived}
              pending={pending}
              deleteConfirm={`Delete "${editing.name}"? This can't be undone.`}
              onArchive={(archived) =>
                run(() => archivePaymentMethod(editing.id, archived), {
                  success: archived ? "Payment method archived" : "Payment method restored",
                  onSuccess: close,
                })
              }
              onDelete={() =>
                run(() => deletePaymentMethod(editing.id), { success: "Payment method deleted", onSuccess: close })
              }
            />
          )
        }
      >
        <FormField label="Type" htmlFor="method-kind">
          <NativeSelect
            id="method-kind"
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as Kind }))}
          >
            {PAYMENT_METHOD_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Paid from account" htmlFor="method-account">
          <NativeSelect
            id="method-account"
            value={form.accountId}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            required
          >
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isArchived ? " (archived)" : ""}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Name" htmlFor="method-name" hint="Leave blank to use the suggested name.">
          <input
            id="method-name"
            className={fieldClass}
            placeholder={suggestedName}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoComplete="off"
          />
        </FormField>
      </FormSheet>
    </>
  );
}
