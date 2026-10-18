import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** "Bulan ini sebenarnya: untung Rp…" linking to Laporan, plus a nudge while today is not recorded yet. */
export async function RecordsCard({
  storeId,
  netProfit,
  amount,
  todayRecorded,
}: {
  storeId: string;
  netProfit: number;
  /** `netProfit` as money text (its absolute value is shown). */
  amount: string;
  todayRecorded: boolean;
}) {
  const t = await getTranslations("Dashboard");
  const text = netProfit > 0 ? t("recordsProfit", { amount }) : netProfit < 0 ? t("recordsLoss", { amount }) : t("recordsEven");
  return (
    <div className="space-y-2">
      <Link
        href={`/s/${storeId}/laporan`}
        data-testid="records-card"
        className="flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm hover:bg-muted"
      >
        <span className={cn("font-medium [overflow-wrap:anywhere]", netProfit < 0 && "text-destructive")}>{text}</span>
        <span className="shrink-0 text-muted-foreground underline underline-offset-4">{t("recordsLink")}</span>
      </Link>
      {!todayRecorded && (
        <Link
          href={`/s/${storeId}/catat`}
          data-testid="records-nudge"
          className="flex min-h-12 items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("recordsNudge")}
        </Link>
      )}
    </div>
  );
}
