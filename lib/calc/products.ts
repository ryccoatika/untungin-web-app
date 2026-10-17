import { unitCost } from "./materials";
import type { CalcCompositionRow, CalcMaterial, CalcProduct } from "./types";
import { CalcError } from "./errors";
import { recipeQtyInBase } from "./units";

export { CalcError, type CalcErrorCode } from "./errors";

/** recipeQtyInBase for one composition row; the error carries the product and material ids. */
function rowQtyInBase(row: CalcCompositionRow, material: CalcMaterial, productId: string): number {
  try {
    return recipeQtyInBase(row.qty, row.unit, material);
  } catch (error) {
    if (error instanceof CalcError) throw new CalcError(error.code, productId, row.materialId);
    throw error;
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
    const cost = rowQtyInBase(row, material, product.id) * unitCost(material);
    if (row.basis === "batch") batch += cost;
    else perUnit += cost;
  }
  return batch / product.yieldQty + perUnit;
}
