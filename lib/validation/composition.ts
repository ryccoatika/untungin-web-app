import { z } from "zod";
import { BASES } from "@/lib/calc/types";
import { sameDimension, UNITS, type Unit } from "@/lib/calc/units";
import { isUuid } from "@/lib/uuid";
import { localeNumber } from "./number";

export const COMPOSITION_UNIT_MISMATCH_KEY = "composition.unitDimension";

export const COMPOSITION_VALIDATION_KEYS = [
  "composition.materialRequired",
  "composition.qtyNumber",
  "composition.qtyPositive",
  "composition.unitInvalid",
  "composition.basisInvalid",
  COMPOSITION_UNIT_MISMATCH_KEY,
] as const;

export const compositionInputSchema = z.object({
  materialId: z.string({ error: "composition.materialRequired" }).refine(isUuid, "composition.materialRequired"),
  qty: localeNumber(z.number({ error: "composition.qtyNumber" }).positive("composition.qtyPositive")),
  unit: z.enum(UNITS, { error: "composition.unitInvalid" }),
  basis: z.enum(BASES, { error: "composition.basisInvalid" }),
});

export type CompositionInput = z.infer<typeof compositionInputSchema>;

/** Message key when a row's unit is a different dimension from its material's purchase unit. */
export function compositionUnitError(materialUnit: Unit, unit: Unit): string | null {
  return sameDimension(materialUnit, unit) ? null : COMPOSITION_UNIT_MISMATCH_KEY;
}

export function toCompositionColumns(input: CompositionInput) {
  return { material_id: input.materialId, qty: input.qty, unit: input.unit, basis: input.basis };
}
