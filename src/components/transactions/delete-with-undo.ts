"use client";

import { toast } from "sonner";
import { deleteTransaction, restoreTransaction } from "@/app/(app)/actions";

const UNDO_MS = 5000;

/** Soft-deletes a transaction and offers a 5-second Undo that restores it. */
export async function deleteWithUndo(id: string, label: string): Promise<boolean> {
  try {
    const result = await deleteTransaction(id);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
  } catch {
    toast.error("Couldn't reach the server. Check your connection and try again.");
    return false;
  }

  toast(`Deleted ${label}`, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          const restored = await restoreTransaction(id);
          if (restored.ok) toast.success("Restored");
          else toast.error(restored.error);
        } catch {
          toast.error("Couldn't restore. Check your connection and try again.");
        }
      },
    },
  });
  return true;
}
