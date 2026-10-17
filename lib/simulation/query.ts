import { ALL_MATERIALS, priceKey, type Overrides } from "@/lib/calc";
import { isUuid } from "@/lib/uuid";

/**
 * Simulation scenarios live in the URL (spec §4.4; Phase 5 AI links use the same format):
 *   m=<pct>                         all materials, +50 = 50% more expensive
 *   m.<materialId>=<pct>            one material (replaces m for that material)
 *   s=<pct>                         sales change, s=20 → 20% more sold
 *   p.<productId>.<channelId>=<Rp>  selling price
 * Each invalid entry is dropped on its own.
 */
export const SIMULATION_LIMITS = { minPct: -100, maxPct: 300, maxPrice: 2_000_000_000 } as const;

export type SearchParams = Record<string, string | string[] | undefined>;

function numberFrom(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const validPct = (value: number) => value >= SIMULATION_LIMITS.minPct && value <= SIMULATION_LIMITS.maxPct;
const validPrice = (value: number) => Number.isInteger(value) && value >= 0 && value <= SIMULATION_LIMITS.maxPrice;

export function parseOverrides(query: SearchParams): Overrides {
  const overrides: Overrides = {};
  for (const [key, raw] of Object.entries(query)) {
    const value = numberFrom(raw);
    if (value === null) continue;
    if ((key === "m" || key.startsWith("m.")) && validPct(value)) {
      const id = key === "m" ? ALL_MATERIALS : key.slice(2);
      if (id === ALL_MATERIALS || isUuid(id)) overrides.materialPricePct = { ...overrides.materialPricePct, [id]: value };
    } else if (key === "s" && validPct(value)) {
      overrides.salesMultiplier = 1 + value / 100;
    } else if (key.startsWith("p.") && validPrice(value)) {
      const ids = key.slice(2).split(".");
      if (ids.length === 2 && ids.every(isUuid)) overrides.prices = { ...overrides.prices, [priceKey(ids[0], ids[1])]: value };
    }
  }
  return overrides;
}

export function overridesToSearchParams(overrides: Overrides): URLSearchParams {
  const params = new URLSearchParams();
  for (const [id, pct] of Object.entries(overrides.materialPricePct ?? {})) {
    params.set(id === ALL_MATERIALS ? "m" : `m.${id}`, String(pct));
  }
  if (overrides.salesMultiplier !== undefined && overrides.salesMultiplier !== 1) {
    params.set("s", String(Math.round((overrides.salesMultiplier - 1) * 100 * 1e4) / 1e4));
  }
  for (const [key, price] of Object.entries(overrides.prices ?? {})) {
    const [productId, channelId] = key.split(":");
    params.set(`p.${productId}.${channelId}`, String(price));
  }
  return params;
}
