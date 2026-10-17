import { useLocale, useTranslations } from "next-intl";
import { GroupedNumber } from "@/components/store/grouped-number";
import { Card, CardContent } from "@/components/ui/card";
import type { StoreAnalysis } from "@/lib/calc";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type Metric = { key: string; label: string; value: string; hint: string | null; negative?: boolean };

/** Net profit, revenue, break-even per day, payback (spec §5.2). "—" plus a hint when a value can't exist yet. */
export function MetricCards({ analysis }: { analysis: StoreAnalysis }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const hasSales = analysis.totalUnits > 0;

  const metrics: Metric[] = [
    {
      key: "netProfit",
      label: t("netProfit"),
      value: hasSales ? formatRupiah(analysis.netProfit, locale) : "—",
      hint: hasSales ? null : t("needSales"),
      negative: hasSales && analysis.netProfit < 0,
    },
    {
      key: "grossRevenue",
      label: t("grossRevenue"),
      value: hasSales ? formatRupiah(analysis.grossRevenue, locale) : "—",
      hint: null,
    },
    {
      key: "bep",
      label: t("bep"),
      value: analysis.bepUnitsDaily === null ? "—" : t("bepValue", { units: analysis.bepUnitsDaily }),
      hint:
        analysis.bepUnitsMonthly !== null
          ? t("bepMonthly", { units: analysis.bepUnitsMonthly })
          : hasSales
            ? t("bepLoss")
            : t("needSales"),
    },
    {
      key: "payback",
      label: t("payback"),
      value:
        analysis.paybackMonths === null || analysis.totalCapital === 0
          ? "—"
          : t("paybackValue", { months: formatNumber(analysis.paybackMonths, locale, 1) }),
      hint:
        !hasSales ? t("needSales") : analysis.paybackMonths === null ? t("paybackUnknown") : analysis.totalCapital === 0 ? t("paybackNoCapital") : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.key} className="min-w-0">
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p
              data-testid={`metric-${metric.key}`}
              className={cn("break-normal text-base font-semibold tabular-nums sm:text-xl", metric.negative && "text-destructive")}
            >
              <GroupedNumber text={metric.value} />
            </p>
            {metric.hint && <p className="text-xs text-muted-foreground">{metric.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
