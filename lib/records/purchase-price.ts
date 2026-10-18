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

export type PurchaseOutcome =
  | { kind: "kept"; price: number; newerDate: string }
  | { kind: "change"; from: number; to: number };

/**
 * What saving a purchase does to the material price: only the newest purchase (by date) sets it. A purchase on the
 * same date as the latest other one counts as newer (it is saved last). `latestOtherDate` leaves out a purchase being edited.
 */
export function purchaseOutcome(
  material: Pick<CalcMaterial, "purchaseQty" | "purchaseUnit" | "purchasePrice">,
  input: { qty: number; unit: Unit; totalPaid: number; date: string },
  latestOtherDate: string | undefined,
): PurchaseOutcome {
  if (latestOtherDate !== undefined && latestOtherDate > input.date) {
    return { kind: "kept", price: material.purchasePrice, newerDate: latestOtherDate };
  }
  return { kind: "change", from: material.purchasePrice, to: newPurchasePrice(material, input.qty, input.unit, input.totalPaid) };
}
