import { CalcError } from "./errors";

export const UNITS = ["g", "ons", "kg", "ml", "l", "pcs", "lusin"] as const;
export type Unit = (typeof UNITS)[number];
export const HOUSEHOLD_UNITS = ["sdm", "sdt", "gelas"] as const;
export type HouseholdUnit = (typeof HOUSEHOLD_UNITS)[number];
export const RECIPE_UNITS = [...UNITS, ...HOUSEHOLD_UNITS] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

/** Volume of one household unit in ml: a level tablespoon, teaspoon and a glass. */
export const ML_PER_HOUSEHOLD: Record<HouseholdUnit, number> = { sdm: 15, sdt: 5, gelas: 250 };

export type Dimension = "mass" | "volume" | "count";

const UNIT_INFO: Record<Unit, { dimension: Dimension; toBase: number }> = {
  g: { dimension: "mass", toBase: 1 },
  ons: { dimension: "mass", toBase: 100 },
  kg: { dimension: "mass", toBase: 1000 },
  ml: { dimension: "volume", toBase: 1 },
  l: { dimension: "volume", toBase: 1000 },
  pcs: { dimension: "count", toBase: 1 },
  lusin: { dimension: "count", toBase: 12 },
};

/** The unit every quantity of a dimension is converted to: g, ml, pcs. */
export const BASE_UNIT: Record<Dimension, Unit> = { mass: "g", volume: "ml", count: "pcs" };

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export function dimensionOf(unit: Unit): Dimension {
  return UNIT_INFO[unit].dimension;
}

export function toBase(qty: number, unit: Unit): number {
  return qty * UNIT_INFO[unit].toBase;
}

export function sameDimension(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b);
}

export function unitsOf(dimension: Dimension): Unit[] {
  return UNITS.filter((unit) => dimensionOf(unit) === dimension);
}

export function isHouseholdUnit(unit: string): unit is HouseholdUnit {
  return (HOUSEHOLD_UNITS as readonly string[]).includes(unit);
}

export function isRecipeUnit(value: string): value is RecipeUnit {
  return (RECIPE_UNITS as readonly string[]).includes(value);
}

/** Units a recipe row may use for a material: its dimension's units, plus household units for mass and volume. */
export function recipeUnitsFor(material: { purchaseUnit: Unit }): RecipeUnit[] {
  const dimension = dimensionOf(material.purchaseUnit);
  const own: RecipeUnit[] = unitsOf(dimension);
  return dimension === "count" ? own : [...own, ...HOUSEHOLD_UNITS];
}

/**
 * A recipe quantity in the base unit of the material's dimension (g, ml or pcs). Throws a CalcError
 * (with empty product and material ids, which callers fill in) when the unit does not fit the material,
 * or a weight material has no spoon weight. The result is always finite.
 */
export function recipeQtyInBase(
  qty: number,
  unit: RecipeUnit,
  material: { purchaseUnit: Unit; gramsPerSdm?: number | null },
): number {
  const fail = (code: "UNIT_DIMENSION_MISMATCH" | "SPOON_WEIGHT_MISSING") => new CalcError(code, "", "");
  if (!Number.isFinite(qty)) throw fail("UNIT_DIMENSION_MISMATCH");
  const dimension = dimensionOf(material.purchaseUnit);
  let result: number;
  if (isHouseholdUnit(unit)) {
    const ml = qty * ML_PER_HOUSEHOLD[unit];
    if (dimension === "volume") result = ml;
    else if (dimension === "mass") {
      const spoon = material.gramsPerSdm;
      if (spoon == null || !Number.isFinite(spoon) || spoon <= 0) throw fail("SPOON_WEIGHT_MISSING");
      // Grams per ml follow from the spoon: 1 sdm = 15 ml weighs gramsPerSdm.
      result = (ml / ML_PER_HOUSEHOLD.sdm) * spoon;
    } else throw fail("UNIT_DIMENSION_MISMATCH");
  } else {
    if (dimensionOf(unit) !== dimension) throw fail("UNIT_DIMENSION_MISMATCH");
    result = toBase(qty, unit);
  }
  if (!Number.isFinite(result)) throw fail("UNIT_DIMENSION_MISMATCH");
  return result;
}
