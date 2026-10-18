import "server-only";
import { cache } from "react";
import type { Unit } from "@/lib/calc";
import { earliestRecordable, jakartaToday, type IsoDate, type SalesDayRecord, type SalesLineRecord } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { isUuid } from "@/lib/uuid";

function toLine(row: Tables<"sales_lines">, date: IsoDate): SalesLineRecord {
  return {
    id: row.id,
    date,
    productId: row.product_id,
    channelId: row.channel_id,
    productName: row.product_name,
    channelName: row.channel_name,
    qty: row.qty,
    unitPrice: row.unit_price,
    netUnit: Number(row.net_unit),
    hppUnit: Number(row.hpp_unit),
  };
}

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
    return { closed: day.closed, lines: (rows ?? []).map((row) => toLine(row, date)) };
  },
);

/** Days and lines with `from <= date <= to` (inclusive). */
export const loadSalesRange = cache(
  async (storeId: string, from: IsoDate, to: IsoDate): Promise<{ days: SalesDayRecord[]; lines: SalesLineRecord[] }> => {
    if (!isUuid(storeId)) return { days: [], lines: [] };
    const supabase = await createClient();
    const { data: days, error } = await supabase
      .from("sales_days")
      .select("id, date, closed")
      .eq("store_id", storeId)
      .gte("date", from)
      .lte("date", to)
      .order("date");
    if (error) throw error;
    if (!days?.length) return { days: [], lines: [] };
    const dateOf = new Map(days.map((day) => [day.id, day.date]));
    const { data: rows, error: linesError } = await supabase
      .from("sales_lines")
      .select("*")
      .in("day_id", [...dateOf.keys()])
      .order("id");
    if (linesError) throw linesError;
    return {
      days: days.map((day) => ({ date: day.date, closed: day.closed })),
      lines: (rows ?? []).map((row) => toLine(row, dateOf.get(row.day_id)!)),
    };
  },
);

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
