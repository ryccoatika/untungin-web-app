import "server-only";
import { cache } from "react";
import type { IsoDate, SalesDayRecord, SalesLineRecord } from "@/lib/records";
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
