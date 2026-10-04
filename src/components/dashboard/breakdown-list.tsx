import Link from "next/link";
import type { ReactNode } from "react";
import { formatINR } from "@/lib/money";

export type BreakdownRow = { id: string; name: string; spent: number; count: number; leading: ReactNode; href: string };

/** Ranked list with a thin share bar (one hue). Each row links to its transactions. */
export function BreakdownList({ rows, total }: { rows: BreakdownRow[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.spent));
  return (
    <ul className="flex flex-col">
      {rows.map((r) => {
        const share = total > 0 ? Math.round((r.spent / total) * 100) : 0;
        return (
          <li key={r.id}>
            <Link href={r.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
              {r.leading}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{share}%</span>
                  <span className="text-sm font-semibold tabular-nums">{formatINR(r.spent)}</span>
                </span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-viz-accent" style={{ width: `${(r.spent / max) * 100}%` }} />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
