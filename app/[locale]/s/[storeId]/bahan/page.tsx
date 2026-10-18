import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { BASE_UNIT, dimensionOf, unitCost } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { createMaterialAction } from "./actions";
import { MaterialForm } from "./material-form";

export default async function MaterialsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Materials");
  const tCommon = await getTranslations("Common");
  const tCategory = await getTranslations("MaterialCategory");
  const tUnit = await getTranslations("UnitShort");
  const locale = await getLocale();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.materials.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-material" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.materials.map((material) => (
            <li key={material.id}>
              <Link
                href={`/s/${data.store.id}/bahan/${material.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
              >
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">{material.name}</span>
                  <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {tCategory(material.category)} · {formatNumber(material.purchaseQty, locale)} {tUnit(material.purchaseUnit)} ·{" "}
                    {formatRupiah(material.purchasePrice, locale)}
                    {material.wastePct > 0 && ` · ${t("wasteValue", { pct: formatPercent(material.wastePct, locale) })}`}
                    {material.gramsPerSdm != null && dimensionOf(material.purchaseUnit) === "mass" &&
                      ` · ${t("spoonWeightShown", { grams: formatNumber(material.gramsPerSdm, locale) })}`}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-medium">
                  {t("perBaseUnit", {
                    cost: formatRupiah(unitCost(material), locale, 2),
                    unit: tUnit(BASE_UNIT[dimensionOf(material.purchaseUnit)]),
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MaterialForm
            id="add-material"
            action={createMaterialAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
