import { describe, expect, it } from "vitest";
import { ALL_MATERIALS, applyOverrides, computeMetrics, priceKey } from "@/lib/calc";
import { fixture } from "./fixture";

const net = (overrides: Parameters<typeof applyOverrides>[1]) => computeMetrics(applyOverrides(fixture(), overrides)).netProfit;

describe("applyOverrides", () => {
  it("changes nothing without overrides", () => {
    expect(applyOverrides(fixture(), {})).toEqual(fixture());
  });

  it("raises every material price", () => {
    // Material costs 2.220.000 × 1,5 = 3.330.000 → 6.900.000 − 3.330.000 − 1.650.000
    expect(net({ materialPricePct: { [ALL_MATERIALS]: 50 } })).toBeCloseTo(1920000, 6);
  });

  it("lets one material's own change replace the 'all' change", () => {
    // kopi +100% (300/g), the rest +0%: offline (60.000 + 20.000) / 10 + 500 = 8.500, online 8.700
    const data = applyOverrides(fixture(), { materialPricePct: { [ALL_MATERIALS]: 0, kopi: 100 } });
    expect(data.materials.find((m) => m.id === "kopi")?.purchasePrice).toBe(300000);
    expect(data.materials.find((m) => m.id === "susu")?.purchasePrice).toBe(20000);
    const lines = computeMetrics(data).lines;
    expect(lines.find((l) => l.channelId === "offline")?.materialCost).toBeCloseTo(8500, 6);
    expect(lines.find((l) => l.channelId === "online")?.materialCost).toBeCloseTo(8700, 6);
  });

  it("never pushes a price below zero", () => {
    const data = applyOverrides(fixture(), { materialPricePct: { [ALL_MATERIALS]: -150 } });
    expect(data.materials.every((m) => m.purchasePrice === 0)).toBe(true);
    // Materials free: 6.900.000 − 0 − 1.650.000
    expect(computeMetrics(data).netProfit).toBeCloseTo(5250000, 6);
  });

  it("multiplies every sales estimate", () => {
    // 4.680.000 × 1,2 − 1.650.000
    expect(net({ salesMultiplier: 1.2 })).toBeCloseTo(3966000, 6);
  });

  it("selling nothing gives nulls, not NaN", () => {
    const metrics = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 0 }));
    expect(metrics.totalUnits).toBe(0);
    expect(metrics.bepUnitsMonthly).toBeNull();
    expect(metrics.paybackMonths).toBeNull();
    expect(Number.isFinite(metrics.netProfit)).toBe(true);
  });

  it("a negative multiplier counts as zero", () => {
    expect(computeMetrics(applyOverrides(fixture(), { salesMultiplier: -1 })).totalUnits).toBe(0);
  });

  it("sets a selling price per product and channel", () => {
    // online 22.000: net 22.000 × 0,8 − 1.000 = 16.600 → 5.400.000 + 1.660.000 − 2.220.000 − 1.650.000
    expect(net({ prices: { [priceKey("eskopi", "online")]: 22000 } })).toBeCloseTo(3190000, 6);
  });

  it("adds a price row (without sales) for a channel that had none", () => {
    const base = fixture();
    base.products.push({ id: "baru", name: "Baru", yieldQty: 1, targetMarginPct: null, isActive: true });
    const data = applyOverrides(base, { prices: { [priceKey("baru", "offline")]: 5000 } });
    expect(data.prices).toContainEqual({ productId: "baru", channelId: "offline", price: 5000, estMonthlySales: 0, competitorPrice: null });
    expect(computeMetrics(data).netProfit).toBeCloseTo(3030000, 6);
  });

  it("ignores keys for unknown products or channels", () => {
    const data = applyOverrides(fixture(), { prices: { [priceKey("nope", "offline")]: 1, [priceKey("eskopi", "nope")]: 1 } });
    expect(data.prices).toEqual(fixture().prices);
  });

  it("does not mutate its input", () => {
    const input = fixture();
    applyOverrides(input, { materialPricePct: { [ALL_MATERIALS]: 50 }, salesMultiplier: 2, prices: { [priceKey("eskopi", "online")]: 1 } });
    expect(input).toEqual(fixture());
  });
});
