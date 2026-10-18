import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore, type LineRef } from "@/lib/calc";
import { productChartData } from "@/lib/dashboard/chart-data";
import { setupChecklist } from "@/lib/dashboard/checklist";
import { loadStoreData } from "@/lib/data/load-store-data";
import { loadFirstRecordDate, loadSalesRange } from "@/lib/data/records";
import { getStore } from "@/lib/data/stores";
import { formatPercent, formatRupiah, formatRupiahCompact } from "@/lib/format";
import { getBusinessTypeLabel } from "@/lib/i18n/server";
import { jakartaToday, monthOf, monthReport } from "@/lib/records";
import { MetricCards } from "./metric-cards";
import { Moments } from "./moments";
import { ProductChart, type ProductChartBar } from "./product-chart";
import { ProductLines } from "./product-lines";
import { RecordsCard } from "./records-card";
import { SetupChecklist } from "./setup-checklist";
import { WarningsList } from "./warnings-list";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const welcome = (await searchParams).welcome === "1";
  const [store, data] = await Promise.all([getStore(storeId), loadStoreData(storeId)]);
  if (!store || !data) notFound();
  const t = await getTranslations("Dashboard");
  const businessTypeLabel = await getBusinessTypeLabel();
  const locale = await getLocale();
  const tLineStatus = await getTranslations("LineStatus");

  const checklist = setupChecklist(data);
  const { analysis, error } = tryAnalyzeStore(data);
  const chartBars: ProductChartBar[] = analysis
    ? productChartData(analysis, data).map((bar) => ({
        productId: bar.productId,
        name: bar.name,
        value: bar.value,
        status: bar.status,
        valueLabel: formatRupiahCompact(bar.value, locale),
        fullValueLabel: formatRupiah(bar.value, locale),
        statusLabel: tLineStatus(bar.status),
      }))
    : [];
  // The actual result so far this month; only once the store has a first record.
  const firstRecord = analysis ? await loadFirstRecordDate(storeId) : null;
  let records: { netProfit: number; todayRecorded: boolean } | null = null;
  if (analysis && firstRecord !== null) {
    const today = jakartaToday(new Date());
    const month = monthOf(today);
    const range = await loadSalesRange(storeId, `${month}-01`, today);
    const report = monthReport({ month, today, firstRecord, days: range.days, lines: range.lines, analysis, data });
    records = { netProfit: report.netProfit, todayRecorded: range.days.some((day) => day.date === today) };
  }
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const lineLabel = (ref: LineRef) => `${productName(ref.productId)} (${channelName(ref.channelId)})`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
      </div>

      <Moments
        storeId={store.id}
        welcome={welcome}
        profitPositive={analysis !== null && analysis.totalUnits > 0 && analysis.netProfit > 0}
      />

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm [overflow-wrap:anywhere]">
          {t("calcError", { product: productName(error.productId) })}{" "}
          <Link href={`/s/${data.store.id}/produk/${error.productId}`} className="font-medium underline underline-offset-4">
            {t("calcErrorAction")}
          </Link>
        </p>
      )}

      {checklist.some((item) => !item.done && !item.optional) && <SetupChecklist items={checklist} />}

      {analysis && (
        <>
          <MetricCards analysis={analysis} />
          {records && (
            <RecordsCard
              storeId={store.id}
              netProfit={records.netProfit}
              amount={formatRupiah(Math.abs(records.netProfit), locale)}
              todayRecorded={records.todayRecorded}
            />
          )}
          {analysis.lines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/s/${data.store.id}/analisis`} className={buttonVariants()}>
                {t("tryAnalysis")}
              </Link>
              <Link href={`/s/${data.store.id}/simulasi`} className={buttonVariants({ variant: "outline" })}>
                {t("trySimulation")}
              </Link>
            </div>
          )}
          <WarningsList warnings={analysis.warnings} lineLabel={lineLabel} />
          {chartBars.length > 0 && <ProductChart bars={chartBars} />}
          <ProductLines analysis={analysis} data={data} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("basis")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("operatingDays")}</p>
            <p className="text-lg font-medium">{t("operatingDaysValue", { days: store.operating_days_per_month })}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("targetMargin")}</p>
            <p className="text-lg font-medium">{formatPercent(store.target_margin_pct, locale)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
