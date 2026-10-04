import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listCategories } from "@/server/services/categories";
import { CategoriesManager } from "./categories-manager";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesSettingsPage() {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <CategoriesManager
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        icon: c.icon,
        color: c.color,
        isArchived: c.isArchived,
      }))}
    />
  );
}
