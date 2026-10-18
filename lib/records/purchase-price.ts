import { sameDimension, toBase, type CalcMaterial, type Unit } from "@/lib/calc";

/** Price of one purchase pack implied by what was actually paid for `qty` `unit`. */
export function newPurchasePrice(
  material: Pick<CalcMaterial, "purchaseQty" | "purchaseUnit">,
  qty: number,
  unit: Unit,
  totalPaid: number,
): number {
  if (!sameDimension(unit, material.purchaseUnit)) throw new Error(`Unit ${unit} does not match ${material.purchaseUnit}`);
  return Math.round((totalPaid / toBase(qty, unit)) * toBase(material.purchaseQty, material.purchaseUnit));
}
