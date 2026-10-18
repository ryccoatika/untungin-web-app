import { describe, expect, it } from "vitest";
import { analyzeStore, analyzeStoreSkipping, CalcError, tryAnalyzeStore, worstStatus } from "@/lib/calc";
import { fixture } from "./fixture";

describe("tryAnalyzeStore", () => {
  it("returns the analysis", () => {
    const result = tryAnalyzeStore(fixture());
    expect(result.error).toBeNull();
    expect(result.analysis?.netProfit).toBeCloseTo(3030000, 6);
  });

  it("returns a CalcError instead of throwing", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    const result = tryAnalyzeStore(data);
    expect(result.analysis).toBeNull();
    expect(result.error).toBeInstanceOf(CalcError);
    expect(result.error).toMatchObject({ code: "UNIT_DIMENSION_MISMATCH", productId: "eskopi" });
  });
});

describe("analyzeStoreSkipping", () => {
  /** The fixture plus a second, healthy product sold offline. */
  function twoProducts() {
    const data = fixture();
    data.products.push({ id: "esteh", name: "Es Teh", yieldQty: 1, targetMarginPct: null, isActive: true });
    data.composition.push({ id: "t1", productId: "esteh", materialId: "cup", qty: 1, unit: "pcs", basis: "unit", channelId: null });
    data.prices.push({ productId: "esteh", channelId: "offline", price: 8000, estMonthlySales: 300, competitorPrice: null });
    return data;
  }

  it("skips nothing on healthy data", () => {
    const data = fixture();
    const { analysis, skipped } = analyzeStoreSkipping(data);
    expect(skipped).toEqual([]);
    expect(analysis).toEqual(analyzeStore(data));
  });

  it("sets aside the broken product and costs the rest", () => {
    const data = twoProducts();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    const { analysis, skipped } = analyzeStoreSkipping(data);
    expect(skipped.map((e) => [e.code, e.productId])).toEqual([["UNIT_DIMENSION_MISMATCH", "eskopi"]]);
    expect(analysis.lines.map((l) => l.productId)).toEqual(["esteh"]);
    // Fixed costs do not depend on recipes.
    expect(analysis.fixedCosts).toEqual(analyzeStore(twoProducts()).fixedCosts);
  });

  it("sets aside every broken product", () => {
    const data = twoProducts();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    data.composition[4] = { ...data.composition[4], materialId: "gone" };
    const { analysis, skipped } = analyzeStoreSkipping(data);
    expect(skipped.map((e) => e.productId).sort()).toEqual(["eskopi", "esteh"]);
    expect(analysis.lines).toEqual([]);
  });

  it("does not mutate the input", () => {
    const data = twoProducts();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    analyzeStoreSkipping(data);
    expect(data.products.every((p) => p.isActive)).toBe(true);
  });
});

describe("worstStatus", () => {
  it.each([
    [[], null],
    [["green"], "green"],
    [["green", "yellow"], "yellow"],
    [["green", "red", "yellow"], "red"],
  ] as const)("%j → %s", (statuses, expected) => {
    expect(worstStatus(statuses.map((status) => ({ status })))).toBe(expected);
  });
});
