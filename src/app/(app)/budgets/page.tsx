import type { Metadata } from "next";
import { todayIst } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { getBudgets } from "@/server/services/budgets";
import { getQuickAddOptions } from "@/server/services/quick-add";
import { BudgetsManager } from "./budgets-manager";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const user = await requireUser();
  const today = todayIst();
  const [budgets, options] = await Promise.all([getBudgets(user.id, today), getQuickAddOptions(user.id)]);
  return <BudgetsManager budgets={budgets} categories={options.categories} />;
}
