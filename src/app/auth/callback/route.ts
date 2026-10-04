import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth-allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tryEnsureUserDefaults } from "@/server/services/setup";

/** The backup sign-in link in the login email lands here with ?code=…; exchange it for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${reason}`);

  if (!code) return fail("missing_code");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("auth_failed");

  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return fail("not_allowed");
  }

  await tryEnsureUserDefaults(data.user.id);
  return NextResponse.redirect(`${origin}/`);
}
