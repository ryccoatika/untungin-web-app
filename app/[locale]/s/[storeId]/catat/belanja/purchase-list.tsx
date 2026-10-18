import { getLocale, getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { PurchaseRecord } from "@/lib/data/records";
import { formatDay, formatNumber, formatRupiah } from "@/lib/format";
import { earliestRecordable, jakartaToday } from "@/lib/records";
import { deletePurchaseAction } from "./actions";

/** Purchases with edit (Belanja form) and delete; shared by Belanja and Laporan. */
export async function PurchaseList({ storeId, purchases }: { storeId: string; purchases: PurchaseRecord[] }) {
  const t = await getTranslations("Records.purchases");
  const tCommon = await getTranslations("Common");
  const tUnit = await getTranslations("UnitShort");
  const locale = (await getLocale()) as AppLocale;

  // The form can only open purchases inside the recordable window; older ones can still be deleted.
  const oldest = earliestRecordable(jakartaToday(new Date()));

  return (
    <ul className="divide-y rounded-lg border">
      {purchases.map((purchase) => (
        <li key={purchase.id} className="space-y-2 px-3 py-3">
          <div className="min-w-0">
            <p className="font-medium [overflow-wrap:anywhere]">
              {purchase.materialName}
              {purchase.materialId === null && <span className="text-sm font-normal text-muted-foreground"> ({t("removedMaterial")})</span>}
            </p>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {formatDay(purchase.date, locale)} ·{" "}
              {t("item", {
                qty: formatNumber(purchase.qty, locale),
                unit: tUnit(purchase.unit),
                total: formatRupiah(purchase.totalPaid, locale),
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {purchase.materialId !== null && purchase.date >= oldest && (
              <Link
                href={`/s/${storeId}/catat/belanja?ubah=${purchase.id}`}
                aria-label={t("editLabel", { material: purchase.materialName })}
                className={buttonVariants({ variant: "outline" })}
              >
                {t("edit")}
              </Link>
            )}
            <DeleteButton action={deletePurchaseAction.bind(null, storeId, purchase.id)} label={tCommon("delete")} />
          </div>
        </li>
      ))}
    </ul>
  );
}
