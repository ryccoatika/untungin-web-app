import type { CalcMaterial } from "./types";
import { toBase } from "./units";

/** Cost per base unit (g, ml, pcs) after waste: price / (qty in base units × (1 − waste/100)). */
export function unitCost(
  material: Pick<CalcMaterial, "purchaseQty" | "purchaseUnit" | "purchasePrice" | "wastePct">,
): number {
  const usable = toBase(material.purchaseQty, material.purchaseUnit) * (1 - material.wastePct / 100);
  return material.purchasePrice / usable;
}
