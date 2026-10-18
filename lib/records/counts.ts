import { isUuid } from "@/lib/uuid";
import { MAX_DAY_QTY } from "./dates";
import type { SalesCount } from "./snapshot";

/**
 * Checks the counts a client sent for one day: uuids, whole quantities 0–MAX_DAY_QTY, no pair twice, and
 * every pair one of `known` (the priced active product × channel pairs). Null when anything is off.
 */
export function parseSalesCounts(input: unknown, known: { productId: string; channelId: string }[]): SalesCount[] | null {
  if (!Array.isArray(input) || input.length > known.length) return null;
  const knownKeys = new Set(known.map((pair) => `${pair.productId}|${pair.channelId}`));
  const seen = new Set<string>();
  const out: SalesCount[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) return null;
    const { productId, channelId, qty } = item as Record<string, unknown>;
    if (typeof productId !== "string" || typeof channelId !== "string" || !isUuid(productId) || !isUuid(channelId)) return null;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0 || qty > MAX_DAY_QTY) return null;
    const key = `${productId}|${channelId}`;
    if (!knownKeys.has(key) || seen.has(key)) return null;
    seen.add(key);
    out.push({ productId, channelId, qty });
  }
  return out;
}
