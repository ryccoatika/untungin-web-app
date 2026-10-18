import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteMaterialAction, updateMaterialAction } from "../actions";
import { MaterialForm } from "../material-form";

type Params = Promise<{ locale: string; storeId: string; materialId: string }>;

export default async function EditMaterialPage({ params }: { params: Params }) {
  const { storeId, materialId } = await params;
  const data = await loadStoreData(storeId);
  const material = data?.materials.find((m) => m.id === materialId);
  if (!data || !material) notFound();
  const t = await getTranslations("Materials");
  const tCommon = await getTranslations("Common");
  const usedIn = data.products.filter((product) =>
    data.composition.some((row) => row.productId === product.id && row.materialId === material.id),
  );

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/bahan`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <MaterialForm
            action={updateMaterialAction.bind(null, data.store.id, material.id)}
            defaults={{
              name: material.name,
              category: material.category,
              purchaseQty: String(material.purchaseQty),
              purchaseUnit: material.purchaseUnit,
              purchasePrice: String(material.purchasePrice),
              wastePct: String(material.wastePct),
              gramsPerSdm: material.gramsPerSdm == null ? "" : String(material.gramsPerSdm),
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      {usedIn.length > 0 && (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {t("usedIn", { products: usedIn.map((product) => product.name).join(", ") })}
        </p>
      )}
      <DeleteButton action={deleteMaterialAction.bind(null, data.store.id, material.id)} label={t("delete")} />
    </div>
  );
}
