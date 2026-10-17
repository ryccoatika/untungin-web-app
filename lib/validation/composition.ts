import { z } from "zod";
import { BASES } from "@/lib/calc/types";
import { dimensionOf, isHouseholdUnit, RECIPE_UNITS, sameDimension, type RecipeUnit, type Unit } from "@/lib/calc/units";
import { isUuid } from "@/lib/uuid";
import { localeNumber } from "./number";

export const COMPOSITION_UNIT_MISMATCH_KEY = "composition.unitDimension";
export const COMPOSITION_SPOON_WEIGHT_KEY = "composition.spoonWeightMissing";

export const COMPOSITION_VALIDATION_KEYS = [
  "composition.materialRequired",
  "composition.qtyNumber",
  "composition.qtyPositive",
  "composition.unitInvalid",
  "composition.basisInvalid",
  "composition.channelInvalid",
  COMPOSITION_UNIT_MISMATCH_KEY,
  COMPOSITION_SPOON_WEIGHT_KEY,
] as const;

export const compositionInputSchema = z.object({
  materialId: z.string({ error: "composition.materialRequired" }).refine(isUuid, "composition.materialRequired"),
  qty: localeNumber(z.number({ error: "composition.qtyNumber" }).positive("composition.qtyPositive")),
  unit: z.enum(RECIPE_UNITS, { error: "composition.unitInvalid" }),
  basis: z.enum(BASES, { error: "composition.basisInvalid" }),
  channelId: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.string().refine(isUuid, "composition.channelInvalid").nullable(),
  ),
});

export type CompositionInput = z.infer<typeof compositionInputSchema>;

/** Message key when a row's unit does not fit its material: another dimension, or a spoon unit on a weight material without spoon weight. */
export function compositionUnitError(
  material: { purchaseUnit: Unit; gramsPerSdm: number | null },
  unit: RecipeUnit,
): string | null {
  if (isHouseholdUnit(unit)) {
    const dimension = dimensionOf(material.purchaseUnit);
    if (dimension === "count") return COMPOSITION_UNIT_MISMATCH_KEY;
    if (dimension === "mass" && !(material.gramsPerSdm != null && material.gramsPerSdm > 0)) return COMPOSITION_SPOON_WEIGHT_KEY;
    return null;
  }
  return sameDimension(material.purchaseUnit, unit) ? null : COMPOSITION_UNIT_MISMATCH_KEY;
}

export function toCompositionColumns(input: CompositionInput) {
  return { material_id: input.materialId, qty: input.qty, unit: input.unit, basis: input.basis, channel_id: input.channelId };
}
