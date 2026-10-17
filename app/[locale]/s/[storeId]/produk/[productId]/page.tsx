import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { mapById, sameDimension, toBase, tryAnalyzeStore, unitCost } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  addCompositionRowAction,
  deleteCompositionRowAction,
  deleteProductAction,
  savePriceAction,
  updateCompositionRowAction,
  updateProductAction,
} from "../actions";
import { ProductForm } from "../product-form";
import { CompositionEditor, type EditorRow } from "./composition-editor";
import { PriceForm } from "./price-form";

type Params = Promise<{ locale: string; storeId: string; productId: string }>;

export default async function ProductPage({ params }: { params: Params }) {
  const { storeId, productId } = await params;
  const data = await loadStoreData(storeId);
  const product = data?.products.find((p) => p.id === productId);
  if (!data || !product) notFound();
  const t = await getTranslations("Products");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();
  const tComposition = await getTranslations("Composition");
  const materials = mapById(data.materials);
  // Phase 2 rows are shared by every channel; channel-specific rows arrive with the channel page (Phase 3).
  const rows: EditorRow[] = data.composition
    .filter((row) => row.productId === product.id && row.channelId === null)
    .map((row) => {
      const material = materials.get(row.materialId);
      const usable = material && sameDimension(row.unit, material.purchaseUnit);
      const perBatch = usable ? toBase(row.qty, row.unit) * unitCost(material) : 0;
      return {
        id: row.id,
        materialId: row.materialId,
        materialName: material?.name ?? "?",
        qty: row.qty,
        unit: row.unit,
        basis: row.basis,
        costPerUnit: row.basis === "batch" ? perBatch / product.yieldQty : perBatch,
      };
    });
  const tPricing = await getTranslations("Pricing");
  const { error: calcError } = tryAnalyzeStore(data);
  const hasComposition = rows.length > 0;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/s/${data.store.id}/produk`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 text-2xl font-semibold [overflow-wrap:anywhere]">{product.name}</h1>
        {!product.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t("inactive")}</span>}
      </div>

      {calcError?.productId === product.id && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          {tPricing("calcError")}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{tPricing("title")}</CardTitle>
          <CardDescription>{tPricing("intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasComposition && (
            <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              {tPricing("noComposition")}
            </p>
          )}
          {data.channels.map((channel) => {
            const saved = data.prices.find((row) => row.productId === product.id && row.channelId === channel.id);
            return (
              <section key={channel.id} className="space-y-3">
                <h3 className="font-medium [overflow-wrap:anywhere]">{channel.name}</h3>
                <PriceForm
                  id={`price-${channel.id}`}
                  action={savePriceAction.bind(null, data.store.id, product.id, channel.id)}
                  data={data}
                  productId={product.id}
                  channel={channel}
                  defaults={{
                    price: saved ? String(saved.price) : "",
                    estMonthlySales: saved ? String(saved.estMonthlySales) : "",
                  }}
                />
              </section>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tComposition("title")}</CardTitle>
          <CardDescription>{tComposition("intro", { yield: formatNumber(product.yieldQty, locale) })}</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionEditor
            rows={rows}
            materials={data.materials.map(({ id, name, category, purchaseUnit }) => ({ id, name, category, purchaseUnit }))}
            addAction={addCompositionRowAction.bind(null, data.store.id, product.id)}
            updateActions={Object.fromEntries(
              rows.map((row) => [row.id, updateCompositionRowAction.bind(null, data.store.id, product.id, row.id)]),
            )}
            deleteActions={Object.fromEntries(
              rows.map((row) => [row.id, deleteCompositionRowAction.bind(null, data.store.id, product.id, row.id)]),
            )}
            materialsHref={`/s/${data.store.id}/bahan`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            mode="edit"
            action={updateProductAction.bind(null, data.store.id, product.id)}
            storeTargetMargin={formatPercent(data.store.targetMarginPct, locale)}
            defaults={{
              name: product.name,
              category: product.category ?? "",
              yieldQty: String(product.yieldQty),
              targetMarginPct: product.targetMarginPct === null ? "" : String(product.targetMarginPct),
              isActive: product.isActive ? "on" : "",
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <DeleteButton action={deleteProductAction.bind(null, data.store.id, product.id)} label={t("delete")} />
    </div>
  );
}
