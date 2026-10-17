import { describe, expect, it } from "vitest";
import { ALL_MATERIALS, applyOverrides, computeMetrics, priceKey } from "@/lib/calc";
import { compareMetrics } from "@/lib/simulation/compare";
import { overridesToSearchParams, parseOverrides } from "@/lib/simulation/query";
import { fixture } from "./calc/fixture";

const P = "6f1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f60";
const C = "7a1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f61";
const M = "8b1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f62";

describe("parseOverrides", () => {
  it("reads every kind of override", () => {
    expect(parseOverrides({ m: "50", [`m.${M}`]: "-10", s: "20", [`p.${P}.${C}`]: "18000" })).toEqual({
      materialPricePct: { [ALL_MATERIALS]: 50, [M]: -10 },
      salesMultiplier: 1.2,
      prices: { [priceKey(P, C)]: 18000 },
    });
  });

  it("returns nothing for an empty query", () => {
    expect(parseOverrides({})).toEqual({});
  });

  it("takes the first value of a repeated key", () => {
    expect(parseOverrides({ m: ["10", "90"] })).toEqual({ materialPricePct: { [ALL_MATERIALS]: 10 } });
  });

  it.each([
    [{ m: "abc" }],
    [{ m: "" }],
    [{ m: "301" }],
    [{ m: "-101" }],
    [{ s: "99999" }],
    [{ s: "Infinity" }],
    [{ "m.not-a-uuid": "10" }],
    [{ "p.x.y": "5000" }],
    [{ [`p.${P}.${C}`]: "-5" }],
    [{ [`p.${P}.${C}`]: "18000.5" }],
    [{ [`p.${P}.${C}`]: "3000000000" }],
    [{ [`p.${P}`]: "18000" }],
    [{ other: "1" }],
    [{ m: "1e3" }],
    [{ [`p.${P}.${C}`]: "0x10" }],
    [{ "m.all": "10" }],
  ])("drops the invalid entry %j", (query) => {
    expect(parseOverrides(query)).toEqual({});
  });

  it("keeps valid entries next to invalid ones", () => {
    expect(parseOverrides({ m: "abc", s: "50" })).toEqual({ salesMultiplier: 1.5 });
  });

  it("normalises -0 to 0", () => {
    const overrides = parseOverrides({ [`p.${P}.${C}`]: "-0" });
    expect(overrides.prices?.[priceKey(P, C)]).toBe(0);
    expect(Object.is(overrides.prices?.[priceKey(P, C)], 0)).toBe(true);
  });

  it("trims whitespace from number values", () => {
    expect(parseOverrides({ m: " 5 " })).toEqual({ materialPricePct: { [ALL_MATERIALS]: 5 } });
  });
});

describe("overridesToSearchParams", () => {
  it("round-trips through parseOverrides", () => {
    const overrides = {
      materialPricePct: { [ALL_MATERIALS]: 25, [M]: -5 },
      salesMultiplier: 0.75,
      prices: { [priceKey(P, C)]: 12500 },
    };
    const params = overridesToSearchParams(overrides);
    expect(params.toString()).toBe(`m=25&m.${M}=-5&s=-25&p.${P}.${C}=12500`);
    expect(parseOverrides(Object.fromEntries(params))).toEqual(overrides);
  });

  it("leaves out a sales multiplier of 1", () => {
    expect(overridesToSearchParams({ salesMultiplier: 1 }).toString()).toBe("");
  });
});

describe("compareMetrics", () => {
  const now = computeMetrics(fixture());

  it("compares the fixture with all materials 50% more expensive", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { materialPricePct: { [ALL_MATERIALS]: 50 } }));
    const byKey = Object.fromEntries(compareMetrics(now, sim).map((c) => [c.key, c]));
    expect(byKey.netProfit).toMatchObject({ tone: "worse" });
    expect(byKey.netProfit.diff).toBeCloseTo(-1110000, 6);
    expect(byKey.grossRevenue).toMatchObject({ diff: 0, tone: "same" });
    // Break-even rises from 6 to 8 sales per day: worse.
    expect(byKey.bepUnitsDaily).toMatchObject({ now: 6, sim: 8, diff: 2, tone: "worse" });
    expect(byKey.paybackMonths.tone).toBe("worse");
    expect(byKey.netMarginPct.tone).toBe("worse");
  });

  it("calls more sales better and keeps the metric order", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 1.2 }));
    const comparisons = compareMetrics(now, sim);
    expect(comparisons.map((c) => c.key)).toEqual(["netProfit", "grossRevenue", "netMarginPct", "bepUnitsDaily", "paybackMonths"]);
    expect(comparisons[0].tone).toBe("better");
  });

  it("has no profit, revenue or difference when nothing sells", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 0 }));
    const byKey = Object.fromEntries(compareMetrics(now, sim).map((c) => [c.key, c]));
    expect(byKey.netProfit).toMatchObject({ sim: null, diff: null, tone: "same" });
    expect(byKey.grossRevenue).toMatchObject({ sim: null, diff: null });
    expect(byKey.bepUnitsDaily).toMatchObject({ sim: null, diff: null, tone: "worse" });
    expect(byKey.paybackMonths).toMatchObject({ sim: null, diff: null, tone: "worse" });
  });

  it("shows break-even and payback better when metrics appear in simulation", () => {
    const now = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 0 }));
    const sim = computeMetrics(fixture());
    const byKey = Object.fromEntries(compareMetrics(now, sim).map((c) => [c.key, c]));
    expect(byKey.bepUnitsDaily).toMatchObject({ now: null, sim: 6, diff: null, tone: "better" });
    expect(byKey.paybackMonths).toMatchObject({ now: null, diff: null, tone: "better" });
    expect(byKey.paybackMonths.sim).toBeLessThan(2); // Should be ~1.98, not null
    expect(byKey.netProfit).toMatchObject({ now: null, diff: null, tone: "same" });
  });

  it("has no payback when there are no assets", () => {
    const noAssets = { ...fixture(), assets: [] };
    const byKey = Object.fromEntries(compareMetrics(computeMetrics(noAssets), computeMetrics(applyOverrides(noAssets, { salesMultiplier: 1.2 }))).map((c) => [c.key, c]));
    expect(byKey.paybackMonths).toMatchObject({ now: null, sim: null, diff: null, tone: "same" });
  });

  it("shows the loss when the seller has estimates but the simulation sells nothing", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 0 }));
    const byKey = Object.fromEntries(compareMetrics(now, sim, { simHasEstimates: true }).map((c) => [c.key, c]));
    expect(byKey.netProfit.sim).toBeLessThan(0);
    expect(byKey.netProfit).toMatchObject({ tone: "worse" });
    expect(byKey.grossRevenue).toMatchObject({ sim: 0, tone: "worse" });
  });

  it("judges the tone by the difference as displayed", () => {
    const base = computeMetrics(fixture());
    const nudged = { ...base, netMarginPct: (base.netMarginPct ?? 0) + 0.04 };
    const byKey = Object.fromEntries(compareMetrics(base, nudged).map((c) => [c.key, c]));
    expect(byKey.netMarginPct.tone).toBe("same");
    const half = { ...base, netProfit: base.netProfit + 0.4 };
    expect(compareMetrics(base, half)[0].tone).toBe("same");
  });
});
