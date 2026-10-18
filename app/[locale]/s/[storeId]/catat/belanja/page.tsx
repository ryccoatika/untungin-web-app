import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { loadStoreData } from "@/lib/data/load-store-data";
import { loadLatestPurchaseDates, loadPurchases } from "@/lib/data/records";
import { formatDay, formatNumber, formatRupiah } from "@/lib/format";
import { earliestRecordable, jakartaToday, monthOf } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { RecordTabs } from "../record-tabs";
import { deletePurchaseAction, savePurchaseAction } from "./actions";
import { PurchaseForm, type PurchaseDefaults } from "./purchase-form";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Records"))("title") };
}

export default async function RecordPurchasesPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const wanted = (await searchParams).ubah;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Records.purchases");
  const tCommon = await getTranslations("Common");
  const tUnit = await getTranslations("UnitShort");
  const locale = (await getLocale()) as AppLocale;

  const today = jakartaToday(new Date());
  const purchases = await loadPurchases(storeId, `${monthOf(today)}-01`, today);
  // Only a purchase still listed (this month, material not deleted) can be edited.
  const editing =
    typeof wanted === "string" && isUuid(wanted) ? purchases.find((p) => p.id === wanted && p.materialId !== null) : undefined;
  const latest = await loadLatestPurchaseDates(storeId, editing?.id);

  const defaults: PurchaseDefaults = editing
    ? {
        materialId: editing.materialId ?? "",
        qty: String(editing.qty).replace(".", ","),
        unit: editing.unit,
        totalPaid: String(editing.totalPaid),
        date: editing.date,
      }
    : {};

  return (
    <div className="max-w-2xl space-y-4">
      <RecordTabs storeId={storeId} active="purchases" />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{editing ? t("editHeading") : t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.materials.length === 0 ? (
        <EmptyState title={t("noMaterialsTitle")} body={t("noMaterialsBody")}>
          <Link href={`/s/${storeId}/bahan`} className={buttonVariants({ variant: "outline" })}>
            {t("noMaterialsAction")}
          </Link>
        </EmptyState>
      ) : (
        <PurchaseForm
          key={editing?.id ?? "new"}
          action={savePurchaseAction.bind(null, storeId, editing?.id ?? null)}
          materials={data.materials.map((m) => ({
            id: m.id,
            name: m.name,
            purchaseQty: m.purchaseQty,
            purchaseUnit: m.purchaseUnit,
            purchasePrice: m.purchasePrice,
          }))}
          latestDates={Object.fromEntries([...latest].map(([materialId, { date }]) => [materialId, date]))}
          defaults={defaults}
          today={today}
          min={earliestRecordable(today)}
          editing={editing ? { cancelHref: `/s/${storeId}/catat/belanja` } : undefined}
        />
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("listTitle")}</h2>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
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
                  {purchase.materialId !== null && (
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
        )}
      </section>
    </div>
  );
}
