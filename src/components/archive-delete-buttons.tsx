"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";

export function ArchiveDeleteButtons({
  isArchived,
  pending,
  onArchive,
  onDelete,
  deleteConfirm,
}: {
  isArchived: boolean;
  pending: boolean;
  onArchive: (archived: boolean) => void;
  onDelete: () => void;
  deleteConfirm: string;
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 flex-1 self-end"
        disabled={pending}
        onClick={() => onArchive(!isArchived)}
      >
        {isArchived ? <ArchiveRestore /> : <Archive />}
        {isArchived ? "Restore" : "Archive"}
      </Button>
      <ConfirmButton
        variant="destructive"
        className="h-10 w-full"
        disabled={pending}
        message={deleteConfirm}
        onConfirm={onDelete}
      >
        <Trash2 />
        Delete
      </ConfirmButton>
    </>
  );
}
