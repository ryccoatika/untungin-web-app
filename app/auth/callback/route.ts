import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { withLocale } from "@/lib/i18n/paths";
import { getSavedLocale } from "@/lib/i18n/saved-locale";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? DEFAULT_AFTER_LOGIN;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const saved = data.user ? await getSavedLocale(supabase, data.user.id) : null;
      return NextResponse.redirect(new URL(saved ? withLocale(next, saved) : next, origin));
    }
  }

  // Unprefixed; the proxy redirects to the detected locale.
  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
