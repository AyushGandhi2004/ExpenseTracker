"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { AddButton } from "@/components/add-button";
import { AppIcon, IconBadge } from "@/components/app-icon";
import { ArchiveDeleteButtons } from "@/components/archive-delete-buttons";
import { fieldClass, FormField } from "@/components/form-field";
import { FormSheet } from "@/components/form-sheet";
import { PageHeader } from "@/components/page-header";
import { SettingsList } from "@/components/settings-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { CATEGORY_COLORS, ICON_NAMES, isIconName, type IconName } from "@/lib/icon-names";
import { archiveCategory, deleteCategory, moveCategory, saveCategory } from "../actions";

type Kind = "expense" | "income";
type Color = (typeof CATEGORY_COLORS)[number];

export type CategoryItem = {
  id: string;
  name: string;
  kind: Kind;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
};
type FormState = { name: string; icon: IconName; color: Color };

const isColor = (value: string | null): value is Color =>
  !!value && (CATEGORY_COLORS as readonly string[]).includes(value);

export function CategoriesManager({ categories }: { categories: CategoryItem[] }) {
  const [tab, setTab] = useState<Kind>("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", icon: "circle-ellipsis", color: CATEGORY_COLORS[0] });
  const { pending, error, setError, run } = useAction();

  function openNew() {
    setEditing(null);
    setForm({ name: "", icon: "circle-ellipsis", color: CATEGORY_COLORS[0] });
    setError(null);
    setOpen(true);
  }

  function openEdit(id: string) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;
    setEditing(category);
    setForm({
      name: category.name,
      icon: isIconName(category.icon) ? category.icon : "circle-ellipsis",
      color: isColor(category.color) ? category.color : CATEGORY_COLORS[0],
    });
    setError(null);
    setOpen(true);
  }

  const close = () => setOpen(false);
  const kind = editing?.kind ?? tab;
  const toItem = (c: CategoryItem) => ({
    id: c.id,
    title: c.name,
    leading: <IconBadge icon={c.icon} color={c.color} />,
  });
  const listFor = (k: Kind) => {
    const rows = categories.filter((c) => c.kind === k);
    return (
      <SettingsList
        active={rows.filter((c) => !c.isArchived).map(toItem)}
        archived={rows.filter((c) => c.isArchived).map(toItem)}
        onOpen={openEdit}
        move={moveCategory}
        emptyText={`No ${k} categories yet.`}
      />
    );
  };

  return (
    <>
      <PageHeader title="Categories" backHref="/settings" action={<AddButton onClick={openNew} />} />
      <Tabs value={tab} onValueChange={(value) => setTab(value as Kind)} className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <TabsContent value="expense">{listFor("expense")}</TabsContent>
        <TabsContent value="income">{listFor("income")}</TabsContent>
      </Tabs>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit category" : `Add ${kind} category`}
        submitLabel={editing ? "Save" : "Add category"}
        pending={pending}
        error={error}
        onSubmit={() =>
          run(() => saveCategory(editing?.id ?? null, { ...form, kind }), {
            success: editing ? "Category saved" : "Category added",
            onSuccess: close,
          })
        }
        secondaryActions={
          editing && (
            <ArchiveDeleteButtons
              isArchived={editing.isArchived}
              pending={pending}
              deleteConfirm={`Delete "${editing.name}"? This can't be undone.`}
              onArchive={(archived) =>
                run(() => archiveCategory(editing.id, archived), {
                  success: archived ? "Category archived" : "Category restored",
                  onSuccess: close,
                })
              }
              onDelete={() => run(() => deleteCategory(editing.id), { success: "Category deleted", onSuccess: close })}
            />
          )
        }
      >
        <div className="flex items-end gap-3">
          <IconBadge icon={form.icon} color={form.color} className="size-11" />
          <div className="flex-1">
            <FormField label="Name" htmlFor="category-name">
              <input
                id="category-name"
                className={fieldClass}
                placeholder={kind === "expense" ? "e.g. Fuel" : "e.g. Freelance"}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoComplete="off"
                required
              />
            </FormField>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Colour ${color}`}
                aria-pressed={form.color === color}
                onClick={() => setForm((f) => ({ ...f, color }))}
                className="flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-foreground"
                style={{ backgroundColor: color }}
              >
                {form.color === color && <Check className="size-4 text-white" aria-hidden />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Icon</legend>
          <div className="grid grid-cols-6 gap-2">
            {ICON_NAMES.map((icon) => (
              <button
                key={icon}
                type="button"
                aria-label={icon.replaceAll("-", " ")}
                aria-pressed={form.icon === icon}
                onClick={() => setForm((f) => ({ ...f, icon }))}
                className="flex aspect-square items-center justify-center rounded-xl border border-transparent text-muted-foreground hover:bg-muted aria-pressed:border-foreground aria-pressed:text-foreground"
                style={form.icon === icon ? { color: form.color, borderColor: form.color } : undefined}
              >
                <AppIcon name={icon} className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>
      </FormSheet>
    </>
  );
}
