export type CsvValue = string | number | null | undefined;

/**
 * One CSV cell (RFC 4180). Text that a spreadsheet would treat as a formula
 * (=, +, -, @, tab, CR) is prefixed with ' so opening the export can't run it.
 * Numbers are written as-is, so negative amounts stay numeric.
 */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
