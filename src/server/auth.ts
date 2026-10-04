import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth-allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string };

/** The verified, allowlisted user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const email = data.claims.email as string | undefined;
  if (!email || !isAllowedEmail(email)) return null;

  return { id: data.claims.sub, email };
});

/** For pages and server actions: returns the user or redirects to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
