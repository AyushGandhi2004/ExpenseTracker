"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
        className="h-10 flex-1"
        disabled={pending}
        onClick={() => onArchive(!isArchived)}
      >
        {isArchived ? <ArchiveRestore /> : <Archive />}
        {isArchived ? "Restore" : "Archive"}
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="h-10 flex-1"
        disabled={pending}
        onClick={() => {
          if (window.confirm(deleteConfirm)) onDelete();
        }}
      >
        <Trash2 />
        Delete
      </Button>
    </>
  );
}
