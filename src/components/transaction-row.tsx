import type { ReactNode } from "react";
import { IconBadge } from "@/components/app-icon";
import { formatINR } from "@/lib/money";

/** One line in a transaction list: category badge, title + subtitle, amount. */
export function TransactionRow({
  icon,
  color,
  title,
  subtitle,
  amountPaise,
  sign = "-",
  badge,
}: {
  icon: string | null;
  color: string | null;
  title: string;
  subtitle: ReactNode;
  amountPaise: number;
  sign?: "-" | "+" | "";
  badge?: ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-3">
      <IconBadge icon={icon} color={color} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-sm text-muted-foreground">{subtitle}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`font-medium tabular-nums ${sign === "+" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
          {sign}
          {formatINR(amountPaise)}
        </span>
        {badge}
      </div>
    </div>
  );
}
