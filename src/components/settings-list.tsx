"use client";

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ReorderButtons } from "@/components/reorder-buttons";
import type { ActionResult } from "@/lib/action-result";

export type SettingsListItem = {
  id: string;
  title: string;
  subtitle?: ReactNode;
  leading: ReactNode;
  trailing?: ReactNode;
};

/** Active items (reorderable) plus a collapsible "Archived" section. Tapping a row opens it. */
export function SettingsList({
  active,
  archived,
  onOpen,
  move,
  emptyText,
}: {
  active: SettingsListItem[];
  archived: SettingsListItem[];
  onOpen: (id: string) => void;
  move: (id: string, direction: -1 | 1) => Promise<ActionResult>;
  emptyText: string;
}) {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {active.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {active.map((item, index) => (
            <li key={item.id} className="flex items-center pr-1">
              <Row item={item} onOpen={onOpen} />
              <ReorderButtons id={item.id} isFirst={index === 0} isLast={index === active.length - 1} move={move} />
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="mb-2 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={`size-4 transition-transform ${showArchived ? "rotate-90" : ""}`} aria-hidden />
            Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="divide-y overflow-hidden rounded-xl border opacity-70">
              {archived.map((item) => (
                <li key={item.id} className="flex items-center">
                  <Row item={item} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ item, onOpen }: { item: SettingsListItem; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-muted/60"
    >
      {item.leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{item.title}</span>
        {item.subtitle && <span className="truncate text-sm text-muted-foreground">{item.subtitle}</span>}
      </span>
      {item.trailing}
    </button>
  );
}
