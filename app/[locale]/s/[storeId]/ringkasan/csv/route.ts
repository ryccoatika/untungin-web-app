import { getTranslations } from "next-intl/server";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { loadLoanSummary } from "@/lib/data/loan-summary";
import { createClient } from "@/lib/supabase/server";
import { loanSummaryCsv, type CsvLabels } from "@/lib/report/csv";
import { EXPENSE_CATEGORIES } from "@/lib/calc";

/** ASCII file-name part from a store name: "Kedai Kopi Contoh" gives "kedai-kopi-contoh". */
function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "toko";
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ locale: string; storeId: string }> }) {
  const { locale: rawLocale, storeId } = await ctx.params;
  const locale = routing.locales.find((candidate) => candidate === rawLocale);
  if (!locale) return new Response("Not found", { status: 404 });

  // The proxy already redirects visitors without a session; this is the second check, with the same claims call as requireUser.
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (authError || !userId) return new Response("Unauthorized", { status: 401 });

  const t = await getTranslations({ locale, namespace: "Report" });
  const tBusiness = await getTranslations({ locale, namespace: "BusinessType" });
  const tMarket = await getTranslations({ locale, namespace: "TargetMarket" });
  const tCategory = await getTranslations({ locale, namespace: "ExpenseCategory" });
  const lookup = (tr: typeof tBusiness) => (value: string) => (tr.has(value as never) ? tr(value as never) : value);

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = await loadLoanSummary(supabase, userId, storeId, query, lookup(tBusiness), lookup(tMarket));
  if (result.kind === "not-found") return new Response("Not found", { status: 404 });
  if (result.kind === "calc-error") return new Response(t("calcError", { product: result.productName }), { status: 422 });

  const labels: CsvLabels = {
    sectionStore: t("csvSectionStore"),
    sectionMonthly: t("monthlyTitle"),
    sectionFixedCosts: t("fixedCostsTitle"),
    sectionProducts: t("productsTitle"),
    sectionAssets: t("assetsTitle"),
    sectionIndicators: t("indicatorsTitle"),
    sectionInstallment: t("csvSectionInstallment"),
    storeName: t("storeName"),
    businessType: t("businessType"),
    targetMarket: t("targetMarket"),
    ownerName: t("ownerName"),
    operatingDays: t("operatingDays"),
    grossRevenue: t("grossRevenue"),
    materialCosts: t("materialCosts"),
    grossProfit: t("grossProfit"),
    depreciation: t("depreciation"),
    fixedCostsTotal: t("fixedCostsTotal"),
    netProfit: t("netProfit"),
    netMarginPct: t("netMargin"),
    product: t("product"),
    channel: t("channel"),
    price: t("price"),
    fullCost: t("fullCost"),
    materialCost: t("materialCost"),
    marginPct: t("margin"),
    estMonthlySales: t("estSales"),
    assetName: t("asset"),
    qty: t("qty"),
    value: t("value"),
    usefulLifeMonths: t("usefulLife"),
    totalCapital: t("totalCapital"),
    breakEvenMonthly: t("bepMonthly"),
    breakEvenDaily: t("bepDaily"),
    paybackMonths: t("payback"),
    principal: t("principal"),
    months: t("months"),
    annualRatePct: t("rate"),
    monthlyInstallment: t("monthlyInstallment"),
    totalRepaid: t("totalRepaid"),
    shareOfNetProfitPct: t("shareLabel"),
    categories: Object.fromEntries(EXPENSE_CATEGORIES.map((category) => [category, tCategory(category)])),
  };

  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const filename = `ringkasan-${slugify(result.summary.store.name)}-${date}.csv`;
  return new Response(loanSummaryCsv(result.summary, labels), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
