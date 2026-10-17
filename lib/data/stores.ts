import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type Store = Tables<"stores">;
export type StoreSummary = Pick<Store, "id" | "name" | "business_type">;

/** RLS returns nothing for stores the user does not own, so null means 404. */
export const getStore = cache(async (storeId: string): Promise<Store | null> => {
  if (!isUuid(storeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("stores").select("*").eq("id", storeId).maybeSingle();
  if (error) throw error;
  return data;
});

export const listStores = cache(async (): Promise<StoreSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, business_type")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
});
