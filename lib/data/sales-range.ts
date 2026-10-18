import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate, SalesDayRecord, SalesLineRecord } from "@/lib/records";
import type { Database, Tables } from "@/lib/supabase/database.types";

/** Rows per request; below the API's max_rows (1000) so no page is cut silently. */
export const SALES_PAGE_SIZE = 500;

export function toSalesLine(row: Tables<"sales_lines">, date: IsoDate): SalesLineRecord {
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

/** The store's days with `from <= date <= to` (inclusive), oldest first, with the day ids. */
export async function fetchSalesDays(
  supabase: SupabaseClient<Database>,
  storeId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<(SalesDayRecord & { id: string })[]> {
  const { data, error } = await supabase
    .from("sales_days")
    .select("id, date, closed")
    .eq("store_id", storeId)
    .gte("date", from)
    .lte("date", to)
    .order("date");
  if (error) throw error;
  return data ?? [];
}

/**
 * Days and every line of `from <= date <= to`. Lines are read page by page in a stable order, because one request
 * is cut at the API's max_rows without any error.
 */
export async function fetchSalesRange(
  supabase: SupabaseClient<Database>,
  storeId: string,
  from: IsoDate,
  to: IsoDate,
  pageSize = SALES_PAGE_SIZE,
): Promise<{ days: SalesDayRecord[]; lines: SalesLineRecord[] }> {
  const days = await fetchSalesDays(supabase, storeId, from, to);
  const publicDays = days.map((day) => ({ date: day.date, closed: day.closed }));
  if (days.length === 0) return { days: [], lines: [] };

  const dateOf = new Map(days.map((day) => [day.id, day.date]));
  const dayIds = [...dateOf.keys()];
  const lines: SalesLineRecord[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("sales_lines")
      .select("*")
      .in("day_id", dayIds)
      .order("day_id")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) lines.push(toSalesLine(row, dateOf.get(row.day_id)!));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return { days: publicDays, lines };
}
