import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { loadLatestPurchaseDates, loadPurchases } from "@/lib/data/records";
import { earliestRecordable, jakartaToday, monthOf } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { RecordTabs } from "../record-tabs";
import { savePurchaseAction } from "./actions";
import { PurchaseForm, type PurchaseDefaults } from "./purchase-form";
import { PurchaseList } from "./purchase-list";

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

  const today = jakartaToday(new Date());
  const purchases = await loadPurchases(storeId, `${monthOf(today)}-01`, today);
  // Any purchase in the recordable window whose material still exists can be edited (Laporan links to older months).
  let editing: (typeof purchases)[number] | undefined;
  if (typeof wanted === "string" && isUuid(wanted)) {
    const candidates = purchases.some((p) => p.id === wanted) ? purchases : await loadPurchases(storeId, earliestRecordable(today), today);
    editing = candidates.find((p) => p.id === wanted && p.materialId !== null);
  }
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
          <PurchaseList storeId={storeId} purchases={purchases} />
        )}
      </section>
    </div>
  );
}
