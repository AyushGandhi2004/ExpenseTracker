import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  // Drop pages cached for offline use. Not "storage": unsynced expenses live there.
  response.headers.set("Clear-Site-Data", '"cache"');
  return response;
}
