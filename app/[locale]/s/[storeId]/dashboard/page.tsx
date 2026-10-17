import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore, type LineRef } from "@/lib/calc";
import { setupChecklist } from "@/lib/dashboard/checklist";
import { loadStoreData } from "@/lib/data/load-store-data";
import { getStore } from "@/lib/data/stores";
import { formatPercent } from "@/lib/format";
import { getBusinessTypeLabel } from "@/lib/i18n/server";
import { MetricCards } from "./metric-cards";
import { ProductLines } from "./product-lines";
import { SetupChecklist } from "./setup-checklist";
import { WarningsList } from "./warnings-list";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const [store, data] = await Promise.all([getStore(storeId), loadStoreData(storeId)]);
  if (!store || !data) notFound();
  const t = await getTranslations("Dashboard");
  const businessTypeLabel = await getBusinessTypeLabel();
  const locale = await getLocale();

  const checklist = setupChecklist(data);
  const { analysis, error } = tryAnalyzeStore(data);
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const lineLabel = (ref: LineRef) => `${productName(ref.productId)} (${channelName(ref.channelId)})`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm [overflow-wrap:anywhere]">
          {t("calcError", { product: productName(error.productId) })}{" "}
          <Link href={`/s/${data.store.id}/produk/${error.productId}`} className="font-medium underline underline-offset-4">
            {t("calcErrorAction")}
          </Link>
        </p>
      )}

      {checklist.some((item) => !item.done) && <SetupChecklist items={checklist} />}

      {analysis && (
        <>
          <MetricCards analysis={analysis} />
          <WarningsList warnings={analysis.warnings} lineLabel={lineLabel} />
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
