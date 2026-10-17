import { describe, expect, it } from "vitest";
import { BASE_UNIT, dimensionOf, isUnit, sameDimension, toBase, unitsOf } from "@/lib/calc/units";

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
