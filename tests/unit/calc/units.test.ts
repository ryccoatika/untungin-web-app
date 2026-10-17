import { describe, expect, it } from "vitest";
import { CalcError } from "@/lib/calc/products";
import {
  BASE_UNIT,
  dimensionOf,
  isHouseholdUnit,
  isRecipeUnit,
  isUnit,
  recipeQtyInBase,
  recipeUnitsFor,
  sameDimension,
  toBase,
  unitsOf,
} from "@/lib/calc/units";

describe("units", () => {
  it.each([
    [2, "g", 2],
    [3, "ons", 300],
    [1.5, "kg", 1500],
    [250, "ml", 250],
    [2, "l", 2000],
    [4, "pcs", 4],
    [2, "lusin", 24],
  ] as const)("toBase(%d, %s) = %d", (qty, unit, expected) => {
    expect(toBase(qty, unit)).toBe(expected);
  });

  it("knows dimensions", () => {
    expect(dimensionOf("ons")).toBe("mass");
    expect(dimensionOf("l")).toBe("volume");
    expect(dimensionOf("lusin")).toBe("count");
    expect(sameDimension("kg", "g")).toBe(true);
    expect(sameDimension("kg", "ml")).toBe(false);
    expect(sameDimension("pcs", "lusin")).toBe(true);
  });

  it("lists units of a dimension and base units", () => {
    expect(unitsOf("mass")).toEqual(["g", "ons", "kg"]);
    expect(unitsOf("volume")).toEqual(["ml", "l"]);
    expect(unitsOf("count")).toEqual(["pcs", "lusin"]);
    expect(BASE_UNIT).toEqual({ mass: "g", volume: "ml", count: "pcs" });
  });

  it("validates unit strings", () => {
    expect(isUnit("kg")).toBe(true);
    expect(isUnit("sdm")).toBe(false);
  });
});

describe("recipeQtyInBase", () => {
  it.each([
    [2, "sdm", { purchaseUnit: "l" }, 30],
    [1, "gelas", { purchaseUnit: "ml" }, 250],
    [1.5, "sdt", { purchaseUnit: "l" }, 7.5],
    [2, "sdm", { purchaseUnit: "kg", gramsPerSdm: 12 }, 24],
    [3, "sdt", { purchaseUnit: "g", gramsPerSdm: 12 }, 12],
    [1, "gelas", { purchaseUnit: "kg", gramsPerSdm: 12 }, 200],
    [200, "g", { purchaseUnit: "kg" }, 200],
    [2, "lusin", { purchaseUnit: "pcs" }, 24],
  ] as const)("(%d, %s, %j) = %d", (qty, unit, material, expected) => {
    expect(recipeQtyInBase(qty, unit, material)).toBeCloseTo(expected, 9);
  });

  it("throws SPOON_WEIGHT_MISSING for a weight material without spoon weight", () => {
    for (const gramsPerSdm of [undefined, null, 0]) {
      expect(() => recipeQtyInBase(1, "sdm", { purchaseUnit: "kg", gramsPerSdm })).toThrow(CalcError);
      expect(() => recipeQtyInBase(1, "sdm", { purchaseUnit: "kg", gramsPerSdm })).toThrow(/SPOON_WEIGHT_MISSING/);
    }
  });

  it("throws UNIT_DIMENSION_MISMATCH across dimensions", () => {
    expect(() => recipeQtyInBase(1, "sdm", { purchaseUnit: "pcs" })).toThrow(/UNIT_DIMENSION_MISMATCH/);
    expect(() => recipeQtyInBase(1, "kg", { purchaseUnit: "l" })).toThrow(/UNIT_DIMENSION_MISMATCH/);
  });

  it("never returns NaN or Infinity", () => {
    expect(() => recipeQtyInBase(Number.NaN, "g", { purchaseUnit: "kg" })).toThrow(CalcError);
    expect(() => recipeQtyInBase(1, "sdm", { purchaseUnit: "kg", gramsPerSdm: Number.NaN })).toThrow(CalcError);
    expect(() => recipeQtyInBase(1, "sdm", { purchaseUnit: "kg", gramsPerSdm: Infinity })).toThrow(CalcError);
  });
});

describe("recipeUnitsFor", () => {
  it("adds household units for mass and volume only", () => {
    expect(recipeUnitsFor({ purchaseUnit: "kg" })).toEqual(["g", "ons", "kg", "sdm", "sdt", "gelas"]);
    expect(recipeUnitsFor({ purchaseUnit: "l" })).toEqual(["ml", "l", "sdm", "sdt", "gelas"]);
    expect(recipeUnitsFor({ purchaseUnit: "pcs" })).toEqual(["pcs", "lusin"]);
  });

  it("guards unit strings", () => {
    expect(isHouseholdUnit("sdm")).toBe(true);
    expect(isHouseholdUnit("kg")).toBe(false);
    expect(isRecipeUnit("gelas")).toBe(true);
    expect(isRecipeUnit("kg")).toBe(true);
    expect(isRecipeUnit("sendok")).toBe(false);
  });
});
