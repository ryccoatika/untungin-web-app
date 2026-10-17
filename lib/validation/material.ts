import { z } from "zod";
import { MATERIAL_CATEGORIES } from "@/lib/calc/types";
import { UNITS } from "@/lib/calc/units";
import { blankAs, MAX_AMOUNT, requiredName } from "./common";
import { localeNumber, wholeNumber } from "./number";

export const MATERIAL_UNIT_IN_USE_KEY = "material.unitInUse";
export const MATERIAL_SPOON_WEIGHT_IN_USE_KEY = "material.spoonWeightInUse";

export const MATERIAL_VALIDATION_KEYS = [
  "material.nameRequired",
  "material.nameTooLong",
  "material.categoryInvalid",
  "material.qtyNumber",
  "material.qtyPositive",
  "material.unitInvalid",
  "material.priceNumber",
  "material.priceMin",
  "material.wasteNumber",
  "material.wasteMin",
  "material.wasteMax",
  "material.spoonWeightNumber",
  "material.spoonWeightRange",
  MATERIAL_UNIT_IN_USE_KEY,
  MATERIAL_SPOON_WEIGHT_IN_USE_KEY,
] as const;

export const materialInputSchema = z.object({
  name: requiredName("material", 80),
  category: z.enum(MATERIAL_CATEGORIES, { error: "material.categoryInvalid" }),
  purchaseQty: localeNumber(z.number({ error: "material.qtyNumber" }).positive("material.qtyPositive")),
  purchaseUnit: z.enum(UNITS, { error: "material.unitInvalid" }),
  purchasePrice: wholeNumber(
    z
      .number({ error: "material.priceNumber" })
      .int("material.priceNumber")
      .min(0, "material.priceMin")
      .max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  wastePct: blankAs(
    "0",
    localeNumber(z.number({ error: "material.wasteNumber" }).min(0, "material.wasteMin").lt(100, "material.wasteMax")),
  ),
  /** Grams in one level tablespoon; blank means unknown (null). */
  gramsPerSdm: blankAs(
    null,
    localeNumber(
      z
        .number({ error: "material.spoonWeightNumber" })
        .gt(0, "material.spoonWeightRange")
        .max(1000, "material.spoonWeightRange")
        .nullable(),
    ),
  ),
});

export type MaterialInput = z.infer<typeof materialInputSchema>;

export function toMaterialColumns(input: MaterialInput) {
  return {
    name: input.name,
    category: input.category,
    purchase_qty: input.purchaseQty,
    purchase_unit: input.purchaseUnit,
    purchase_price: input.purchasePrice,
    waste_pct: input.wastePct,
    grams_per_sdm: input.gramsPerSdm,
  };
}
