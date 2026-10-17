import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatPercent } from "@/lib/format";
import { deleteProductAction, updateProductAction } from "../actions";
import { ProductForm } from "../product-form";

type Params = Promise<{ locale: string; storeId: string; productId: string }>;

export default async function ProductPage({ params }: { params: Params }) {
  const { storeId, productId } = await params;
  const data = await loadStoreData(storeId);
  const product = data?.products.find((p) => p.id === productId);
  if (!data || !product) notFound();
  const t = await getTranslations("Products");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();

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
