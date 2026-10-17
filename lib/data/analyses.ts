import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type StoredAnalysis = { id: string; createdAt: string; snapshotHash: string; output: unknown };

/** Newest first. RLS limits it to stores the signed-in user owns. */
export async function listAnalyses(supabase: SupabaseClient<Database>, storeId: string, limit: number): Promise<StoredAnalysis[]> {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("id, created_at, snapshot_hash, output")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, createdAt: row.created_at, snapshotHash: row.snapshot_hash, output: row.output }));
}

/** The signed-in user's analyses since `since` (RLS: own rows only), for the quota shown on the page. */
export async function countUsageSince(supabase: SupabaseClient<Database>, since: Date): Promise<number> {
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}
