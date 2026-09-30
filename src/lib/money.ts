/** Money helpers. All amounts are stored and passed around as integer paise. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 12345650 → "₹1,23,456.5" ; whole rupees drop the decimals: 10000 → "₹100". */
export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

/** For chart axes: 12345600 → "₹1.2L". */
export function formatINRCompact(paise: number): string {
  return inrCompact.format(paise / 100);
}

/**
 * Parse user input in rupees ("1,234.5", "₹ 99", "0.75") into integer paise.
 * Returns null for anything that isn't a valid amount with at most 2 decimals.
 */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const rupees = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const paise = rupees * 100 + fraction;
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Integer paise → plain rupee string for inputs/CSV: 12345 → "123.45", 10000 → "100". */
export function paiseToRupeesString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const fraction = abs % 100;
  return fraction === 0 ? `${sign}${rupees}` : `${sign}${rupees}.${String(fraction).padStart(2, "0")}`;
}
