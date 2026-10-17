import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteAssetAction, updateAssetAction } from "../actions";
import { AssetForm } from "../asset-form";

type Params = Promise<{ locale: string; storeId: string; assetId: string }>;

export default async function EditAssetPage({ params }: { params: Params }) {
  const { storeId, assetId } = await params;
  const data = await loadStoreData(storeId);
  const asset = data?.assets.find((a) => a.id === assetId);
  if (!data || !asset) notFound();
  const t = await getTranslations("Assets");
  const tCommon = await getTranslations("Common");

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/inventaris`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <AssetForm
            action={updateAssetAction.bind(null, data.store.id, asset.id)}
            defaults={{
              name: asset.name,
              category: asset.category,
              qty: String(asset.qty),
              unitPrice: String(asset.unitPrice),
              usefulLifeMonths: String(asset.usefulLifeMonths),
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <DeleteButton action={deleteAssetAction.bind(null, data.store.id, asset.id)} label={t("delete")} />
    </div>
  );
}
