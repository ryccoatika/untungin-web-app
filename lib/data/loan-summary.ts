import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalcError, tryAnalyzeStore } from "@/lib/calc";
import type { Database } from "@/lib/supabase/database.types";
import { buildLoanSummary, type LoanSummary } from "@/lib/report/loan-summary";
import { parseInstallmentParams } from "@/lib/report/installment";
import { fetchStoreData } from "./store-data";
import { isUuid } from "@/lib/uuid";

type Query = Record<string, string | string[] | undefined>;

export type LoanSummaryResult =
  | { kind: "not-found" }
  | { kind: "calc-error"; error: CalcError; storeId: string; productName: string }
  | { kind: "ok"; summary: LoanSummary; errors: ("principal" | "months" | "rate")[] };

/** Loads the store with the user's own client (RLS) and builds the summary; shared by the page and the CSV route. */
export async function loadLoanSummary(
  supabase: SupabaseClient<Database>,
  userId: string,
  storeId: string,
  query: Query,
  businessTypeLabel: (value: string) => string,
  targetMarketLabel: (value: string) => string,
): Promise<LoanSummaryResult> {
  if (!isUuid(storeId)) return { kind: "not-found" };
  const [data, storeRow, profile] = await Promise.all([
    fetchStoreData(supabase, storeId),
    supabase.from("stores").select("business_type, target_market").eq("id", storeId).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  if (!data || !storeRow.data) return { kind: "not-found" };

  const { analysis, error } = tryAnalyzeStore(data);
  if (!analysis) {
    const productName = data.products.find((p) => p.id === error.productId)?.name ?? "?";
    return { kind: "calc-error", error, storeId, productName };
  }
  const { input, errors } = parseInstallmentParams(query);
  const fullName = profile.data?.full_name?.trim() || null;
  const targetMarket = storeRow.data.target_market;
  const summary = buildLoanSummary(
    data,
    analysis,
    {
      businessType: businessTypeLabel(storeRow.data.business_type),
      targetMarket: targetMarket ? targetMarketLabel(targetMarket) : null,
      ownerName: fullName,
    },
    input,
  );
  return { kind: "ok", summary, errors };
}
