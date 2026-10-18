"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { analyzeStoreSkipping } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { revalidateStore } from "@/lib/data/revalidate";
import { formatDay } from "@/lib/format";
import type { AppLocale } from "@/i18n/routing";
import { earliestRecordable, isIsoDate, jakartaToday, parseSalesCounts, snapshotLines, type SalesCount } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

export type SalesSaveResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (message: string): SalesSaveResult => ({ ok: false, message });

async function dateOutOfRange(): Promise<string> {
  const min = earliestRecordable(jakartaToday(new Date()));
  return (await getTranslations("Records.sales"))("errorDate", { min: formatDay(min, (await getLocale()) as AppLocale, true) });
}

/** The error for a missing store, a malformed id or a date outside [today − 92 days, today]; null when fine. */
async function checkStoreAndDate(storeId: string, date: string): Promise<string | null> {
  const t = await getTranslations("Records.sales");
  if (!isUuid(storeId)) return (await getTranslations("Common"))("notFound");
  if (!isIsoDate(date)) return t("errorInvalid");
  const today = jakartaToday(new Date());
  if (date < earliestRecordable(today) || date > today) return dateOutOfRange();
  return null;
}

export async function saveSalesDayAction(storeId: string, date: string, counts: SalesCount[]): Promise<SalesSaveResult> {
  const { supabase } = await requireUser();
  const t = await getTranslations("Records.sales");
  const tCommon = await getTranslations("Common");
  const problem = await checkStoreAndDate(storeId, date);
  if (problem) return fail(problem);

  const data = await loadStoreData(storeId);
  if (!data) return fail(tCommon("notFound"));
  const { analysis, skipped } = analyzeStoreSkipping(data);
  // A recipe broken since the screen loaded: say which product, rather than "invalid data".
  const stale = skipped.find((error) => Array.isArray(counts) && counts.some((count) => count?.productId === error.productId));
  if (stale) return fail(t("calcSkipped", { product: data.products.find((p) => p.id === stale.productId)?.name ?? "?" }));

  // analysis.lines holds only active, costable products with a price: exactly the pairs the screen offers.
  const parsed = parseSalesCounts(counts, analysis.lines);
  if (!parsed) return fail(t("errorInvalid"));

  const lines = snapshotLines(data, analysis, parsed).map((line) => ({
    product_id: line.productId,
    channel_id: line.channelId,
    product_name: line.productName,
    channel_name: line.channelName,
    qty: line.qty,
    unit_price: line.unitPrice,
    net_unit: line.netUnit,
    hpp_unit: line.hppUnit,
  }));
  const { error: rpcError } = await supabase.rpc("save_sales_day", { p_store_id: storeId, p_date: date, p_lines: lines });
  if (rpcError) {
    if (rpcError.code === "UT002") return fail(await dateOutOfRange());
    return fail(tCommon("saveFailed"));
  }

  revalidateStore();
  return { ok: true, message: t("saved") };
}

export async function closeSalesDayAction(storeId: string, date: string): Promise<SalesSaveResult> {
  const { supabase } = await requireUser();
  const t = await getTranslations("Records.sales");
  const problem = await checkStoreAndDate(storeId, date);
  if (problem) return fail(problem);

  const { error } = await supabase.rpc("close_sales_day", { p_store_id: storeId, p_date: date });
  if (error) {
    if (error.code === "UT002") return fail(await dateOutOfRange());
    return fail((await getTranslations("Common"))("saveFailed"));
  }

  revalidateStore();
  return { ok: true, message: t("closedSaved") };
}

export async function deleteSalesDayAction(storeId: string, date: string): Promise<SalesSaveResult> {
  const { supabase } = await requireUser();
  const problem = await checkStoreAndDate(storeId, date);
  if (problem) return fail(problem);

  const { error } = await supabase.rpc("delete_sales_day", { p_store_id: storeId, p_date: date });
  if (error) {
    if (error.code === "UT002") return fail(await dateOutOfRange());
    return fail((await getTranslations("Common"))("deleteFailed"));
  }

  revalidateStore();
  return { ok: true, message: (await getTranslations("Records.sales"))("dayDeleted") };
}

export async function deleteSalesLineAction(storeId: string, lineId: string): Promise<SalesSaveResult> {
  const { supabase } = await requireUser();
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(lineId)) return fail(tCommon("notFound"));

  // RLS hides other owners' lines; the store filter also rejects a line of another store of the same owner.
  const { data: line, error: findError } = await supabase
    .from("sales_lines")
    .select("id")
    .eq("id", lineId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (findError) return fail(tCommon("deleteFailed"));
  if (!line) return fail(tCommon("notFound"));

  const { error } = await supabase.rpc("delete_sales_line", { p_line_id: lineId });
  if (error) return fail(tCommon("deleteFailed"));

  revalidateStore();
  return { ok: true, message: (await getTranslations("Records.sales"))("lineRemoved") };
}
