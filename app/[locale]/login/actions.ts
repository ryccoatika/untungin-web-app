"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import type { FormState } from "@/lib/forms";
import { withLocale } from "@/lib/i18n/paths";
import { getSavedLocale } from "@/lib/i18n/saved-locale";
import { createClient } from "@/lib/supabase/server";

/**
 * Local-only email/password login. Production stays safe even if the flag leaks:
 * the Email provider is disabled in the production Supabase project.
 */
export async function devLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("Auth");
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "true") {
    return { message: t("devDisabled") };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next =
    safeNextPath(String(formData.get("next") ?? "")) ?? `/${await getLocale()}${DEFAULT_AFTER_LOGIN}`;

  if (!email || password.length < 6) {
    return { message: t("devInvalid") };
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) {
    const saved = signIn.data.user ? await getSavedLocale(supabase, signIn.data.user.id) : null;
    // `next` is already a full same-origin path, so use next/navigation's redirect (no double prefix).
    redirect(saved ? withLocale(next, saved) : next);
  }
  const signUp = await supabase.auth.signUp({ email, password });
  if (signUp.error || !signUp.data.session) return { message: t("devFailed") };
  redirect(next);
}
