import type { StoreMetrics } from "./metrics";
import { mapById, materialCostPerUnit } from "./products";
import type { StoreData } from "./types";

export type Recommendation =
  | { kind: "price"; price: number; includesOperatingCosts: boolean }
  | { kind: "impossible" };

/** Matches the price field's maximum in lib/validation/common.ts (lib/calc must not import from it). */
const MAX_RECOMMENDED_PRICE = 2_000_000_000;

/** Rounds up to the next Rp500, ignoring floating-point noise just above a multiple. */
export function ceilTo500(value: number): number {
  return (Math.ceil(value / 500 - 1e-9) || 0) * 500;
}

/**
 * Spec §4.2 item 9: price = ceilTo500((cost + fixedFee) / (1 − commission − margin)), where margin is
 * profit as a share of the selling price. When commission + margin reach 100% no price works.
 */
export function recommendPrice(input: {
  cost: number;
  includesOperatingCosts: boolean;
  fixedFee: number;
  commissionPct: number;
  targetMarginPct: number;
}): Recommendation {
  // Rounded to 6 decimals so decimal percentages (64,1 + 35,9) do not leave float noise above zero.
  const sharePct = Math.round((100 - input.commissionPct - input.targetMarginPct) * 1e6) / 1e6;
  if (sharePct <= 0) return { kind: "impossible" };
  const price = ceilTo500((input.cost + input.fixedFee) / (sharePct / 100));
  if (price > MAX_RECOMMENDED_PRICE) return { kind: "impossible" };
  return { kind: "price", price, includesOperatingCosts: input.includesOperatingCosts };
}

/** Recommendation for one product in one channel, using the store's current overhead per unit. */
export function recommendForChannel(
  data: StoreData,
  metrics: Pick<StoreMetrics, "overheadPerUnit">,
  productId: string,
  channelId: string,
): Recommendation | null {
  const product = data.products.find((candidate) => candidate.id === productId);
  const channel = data.channels.find((candidate) => candidate.id === channelId);
  if (!product || !channel) return null;
  const materialCost = materialCostPerUnit(product, data.composition, mapById(data.materials), channel.id);
  // Nothing to price until this channel has a composition.
  if (materialCost === 0) return null;
  const overhead = metrics.overheadPerUnit;
  return recommendPrice({
    cost: overhead === null ? materialCost : materialCost + overhead,
    includesOperatingCosts: overhead !== null,
    fixedFee: channel.fixedFee,
    commissionPct: channel.commissionPct,
    targetMarginPct: product.targetMarginPct ?? data.store.targetMarginPct,
  });
}
