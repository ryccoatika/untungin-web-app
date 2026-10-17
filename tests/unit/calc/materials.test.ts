import { describe, expect, it } from "vitest";
import { unitCost } from "@/lib/calc/materials";

describe("unitCost", () => {
  it.each([
    ["1 kg sugar Rp15.000", { purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 }, 15],
    ["2 ons Rp10.000", { purchaseQty: 2, purchaseUnit: "ons", purchasePrice: 10000, wastePct: 0 }, 50],
    ["1 l milk Rp20.000, 10% waste", { purchaseQty: 1, purchaseUnit: "l", purchasePrice: 20000, wastePct: 10 }, 20000 / 900],
    ["1 lusin cups Rp6.000", { purchaseQty: 1, purchaseUnit: "lusin", purchasePrice: 6000, wastePct: 0 }, 500],
    ["free sample", { purchaseQty: 5, purchaseUnit: "pcs", purchasePrice: 0, wastePct: 0 }, 0],
  ] as const)("%s", (_label, material, expected) => {
    expect(unitCost(material)).toBeCloseTo(expected, 6);
  });
});
