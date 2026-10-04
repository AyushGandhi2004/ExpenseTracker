import "server-only";
import { eq } from "drizzle-orm";
import { todayIst } from "@/lib/dates";
import { db } from "@/server/db";
import { accounts, categories, paymentMethods } from "@/server/db/schema";

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Food", icon: "utensils", color: "#f97316" },
  { name: "Groceries", icon: "shopping-basket", color: "#22c55e" },
  { name: "Transport", icon: "bus", color: "#3b82f6" },
  { name: "Rent", icon: "house", color: "#a855f7" },
  { name: "Bills", icon: "receipt", color: "#eab308" },
  { name: "Shopping", icon: "shopping-bag", color: "#ec4899" },
  { name: "Health", icon: "heart-pulse", color: "#ef4444" },
  { name: "Entertainment", icon: "clapperboard", color: "#06b6d4" },
  { name: "Other", icon: "circle-ellipsis", color: "#64748b" },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: "Salary", icon: "briefcase", color: "#16a34a" },
  { name: "Refund", icon: "undo-2", color: "#0ea5e9" },
  { name: "Interest", icon: "percent", color: "#8b5cf6" },
  { name: "Other", icon: "circle-ellipsis", color: "#64748b" },
];

/**
 * First-login setup: default categories plus a Cash account and payment method.
 * Idempotent — does nothing once the user has any category.
 */
export async function ensureUserDefaults(userId: string): Promise<void> {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.userId, userId))
    .limit(1);
  if (existing.length > 0) return;

  await db.transaction(async (tx) => {
    await tx.insert(categories).values([
      ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ ...c, userId, kind: "expense" as const, sortOrder: i })),
      ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ ...c, userId, kind: "income" as const, sortOrder: i })),
    ]);

    const [cash] = await tx
      .insert(accounts)
      .values({ userId, name: "Cash", type: "cash", openingBalancePaise: 0, openingDate: todayIst(), sortOrder: 99 })
      .returning({ id: accounts.id });

    await tx
      .insert(paymentMethods)
      .values({ userId, name: "Cash", kind: "cash", accountId: cash.id, icon: "banknote", sortOrder: 99 });
  });
}

/** Sign-in must not fail because seeding did; the app shell calls `ensureUserDefaults` again. */
export async function tryEnsureUserDefaults(userId: string): Promise<void> {
  try {
    await ensureUserDefaults(userId);
  } catch (error) {
    console.error("ensureUserDefaults failed", error);
  }
}
