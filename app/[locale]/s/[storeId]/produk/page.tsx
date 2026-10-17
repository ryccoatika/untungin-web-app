import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/store/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore, worstStatus } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatPercent, formatRupiah } from "@/lib/format";
import { createProductAction } from "./actions";
import { ProductForm } from "./product-form";

export default async function ProductsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Products");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();
  const { analysis } = tryAnalyzeStore(data);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.products.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-product" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.products.map((product) => {
            const lines = analysis?.lines.filter((line) => line.productId === product.id) ?? [];
            const status = worstStatus(lines);
            const summary = lines.length
              ? t("materialCostValue", { cost: formatRupiah(lines[0].materialCost, locale) })
              : t("noPrice");
            return (
              <li key={product.id}>
                <Link
                  href={`/s/${data.store.id}/produk/${product.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{product.name}</span>
                    <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {product.category ? `${product.category} · ${summary}` : summary}
                    </span>
                  </span>
                  {!product.isActive ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{t("inactive")}</span>
                  ) : (
                    status && <StatusBadge status={status} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            id="add-product"
            mode="create"
            action={createProductAction.bind(null, data.store.id)}
            storeTargetMargin={formatPercent(data.store.targetMarginPct, locale)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
