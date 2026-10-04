/**
 * State machine for the quick-add number pad. The amount is kept as the raw rupee
 * string the user typed ("1250.5"), converted to paise only on save.
 */

export type AmountKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "back";

const MAX_INTEGER_DIGITS = 9; // ₹99,99,99,999

export function applyAmountKey(current: string, key: AmountKey): string {
  if (key === "back") return current.slice(0, -1);

  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }

  const [integer, fraction] = current.split(".");
  if (fraction !== undefined) {
    return fraction.length >= 2 ? current : current + key;
  }
  if (integer === "0") return key; // replace a lone leading zero
  if (integer.length >= MAX_INTEGER_DIGITS) return current;
  return current + key;
}

const groupFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** "123456.5" → "1,23,456.5" (keeps a trailing "." while typing). Empty → "0". */
export function formatAmountInput(value: string): string {
  if (value === "") return "0";
  const [integer, fraction] = value.split(".");
  const grouped = groupFormatter.format(Number(integer || "0"));
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
