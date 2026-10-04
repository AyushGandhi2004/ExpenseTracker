"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth-allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryEnsureUserDefaults } from "@/server/services/setup";

export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string };

const emailSchema = z.email().transform((e) => e.trim().toLowerCase());
const codeSchema = z.string().trim().regex(/^\d{6,10}$/, "Enter the code from the email.");

/** Step 1: email the one-time code (and a backup sign-in link). Only the allowlisted address gets one. */
export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;

  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: "This email isn't allowed to use this app." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const rateLimited = error.status === 429 || /rate limit/i.test(error.message);
    if (rateLimited) {
      // The free email service allows only a few emails an hour; a recent code may still be valid.
      return { step: "code", email, error: "Email limit reached. Enter the last code you received, or try again later." };
    }
    return { step: "email", email, error: "Couldn't send the code. Please try again." };
  }
  return { step: "code", email };
}

/** Step 2: verify the code, which sets the session cookie. */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success || !isAllowedEmail(email.data)) return { step: "email" };

  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { step: "code", email: email.data, error: code.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error || !data.user) {
    return { step: "code", email: email.data, error: "That code is wrong or has expired." };
  }

  await tryEnsureUserDefaults(data.user.id);
  redirect("/");
}
