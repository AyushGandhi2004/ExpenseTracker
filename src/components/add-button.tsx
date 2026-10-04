"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddButton({ onClick, label = "Add" }: { onClick: () => void; label?: string }) {
  return (
    <Button size="lg" className="h-9 px-3" onClick={onClick}>
      <Plus />
      {label}
    </Button>
  );
}
