import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { assetMonthlyDepreciation, monthlyDepreciation, totalCapital } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatNumber, formatRupiah } from "@/lib/format";
import { createAssetAction } from "./actions";
import { AssetForm } from "./asset-form";

export default async function AssetsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Assets");
  const tCommon = await getTranslations("Common");
  const tCategory = await getTranslations("AssetCategory");
  const locale = await getLocale();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.assets.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-asset" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("totalCapital")}</p>
                <p className="text-lg font-semibold [overflow-wrap:anywhere]" data-testid="assets-capital">
                  {formatRupiah(totalCapital(data.assets), locale)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("monthlyDepreciation")}</p>
                <p className="text-lg font-semibold [overflow-wrap:anywhere]" data-testid="assets-depreciation">
                  {formatRupiah(monthlyDepreciation(data.assets), locale)}
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">{t("depreciationHint")}</p>
          <ul className="divide-y rounded-lg border">
            {data.assets.map((asset) => (
              <li key={asset.id}>
                <Link
                  href={`/s/${data.store.id}/inventaris/${asset.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{asset.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {tCategory(asset.category)} ·{" "}
                      {t("itemSummary", { qty: formatNumber(asset.qty, locale), price: formatRupiah(asset.unitPrice, locale) })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium">
                    {t("itemDepreciation", { amount: formatRupiah(assetMonthlyDepreciation(asset), locale) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            id="add-asset"
            action={createAssetAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
