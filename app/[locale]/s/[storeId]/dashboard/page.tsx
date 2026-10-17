import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/data/stores";
import { formatPercent } from "@/lib/format";
import { getBusinessTypeLabel } from "@/lib/i18n/server";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const t = await getTranslations("Dashboard");
  const businessTypeLabel = await getBusinessTypeLabel();
  // Typed as "id" | "en" through the next-intl AppConfig augmentation in global.ts.
  const appLocale = await getLocale();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
      </div>
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
            <p className="text-lg font-medium">{formatPercent(store.target_margin_pct, appLocale)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
