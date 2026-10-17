import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocale } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import type { Database } from "@/lib/supabase/database.types";

export async function getSavedLocale(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AppLocale | null> {
  const { data } = await supabase.from("profiles").select("locale").eq("id", userId).maybeSingle();
  return data?.locale && hasLocale(routing.locales, data.locale) ? data.locale : null;
}
