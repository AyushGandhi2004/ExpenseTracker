/** Icon names that can be stored on categories / payment methods. Rendered by `AppIcon`. */
export const ICON_NAMES = [
  "utensils",
  "coffee",
  "shopping-basket",
  "shopping-bag",
  "shirt",
  "bus",
  "car",
  "fuel",
  "plane",
  "house",
  "receipt",
  "zap",
  "wifi",
  "phone",
  "heart-pulse",
  "pill",
  "dumbbell",
  "clapperboard",
  "music",
  "book-open",
  "graduation-cap",
  "gift",
  "baby",
  "paw-print",
  "wrench",
  "sparkles",
  "briefcase",
  "undo-2",
  "percent",
  "piggy-bank",
  "trending-up",
  "banknote",
  "landmark",
  "smartphone",
  "credit-card",
  "globe",
  "wallet",
  "circle-ellipsis",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export function isIconName(value: unknown): value is IconName {
  return typeof value === "string" && (ICON_NAMES as readonly string[]).includes(value);
}

/** Category colours; chosen to stay readable as icon tints in light and dark mode. */
export const CATEGORY_COLORS = [
  "#f97316",
  "#eab308",
  "#22c55e",
  "#16a34a",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#64748b",
] as const;
