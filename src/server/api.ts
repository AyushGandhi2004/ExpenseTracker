import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { isAllowedEmail } from "@/lib/auth-allowlist";
import { getCurrentUser, type CurrentUser } from "@/server/auth";
import { UserError } from "@/server/errors";

/**
 * The caller of a /api/v1 route: a `Authorization: Bearer <supabase access token>` header
 * (mobile app / scripts), or the browser's session cookie (the web app).
 */
export async function getApiUser(request: Request): Promise<CurrentUser | null> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return getCurrentUser();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.getClaims(match[1]);
  const email = data?.claims?.email as string | undefined;
  if (error || !data?.claims || !isAllowedEmail(email)) return null;
  return { id: data.claims.sub, email: email! };
}

/** Wraps a route handler: auth, JSON errors (400 for bad input, 401, 500) and no caching. */
export function apiRoute<Ctx>(
  handler: (user: CurrentUser, request: Request, ctx: Ctx) => Promise<Response | unknown>,
) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    const user = await getApiUser(request);
    if (!user) return json({ error: "unauthorized" }, 401);
    try {
      const result = await handler(user, request, ctx);
      return result instanceof Response ? result : json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof ZodError) return json({ error: "invalid_request", issues: error.issues }, 400);
      if (error instanceof UserError) return json({ error: error.message }, 400);
      if (error instanceof SyntaxError) return json({ error: "invalid_json" }, 400);
      console.error(error);
      return json({ error: "internal_error" }, 500);
    }
  };
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** URL search params as a plain object, for Zod parsing. */
export const queryOf = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);
