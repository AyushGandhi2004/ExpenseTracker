"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Bottom sheet with a form: title, scrollable fields, a sticky primary button,
 * an inline error, and optional secondary actions (archive / delete) below.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending,
  error,
  onSubmit,
  secondaryActions,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  secondaryActions?: ReactNode;
  children: ReactNode;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">{children}</div>
          <div className="flex flex-col gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            {secondaryActions && <div className="flex gap-2">{secondaryActions}</div>}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
