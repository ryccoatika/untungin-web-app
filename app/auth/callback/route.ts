import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { routing } from "@/i18n/routing";
import { splitLocale, withLocale } from "@/lib/i18n/paths";
import { getSavedLocale } from "@/lib/i18n/saved-locale";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = safeNextPath(searchParams.get("next"));
  const next = requestedNext ?? DEFAULT_AFTER_LOGIN;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const saved = data.user ? await getSavedLocale(supabase, data.user.id) : null;
      return NextResponse.redirect(new URL(saved ? withLocale(next, saved) : next, origin));
    }
  }

  // Keep the locale and the requested destination so a retry lands where the user wanted.
  const { locale } = splitLocale(next);
  const nextParam = requestedNext ? `&next=${encodeURIComponent(requestedNext)}` : "";
  return NextResponse.redirect(
    new URL(`/${locale ?? routing.defaultLocale}/login?error=auth${nextParam}`, origin),
  );
}
