import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { SimulationPanel } from "./simulation-panel";

type Props = { params: Promise<{ locale: string; storeId: string }> };

export default async function SimulationPage({ params }: Props) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Simulation");
  const { analysis } = tryAnalyzeStore(data);
  // A CalcError still opens the panel, which explains what to fix.
  const hasSomethingToSimulate = analysis === null || analysis.lines.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {hasSomethingToSimulate ? (
        <SimulationPanel data={data} />
      ) : (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <Link href={`/s/${data.store.id}/produk`} className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
