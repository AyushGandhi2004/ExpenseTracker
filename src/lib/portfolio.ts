/**
 * Portfolio maths with exact decimals — no floating point.
 *
 *   quantity: units × 10^6  (bigint)   e.g. 33.594 units  → 33_594_000n
 *   price:    ₹/unit × 10^4 (bigint)   e.g. ₹89.3000      → 893_000n
 *   cash:     paise (number, like the rest of the app)
 *
 * Cost basis uses the average-cost method: a sell removes cost in proportion to the
 * units sold, and realised P&L = sale proceeds − cost removed.
 */

export const QTY_DECIMALS = 6;
export const PRICE_DECIMALS = 4;
const QTY_SCALE = 10n ** BigInt(QTY_DECIMALS);
const PRICE_SCALE = 10n ** BigInt(PRICE_DECIMALS);
// qty(×1e6) × price(×1e4) → ₹ × 1e10 → paise needs ÷ 1e8
const VALUE_DIVISOR = (QTY_SCALE * PRICE_SCALE) / 100n;

/** Half-up rounding division for non-negative bigint numerators/denominators. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * 2n + d) / (2n * d);
  return negative ? -q : q;
}

/** "33.594" → 33594000n (for decimals = 6). Rejects malformed input and excess precision. */
export function parseDecimal(input: string, decimals: number): bigint | null {
  const match = /^(\d+)(?:\.(\d*))?$/.exec(input.trim().replace(/,/g, ""));
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  return BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

/** Like parseDecimal, but rounds extra digits half-up (for prices from data feeds: 2070.699951 → 2070.7000). */
export function parseDecimalRounded(input: string | number, decimals: number): bigint | null {
  const text = typeof input === "number" ? input.toFixed(decimals + 4) : input.trim();
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length <= decimals) return parseDecimal(text, decimals);
  const extra = fraction.length - decimals;
  const raw = BigInt(match[1] + fraction);
  return divRound(raw, 10n ** BigInt(extra));
}

/** 33594000n → "33.594" (trailing zeros trimmed to `minFrac`). */
export function formatDecimal(value: bigint, decimals: number, minFrac = 0): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  let fraction = (abs % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  if (fraction.length < minFrac) fraction = fraction.padEnd(minFrac, "0");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export const parseQuantity = (s: string) => parseDecimal(s, QTY_DECIMALS);
export const parsePrice = (s: string) => parseDecimal(s, PRICE_DECIMALS);
export const formatQuantity = (q: bigint) => formatDecimal(q, QTY_DECIMALS);
export const formatPrice = (p: bigint) => formatDecimal(p, PRICE_DECIMALS, 2);

/** Market value in paise of `quantity` units at `price`. */
export function valuePaise(quantity: bigint, price: bigint): number {
  return Number(divRound(quantity * price, VALUE_DIVISOR));
}

/** Units bought with `amountPaise` at `price`, rounded to `unitDecimals` (AMCs allot 3). */
export function unitsFor(amountPaise: number, price: bigint, unitDecimals = 3): bigint {
  if (price <= 0n) return 0n;
  const exact = divRound(BigInt(amountPaise) * VALUE_DIVISOR, price); // ×1e6
  const step = 10n ** BigInt(QTY_DECIMALS - unitDecimals);
  return divRound(exact, step) * step;
}

/** Price per unit (×1e4) implied by an amount for a quantity. */
export function priceFor(amountPaise: number, quantity: bigint): bigint {
  if (quantity <= 0n) return 0n;
  return divRound(BigInt(amountPaise) * VALUE_DIVISOR, quantity);
}

export type Trade = {
  type: "buy" | "sell";
  date: string;
  quantity: bigint;
  /** Buy: paid incl. charges. Sell: received after charges. */
  amountPaise: number;
  /** Tie-breaker within a day (creation order). */
  order?: number;
};

/** Chronological order; on the same day buys come before sells. */
export function sortTrades<T extends Trade>(trades: readonly T[]): T[] {
  return [...trades].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.type === b.type ? 0 : a.type === "buy" ? -1 : 1) ||
      (a.order ?? 0) - (b.order ?? 0),
  );
}

/** The first sell that would take holdings below zero, or null if the history is consistent. */
export function findOversell(trades: readonly Trade[]): { date: string; held: bigint; selling: bigint } | null {
  let held = 0n;
  for (const t of sortTrades(trades)) {
    if (t.type === "buy") held += t.quantity;
    else {
      if (t.quantity > held) return { date: t.date, held, selling: t.quantity };
      held -= t.quantity;
    }
  }
  return null;
}

export type Holding = {
  quantity: bigint;
  /** Cost of the units still held (average cost). */
  costPaise: number;
  /** Average cost per unit (×1e4), null when nothing is held. */
  averagePrice: bigint | null;
  realisedPaise: number;
  valuePaise: number | null;
  unrealisedPaise: number | null;
  /** Unrealised return in basis points (1% = 100), null without a price or cost. */
  unrealisedBps: number | null;
};

export function holdingFrom(trades: readonly Trade[], lastPrice: bigint | null): Holding {
  let quantity = 0n;
  let cost = 0n;
  let realised = 0n;
  for (const t of sortTrades(trades)) {
    if (t.type === "buy") {
      quantity += t.quantity;
      cost += BigInt(t.amountPaise);
    } else {
      const sold = t.quantity > quantity ? quantity : t.quantity;
      const removed = quantity > 0n ? divRound(cost * sold, quantity) : 0n;
      cost -= removed;
      quantity -= sold;
      realised += BigInt(t.amountPaise) - removed;
    }
  }
  const costPaise = Number(cost);
  const value = lastPrice !== null ? valuePaise(quantity, lastPrice) : null;
  const unrealised = value !== null ? value - costPaise : null;
  return {
    quantity,
    costPaise,
    averagePrice: quantity > 0n ? priceFor(costPaise, quantity) : null,
    realisedPaise: Number(realised),
    valuePaise: value,
    unrealisedPaise: unrealised,
    unrealisedBps: unrealised !== null && costPaise > 0 ? Math.round((unrealised / costPaise) * 10_000) : null,
  };
}

export type SummaryInput = { kind: "mutual_fund" | "stock"; holding: Holding };

export function portfolioSummary(items: readonly SummaryInput[]) {
  const totals = { valuePaise: 0, costPaise: 0, realisedPaise: 0, byKind: { mutual_fund: 0, stock: 0 } };
  for (const { kind, holding } of items) {
    // Without a price, count the holding at cost so totals stay meaningful.
    const value = holding.valuePaise ?? holding.costPaise;
    totals.valuePaise += value;
    totals.costPaise += holding.costPaise;
    totals.realisedPaise += holding.realisedPaise;
    totals.byKind[kind] += value;
  }
  const unrealisedPaise = totals.valuePaise - totals.costPaise;
  return {
    ...totals,
    unrealisedPaise,
    unrealisedBps: totals.costPaise > 0 ? Math.round((unrealisedPaise / totals.costPaise) * 10_000) : null,
  };
}

/** "+12.34%" / "−3.10%" from basis points. */
export function formatBps(bps: number): string {
  const sign = bps > 0 ? "+" : bps < 0 ? "−" : "";
  return `${sign}${(Math.abs(bps) / 100).toFixed(2)}%`;
}
