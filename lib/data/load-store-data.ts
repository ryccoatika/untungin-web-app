import "server-only";
import { cache } from "react";
import type { StoreData } from "@/lib/calc";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { fetchStoreData } from "./store-data";

/** StoreData for the signed-in owner, once per request; null means 404. */
export const loadStoreData = cache(async (storeId: string): Promise<StoreData | null> => {
  if (!isUuid(storeId)) return null;
  return fetchStoreData(await createClient(), storeId);
});
