import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatINR } from "@/lib/money";

/** Profit/loss with an arrow and sign, so it never relies on colour alone. */
export function Pnl({
  paise,
  pct,
  className = "",
  showAmount = true,
}: {
  paise: number | null;
  pct?: string | null;
  className?: string;
  showAmount?: boolean;
}) {
  if (paise === null) return <span className={`text-muted-foreground ${className}`}>No price yet</span>;
  const up = paise > 0;
  const down = paise < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  const tone = up ? "text-viz-good" : down ? "text-viz-bad" : "text-muted-foreground";
  const sign = up ? "+" : down ? "−" : "";
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${tone} ${className}`}>
      {(up || down) && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span className="sr-only">{up ? "Gain" : down ? "Loss" : "No change"} </span>
      {showAmount && `${sign}${formatINR(Math.abs(paise))}`}
      {pct && <span>{showAmount ? ` (${pct})` : pct}</span>}
    </span>
  );
}

export const kindLabel = (kind: "mutual_fund" | "stock") => (kind === "mutual_fund" ? "Mutual fund" : "Stock");
export const unitsLabel = (kind: "mutual_fund" | "stock") => (kind === "mutual_fund" ? "units" : "shares");

/** "2496.90" → "₹2,496.90"; "123456.7500" → "₹1,23,456.75" (Indian grouping, 2–4 decimals). */
export function formatUnitPrice(price: string): string {
  const [whole, fraction = ""] = price.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const frac = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `₹${rest ? `${rest},${last3}` : last3}.${frac}`;
}
