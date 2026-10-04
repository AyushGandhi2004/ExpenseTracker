import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requireUser, type CurrentUser } from "@/server/auth";
import { UserError } from "@/server/errors";
import type { ActionResult } from "@/lib/action-result";

export type { ActionResult };

/**
 * Runs a server action body for the signed-in user and turns expected failures
 * (validation, UserError) into `{ ok: false, error }` for the UI.
 */
export async function runAction(
  fn: (user: CurrentUser) => Promise<unknown>,
  revalidate: string[] = [],
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await fn(user);
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
    if (error instanceof UserError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  for (const path of revalidate) revalidatePath(path);
  return { ok: true };
}
