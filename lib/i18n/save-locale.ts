"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/** Remembers the chosen UI language on the signed-in user's profile; no-op otherwise. */
export async function saveLocaleAction(locale: string): Promise<void> {
  if (!hasLocale(routing.locales, locale)) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;
  await supabase.from("profiles").update({ locale }).eq("id", userId);
}
