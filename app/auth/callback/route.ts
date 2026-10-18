import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { recordConsent } from "@/lib/data/consents";
import { routing } from "@/i18n/routing";
import { splitLocale, withLocale } from "@/lib/i18n/paths";
import { getSavedLocale } from "@/lib/i18n/saved-locale";
import { isFirstSignIn } from "@/lib/legal/consent";
import type { Database } from "@/lib/supabase/database.types";
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
      if (data.user) await recordFirstAgreement(supabase, data.user.id);
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

/**
 * Signing in for the first time means agreeing to the terms (the line under the Google button), so record it.
 * A returning user with an older version agrees on the agreement screen instead, never silently here. Uses the
 * client that just exchanged the code: the request's cookies don't hold the new session yet. A failure only
 * means the agreement screen asks later, so it never blocks the sign-in.
 */
async function recordFirstAgreement(supabase: SupabaseClient<Database>, userId: string) {
  try {
    const { data: rows, error } = await supabase.from("consents").select("kind").eq("user_id", userId);
    if (error) throw error;
    if (isFirstSignIn(rows)) await recordConsent(supabase, userId, "terms");
  } catch (error) {
    console.error(`Recording the sign-in agreement failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
