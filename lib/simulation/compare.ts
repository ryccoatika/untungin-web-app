import type { StoreMetrics } from "@/lib/calc";

export const COMPARED_METRICS = ["netProfit", "grossRevenue", "netMarginPct", "bepUnitsDaily", "paybackMonths"] as const;
export type ComparedMetric = (typeof COMPARED_METRICS)[number];
export type MetricComparison = {
  key: ComparedMetric;
  now: number | null;
  sim: number | null;
  diff: number | null;
  tone: "better" | "worse" | "same";
};

const HIGHER_IS_BETTER: Record<ComparedMetric, boolean> = {
  netProfit: true,
  grossRevenue: true,
  netMarginPct: true,
  bepUnitsDaily: false,
  paybackMonths: false,
};

/** Decimals the panel shows for each metric's difference; tone follows what the user reads. */
const DIFF_DECIMALS: Record<ComparedMetric, number> = {
  netProfit: 0,
  grossRevenue: 0,
  netMarginPct: 1,
  bepUnitsDaily: 0,
  paybackMonths: 1,
};

/**
 * Profit and revenue mean nothing when no sales are expected (the dashboard shows "—" then too), and payback
 * means nothing without assets. `showWithoutSales` keeps profit and revenue (e.g. the loss at −100% sales).
 */
function valueOf(metrics: StoreMetrics, key: ComparedMetric, showWithoutSales = false): number | null {
  if ((key === "netProfit" || key === "grossRevenue") && metrics.totalUnits === 0 && !showWithoutSales) return null;
  if (key === "paybackMonths" && metrics.totalCapital === 0) return null;
  return metrics[key];
}

export function compareMetrics(
  now: StoreMetrics,
  sim: StoreMetrics,
  options: { simHasEstimates?: boolean } = {},
): MetricComparison[] {
  return COMPARED_METRICS.map((key) => {
    const before = valueOf(now, key);
    const after = valueOf(sim, key, options.simHasEstimates);
    const diff = before === null || after === null ? null : after - before;
    let tone: "better" | "worse" | "same";

    if (diff === null || Math.abs(Number(diff.toFixed(DIFF_DECIMALS[key]))) === 0) {
      // For break-even and payback, null has direction meaning
      if ((key === "bepUnitsDaily" || key === "paybackMonths") && before !== after) {
        // Appearing (now null → sim value) or disappearing (now value → sim null)
        if (before === null && after !== null) tone = "better"; // Never breaks even → breaks even
        else if (before !== null && after === null) tone = "worse"; // Breaks even → never breaks even
        else tone = "same";
      } else {
        tone = "same";
      }
    } else {
      tone = diff > 0 === HIGHER_IS_BETTER[key] ? "better" : "worse";
    }

    return { key, now: before, sim: after, diff, tone };
  });
}
