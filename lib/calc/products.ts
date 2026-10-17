import { unitCost } from "./materials";
import type { CalcCompositionRow, CalcMaterial, CalcProduct } from "./types";
import { sameDimension, toBase } from "./units";

export type CalcErrorCode = "UNIT_DIMENSION_MISMATCH" | "UNKNOWN_MATERIAL";

/** Data the app should never have saved; thrown instead of calculating silently (spec §4.2 item 2). */
export class CalcError extends Error {
  constructor(
    readonly code: CalcErrorCode,
    readonly productId: string,
    readonly materialId: string,
  ) {
    super(`${code}: product ${productId}, material ${materialId}`);
    this.name = "CalcError";
  }
}

export function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Composition rows of a product that apply to a channel: shared rows plus that channel's own rows. */
export function rowsFor(composition: CalcCompositionRow[], productId: string, channelId: string): CalcCompositionRow[] {
  return composition.filter(
    (row) => row.productId === productId && (row.channelId === null || row.channelId === channelId),
  );
}

/** hppBahan: material and packaging cost of one product unit sold through `channelId`. */
export function materialCostPerUnit(
  product: CalcProduct,
  composition: CalcCompositionRow[],
  materials: Map<string, CalcMaterial>,
  channelId: string,
): number {
  let batch = 0;
  let perUnit = 0;
  for (const row of rowsFor(composition, product.id, channelId)) {
    const material = materials.get(row.materialId);
    if (!material) throw new CalcError("UNKNOWN_MATERIAL", product.id, row.materialId);
    if (!sameDimension(row.unit, material.purchaseUnit)) {
      throw new CalcError("UNIT_DIMENSION_MISMATCH", product.id, row.materialId);
    }
    const cost = toBase(row.qty, row.unit) * unitCost(material);
    if (row.basis === "batch") batch += cost;
    else perUnit += cost;
  }
  return batch / product.yieldQty + perUnit;
}
