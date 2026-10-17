import { worstStatus, type LineStatus, type StoreAnalysis, type StoreData } from "@/lib/calc";

export type ChartBar = { productId: string; name: string; value: number; status: LineStatus };

/** More bars than this get unreadable on a phone. */
export const MAX_CHART_BARS = 8;

/**
 * Monthly contribution per product (spec §7 "profit/contribution bars"): Σ over its channels of
 * (net price − material cost) × monthly sales estimate. Products without any estimate are left out.
 * Keeps the MAX_CHART_BARS largest by size (losses count), ordered highest first.
 */
export function productChartData(analysis: StoreAnalysis, data: StoreData): ChartBar[] {
  const names = new Map(data.products.map((product) => [product.id, product.name]));
  const byProduct = new Map<string, { value: number; units: number; lines: { status: LineStatus }[] }>();
  for (const line of analysis.lines) {
    const entry = byProduct.get(line.productId) ?? { value: 0, units: 0, lines: [] };
    entry.value += line.contribution * line.estMonthlySales;
    entry.units += line.estMonthlySales;
    entry.lines.push(line);
    byProduct.set(line.productId, entry);
  }
  const bars: ChartBar[] = [];
  for (const [productId, entry] of byProduct) {
    if (entry.units <= 0) continue;
    bars.push({
      productId,
      name: names.get(productId) ?? "?",
      value: Math.round(entry.value) || 0,
      status: worstStatus(entry.lines) ?? "green",
    });
  }
  return bars
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, MAX_CHART_BARS)
    .sort((a, b) => b.value - a.value);
}
