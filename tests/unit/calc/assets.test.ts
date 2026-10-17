import { describe, expect, it } from "vitest";
import { assetMonthlyDepreciation, assetValue, monthlyDepreciation, totalCapital } from "@/lib/calc/assets";
import type { CalcAsset } from "@/lib/calc/types";

const assets: CalcAsset[] = [
  { id: "a", name: "Meja", category: "furnitur", qty: 2, unitPrice: 1200000, usefulLifeMonths: 24 },
  { id: "b", name: "Freezer", category: "elektronik", qty: 1, unitPrice: 6000000, usefulLifeMonths: 60 },
];

describe("assets", () => {
  it("values an asset as qty × unit price", () => {
    expect(assetValue(assets[0])).toBe(2400000);
  });

  it("depreciates each asset evenly over its life", () => {
    expect(assetMonthlyDepreciation(assets[0])).toBe(100000);
    expect(monthlyDepreciation(assets)).toBe(200000);
  });

  it("totals the capital", () => {
    expect(totalCapital(assets)).toBe(8400000);
  });

  it("is 0 without assets", () => {
    expect(monthlyDepreciation([])).toBe(0);
    expect(totalCapital([])).toBe(0);
  });
});
