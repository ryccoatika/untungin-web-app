import type { StoreData } from "./types";

/** What-if changes applied on top of a store's data (spec §4.4). Never saved. */
export type Overrides = {
  /** Percent change of purchase prices: +50 = 50% more expensive. Key ALL_MATERIALS or a material id; an id's own value replaces ALL_MATERIALS for that material. */
  materialPricePct?: Record<string, number>;
  /** Multiplies every monthly sales estimate: 1.2 = 20% more sold. */
  salesMultiplier?: number;
  /** New selling price per priceKey(productId, channelId). */
  prices?: Record<string, number>;
};

export const ALL_MATERIALS = "all";

export function priceKey(productId: string, channelId: string): string {
  return `${productId}:${channelId}`;
}

export function applyOverrides(data: StoreData, overrides: Overrides): StoreData {
  const pct = overrides.materialPricePct ?? {};
  const materials = data.materials.map((material) => {
    const change = pct[material.id] ?? pct[ALL_MATERIALS];
    if (change === undefined) return material;
    return { ...material, purchasePrice: Math.max(0, material.purchasePrice * (1 + change / 100)) };
  });

  const multiplier = Math.max(0, overrides.salesMultiplier ?? 1);
  const newPrices = overrides.prices ?? {};
  const prices = data.prices.map((row) => ({
    ...row,
    price: newPrices[priceKey(row.productId, row.channelId)] ?? row.price,
    estMonthlySales: row.estMonthlySales * multiplier,
  }));

  const existing = new Set(data.prices.map((row) => priceKey(row.productId, row.channelId)));
  for (const [key, price] of Object.entries(newPrices)) {
    if (existing.has(key)) continue;
    const [productId, channelId] = key.split(":");
    const known = data.products.some((p) => p.id === productId) && data.channels.some((c) => c.id === channelId);
    if (known) prices.push({ productId, channelId, price, estMonthlySales: 0, competitorPrice: null });
  }

  return { ...data, materials, prices };
}
