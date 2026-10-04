/** Smallest "clean" number ≥ value: 1, 2, 2.5 or 5 × 10^k (₹1,837 → ₹2,000). */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

/** Heatmap bucket 0 (nothing) to `steps` (the day's spend relative to the busiest day). */
export function intensityBucket(value: number, max: number, steps = 5): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(steps, Math.max(1, Math.ceil((value / max) * steps)));
}

/** Percentage change, or null when there's nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
