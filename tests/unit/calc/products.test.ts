import { describe, expect, it } from "vitest";
import { CalcError, mapById, materialCostPerUnit, rowsFor } from "@/lib/calc/products";
import { fixture } from "./fixture";

function costFor(channelId: string, data = fixture()) {
  return materialCostPerUnit(data.products[0], data.composition, mapById(data.materials), channelId);
}

describe("materialCostPerUnit", () => {
  it("splits batch rows by yield and adds per-unit rows", () => {
    // (200 g × 150 + 1000 ml × 20) / 10 + 1 × 500
    expect(costFor("offline")).toBeCloseTo(5500, 6);
  });

  it("adds channel-specific rows only for that channel", () => {
    expect(costFor("online")).toBeCloseTo(5700, 6);
  });

  it("converts the row unit to the material's base unit", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], qty: 0.2, unit: "kg" };
    expect(costFor("offline", data)).toBeCloseTo(5500, 6);
  });

  it("costs 2 sdm of a weight material like its gram equivalent", () => {
    const data = fixture();
    data.materials[0] = { ...data.materials[0], gramsPerSdm: 12 };
    data.composition[0] = { ...data.composition[0], qty: 2, unit: "sdm" };
    const spoons = costFor("offline", data);
    data.composition[0] = { ...data.composition[0], qty: 24, unit: "g" };
    expect(spoons).toBeCloseTo(costFor("offline", data), 9);
  });

  it("throws SPOON_WEIGHT_MISSING with the product and material ids", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], qty: 2, unit: "sdm" };
    expect(() => costFor("offline", data)).toThrow(expect.objectContaining({ code: "SPOON_WEIGHT_MISSING", productId: "eskopi", materialId: "kopi" }));
  });

  it("is 0 for a product without composition", () => {
    const data = fixture();
    data.composition = [];
    expect(costFor("offline", data)).toBe(0);
  });

  it("throws a structured error for a unit in another dimension", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    try {
      costFor("offline", data);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CalcError);
      expect(error).toMatchObject({ code: "UNIT_DIMENSION_MISMATCH", productId: "eskopi", materialId: "kopi" });
    }
  });

  it("throws a structured error for a missing material", () => {
    const data = fixture();
    data.materials = data.materials.filter((m) => m.id !== "susu");
    expect(() => costFor("offline", data)).toThrow(expect.objectContaining({ code: "UNKNOWN_MATERIAL", materialId: "susu" }));
  });
});

describe("rowsFor", () => {
  it("keeps shared rows plus the channel's own rows", () => {
    const { composition } = fixture();
    expect(rowsFor(composition, "eskopi", "offline").map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(rowsFor(composition, "eskopi", "online").map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4"]);
    expect(rowsFor(composition, "other", "offline")).toEqual([]);
  });
});
