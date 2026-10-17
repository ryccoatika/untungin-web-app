import type { MetricsLine, StoreMetrics } from "./metrics";
import type { StoreData } from "./types";

/** Display order: most serious first. */
export const WARNING_CODES = [
  "NET_LOSS",
  "LOSS_PRODUCTS",
  "NEGATIVE_CONTRIBUTION",
  "NO_OWNER_SALARY",
  "BELOW_TARGET",
  "COMPETITOR_GAP",
  "NO_SALES_ESTIMATE",
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export type LineRef = { productId: string; channelId: string };
export type StoreWarning = { code: WarningCode; lines: LineRef[] };

/** Price differs from the competitor's by more than this share of the competitor price. */
export const COMPETITOR_GAP_RATIO = 0.25;

const ref = (line: MetricsLine): LineRef => ({ productId: line.productId, channelId: line.channelId });

export function computeWarnings(data: StoreData, metrics: StoreMetrics): StoreWarning[] {
  const red = metrics.lines.filter((line) => line.status === "red").map(ref);
  const yellow = metrics.lines.filter((line) => line.status === "yellow").map(ref);
  const gaps = metrics.lines
    .filter(
      (line) =>
        line.competitorPrice !== null &&
        line.competitorPrice > 0 &&
        Math.abs(line.price - line.competitorPrice) / line.competitorPrice > COMPETITOR_GAP_RATIO,
    )
    .map(ref);

  const active: Record<WarningCode, LineRef[] | false> = {
    NET_LOSS: metrics.netProfit < 0 && [],
    LOSS_PRODUCTS: red.length > 0 && red,
    NEGATIVE_CONTRIBUTION: metrics.avgContribution !== null && metrics.avgContribution <= 0 && [],
    NO_OWNER_SALARY: !data.expenses.some((expense) => expense.category === "gaji_pemilik") && [],
    BELOW_TARGET: yellow.length > 0 && yellow,
    COMPETITOR_GAP: gaps.length > 0 && gaps,
    NO_SALES_ESTIMATE: metrics.totalUnits === 0 && [],
  };
  return WARNING_CODES.flatMap((code) => {
    const lines = active[code];
    return lines === false ? [] : [{ code, lines }];
  });
}
