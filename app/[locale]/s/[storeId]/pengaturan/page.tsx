import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/data/stores";
import { DeleteStoreForm } from "./delete-store-form";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const t = await getTranslations("Settings");

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("storeData")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            storeId={store.id}
            defaults={{
              name: store.name,
              businessType: store.business_type,
              targetMarket: store.target_market,
              operatingDaysPerMonth: store.operating_days_per_month,
              targetMarginPct: store.target_margin_pct,
            }}
          />
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("deleteTitle")}</CardTitle>
          <CardDescription>{t("deleteDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteStoreForm storeId={store.id} storeName={store.name} />
        </CardContent>
      </Card>
    </div>
  );
}
