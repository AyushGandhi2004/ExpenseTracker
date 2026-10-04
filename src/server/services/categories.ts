import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { moveId } from "@/lib/reorder";
import type { CategoryInput } from "@/lib/validators/settings";
import { db } from "@/server/db";
import { categories } from "@/server/db/schema";
import { toUserError, UserError } from "@/server/errors";

const DUPLICATE = "You already have a category with this name.";

export async function listCategories(userId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.isArchived), asc(categories.sortOrder), asc(categories.createdAt));
}

async function getOwned(userId: string, id: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  if (!category) throw new UserError("Category not found.");
  return category;
}

export async function createCategory(userId: string, input: CategoryInput) {
  try {
    await db.insert(categories).values({
      userId,
      ...input,
      sortOrder: sql`(select coalesce(max(${categories.sortOrder}), -1) + 1 from ${categories} where ${categories.userId} = ${userId} and ${categories.kind} = ${input.kind})`,
    });
  } catch (error) {
    toUserError(error, { duplicate: DUPLICATE });
  }
}

/** Kind (expense/income) is fixed after creation so past transactions stay consistent. */
export async function updateCategory(userId: string, id: string, input: Omit<CategoryInput, "kind">) {
  await getOwned(userId, id);
  try {
    await db
      .update(categories)
      .set({ name: input.name, icon: input.icon, color: input.color })
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  } catch (error) {
    toUserError(error, { duplicate: DUPLICATE });
  }
}

export async function setCategoryArchived(userId: string, id: string, archived: boolean) {
  await getOwned(userId, id);
  await db
    .update(categories)
    .set({ isArchived: archived })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

export async function deleteCategory(userId: string, id: string) {
  await getOwned(userId, id);
  try {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  } catch (error) {
    toUserError(error, { inUse: "This category has transactions. Archive it instead." });
  }
}

export async function moveCategory(userId: string, id: string, direction: -1 | 1) {
  const category = await getOwned(userId, id);
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.kind, category.kind),
        eq(categories.isArchived, false),
      ),
    )
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
  const ordered = moveId(
    rows.map((r) => r.id),
    id,
    direction,
  );
  if (!ordered) return;

  await db.transaction(async (tx) => {
    for (const [index, categoryId] of ordered.entries()) {
      await tx
        .update(categories)
        .set({ sortOrder: index })
        .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
    }
  });
}
