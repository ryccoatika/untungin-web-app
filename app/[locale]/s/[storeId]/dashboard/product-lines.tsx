import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/store/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { StoreAnalysis, StoreData } from "@/lib/calc";
import { formatPercent, formatRupiah } from "@/lib/format";

/** One row per product and channel; stacked on phones, columns from `lg`. */
export function ProductLines({ analysis, data }: { analysis: StoreAnalysis; data: StoreData }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  if (analysis.lines.length === 0 && analysis.productsWithoutPrice.length === 0) return null;
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const columns = "lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-center lg:gap-3";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("productsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.lines.length > 0 && (
          <div>
            <div className={`hidden px-2 pb-2 text-xs text-muted-foreground lg:grid ${columns}`} aria-hidden>
              <span>{t("productsTitle")}</span>
              <span>{t("price")}</span>
              <span>{t("cost")}</span>
              <span>{t("margin")}</span>
              <span>{t("status")}</span>
            </div>
            <ul className="divide-y rounded-lg border">
              {analysis.lines.map((line) => (
                <li key={`${line.productId}:${line.channelId}`}>
                  <Link
                    href={`/s/${data.store.id}/produk/${line.productId}`}
                    className={`grid gap-1 px-2 py-3 hover:bg-accent/60 ${columns}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">{productName(line.productId)}</span>
                      <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{channelName(line.channelId)}</span>
                    </span>
                    <span className="text-sm whitespace-nowrap">
                      <span className="text-muted-foreground lg:sr-only">{t("price")}: </span>
                      {formatRupiah(line.price, locale)}
                    </span>
                    <span className="text-sm whitespace-nowrap">
                      <span className="text-muted-foreground lg:sr-only">{t("cost")}: </span>
                      {formatRupiah(line.fullCost ?? line.materialCost, locale)}
                    </span>
                    <span className="text-sm whitespace-nowrap">
                      <span className="text-muted-foreground lg:sr-only">{t("margin")}: </span>
                      {line.marginPct === null ? "—" : formatPercent(line.marginPct, locale)}
                    </span>
                    <StatusBadge status={line.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.productsWithoutPrice.length > 0 && (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {t("withoutPrice", { products: analysis.productsWithoutPrice.map(productName).join(", ") })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
