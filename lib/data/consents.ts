import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentVersion, type ConsentKind } from "@/lib/legal/versions";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user's consent rows; RLS returns only their own. */
export const loadConsents = cache(async (): Promise<{ kind: string; version: string }[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("consents").select("kind, version");
  if (error) throw error;
  return data ?? [];
});

/** Records agreement to the current version of `kind`; the database sets the time. */
export async function recordConsent(
  supabase: SupabaseClient<Database>,
  userId: string,
  kind: ConsentKind,
): Promise<void> {
  const { error } = await supabase.from("consents").insert({ user_id: userId, kind, version: currentVersion(kind) });
  if (error) throw error;
}
