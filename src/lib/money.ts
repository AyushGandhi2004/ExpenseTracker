/** Money helpers. All amounts are stored and passed around as integer paise. */

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 12345650 → "₹1,23,456.50" ; whole rupees drop the decimals: 10000 → "₹100". */
export function formatINR(paise: number): string {
  return (paise % 100 === 0 ? inrWhole : inrPaise).format(paise / 100);
}

const COMPACT_UNITS = [
  { value: 1_00_00_000, suffix: "Cr" },
  { value: 1_00_000, suffix: "L" },
  { value: 1_000, suffix: "K" },
] as const;

/**
 * For chart axes, in Indian units: 1000000 → "₹10K", 12345600 → "₹1.23L".
 * Hand-rolled because Intl's compact notation differs between Node and browsers
 * ("₹10.0K" vs "₹10K"), which breaks server/client hydration.
 */
export function formatINRCompact(paise: number): string {
  const rupees = paise / 100;
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);
  const unit = COMPACT_UNITS.find((u) => abs >= u.value);
  if (!unit) return `${sign}₹${Math.round(abs)}`;
  // Up to two decimals, trailing zeros dropped: 1.25K, 2.5K, 10K.
  const scaled = Math.round((abs / unit.value) * 100) / 100;
  return `${sign}₹${scaled}${unit.suffix}`;
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
