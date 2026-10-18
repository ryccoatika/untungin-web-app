import "server-only";
import { cache } from "react";
import type { Unit } from "@/lib/calc";
import { earliestRecordable, jakartaToday, type IsoDate, type SalesDayRecord, type SalesLineRecord } from "@/lib/records";
import { fetchSalesDays, fetchSalesRange, toSalesLine } from "@/lib/data/sales-range";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/** One day's record with its lines; null when nothing was recorded for that date (or the store is not the user's). */
export const loadSalesDay = cache(
  async (storeId: string, date: IsoDate): Promise<{ closed: boolean; lines: SalesLineRecord[] } | null> => {
    if (!isUuid(storeId)) return null;
    const supabase = await createClient();
    const { data: day, error } = await supabase
      .from("sales_days")
      .select("id, closed")
      .eq("store_id", storeId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    if (!day) return null;
    const { data: rows, error: linesError } = await supabase
      .from("sales_lines")
      .select("*")
      .eq("day_id", day.id)
      .order("product_name")
      .order("channel_name")
      .order("id");
    if (linesError) throw linesError;
    return { closed: day.closed, lines: (rows ?? []).map((row) => toSalesLine(row, date)) };
  },
);

/** Days and every line with `from <= date <= to` (inclusive). */
export const loadSalesRange = cache(
  async (storeId: string, from: IsoDate, to: IsoDate): Promise<{ days: SalesDayRecord[]; lines: SalesLineRecord[] }> => {
    if (!isUuid(storeId)) return { days: [], lines: [] };
    return fetchSalesRange(await createClient(), storeId, from, to);
  },
);

/** Only the days (no lines) with `from <= date <= to`: enough to tell which dates are recorded. */
export const loadSalesDays = cache(async (storeId: string, from: IsoDate, to: IsoDate): Promise<SalesDayRecord[]> => {
  if (!isUuid(storeId)) return [];
  const days = await fetchSalesDays(await createClient(), storeId, from, to);
  return days.map((day) => ({ date: day.date, closed: day.closed }));
});

/** The store's first recorded day (a day with sales or marked closed), or null before any record. */
export const loadFirstRecordDate = cache(async (storeId: string): Promise<IsoDate | null> => {
  if (!isUuid(storeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_days")
    .select("date")
    .eq("store_id", storeId)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date ?? null;
});

export type PurchaseRecord = {
  id: string;
  /** Null after the material was deleted; the purchase stays as a record. */
  materialId: string | null;
  materialName: string;
  date: IsoDate;
  qty: number;
  unit: Unit;
  totalPaid: number;
};

/** Purchases with `from <= date <= to` (inclusive), newest first. */
export const loadPurchases = cache(async (storeId: string, from: IsoDate, to: IsoDate): Promise<PurchaseRecord[]> => {
  if (!isUuid(storeId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("id, material_id, material_name, date, qty, unit, total_paid")
    .eq("store_id", storeId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("saved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    materialId: row.material_id,
    materialName: row.material_name,
    date: row.date,
    qty: Number(row.qty),
    unit: row.unit as Unit,
    totalPaid: row.total_paid,
  }));
});

/**
 * The latest purchase of each material (by date, then saved last), skipping `excludeId` (the purchase being edited).
 * Only purchases a new or edited one could be older than count (date >= earliest recordable day), so a material
 * whose last purchase is older has no entry.
 */
export const loadLatestPurchaseDates = cache(
  async (storeId: string, excludeId?: string): Promise<Map<string, { id: string; date: IsoDate }>> => {
    const latest = new Map<string, { id: string; date: IsoDate }>();
    if (!isUuid(storeId)) return latest;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchases")
      .select("id, material_id, date")
      .eq("store_id", storeId)
      .gte("date", earliestRecordable(jakartaToday(new Date())))
      .not("material_id", "is", null)
      .order("date", { ascending: false })
      .order("saved_at", { ascending: false });
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.material_id && row.id !== excludeId && !latest.has(row.material_id)) {
        latest.set(row.material_id, { id: row.id, date: row.date });
      }
    }
    return latest;
  },
);
