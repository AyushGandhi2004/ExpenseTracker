import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border p-4" aria-label={title}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-base font-semibold tabular-nums">{value}</span>
    </>
  );
  const className = "flex min-w-0 flex-col gap-0.5 rounded-xl border px-3 py-2.5";
  return href ? (
    <Link href={href} className={`${className} hover:bg-muted/60`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
