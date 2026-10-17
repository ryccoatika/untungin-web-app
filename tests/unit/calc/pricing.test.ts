import { describe, expect, it } from "vitest";
import { ceilTo500, computeMetrics, recommendForChannel, recommendPrice } from "@/lib/calc";
import { fixture } from "./fixture";

describe("ceilTo500", () => {
  it.each([
    [0, 0],
    [1, 500],
    [500, 500],
    [16041.67, 16500],
    [1000.0000000001, 1000],
    [27062.5, 27500],
  ])("%d → %d", (value, expected) => {
    expect(ceilTo500(value)).toBe(expected);
  });
});

describe("recommendPrice", () => {
  it("covers cost, fee, commission and margin, rounded up to Rp500", () => {
    // (9.825 + 1.000) / (1 − 0,2 − 0,4) = 27.062,5 → 27.500
    expect(recommendPrice({ cost: 9825, includesOperatingCosts: true, fixedFee: 1000, commissionPct: 20, targetMarginPct: 40 })).toEqual({
      kind: "price",
      price: 27500,
      includesOperatingCosts: true,
    });
  });

  it("is impossible when commission + margin reach 100%", () => {
    expect(recommendPrice({ cost: 1000, includesOperatingCosts: true, fixedFee: 0, commissionPct: 60, targetMarginPct: 40 })).toEqual({ kind: "impossible" });
    expect(recommendPrice({ cost: 1000, includesOperatingCosts: true, fixedFee: 0, commissionPct: 70, targetMarginPct: 40 })).toEqual({ kind: "impossible" });
  });
});

describe("recommendForChannel — the coffee-shop fixture", () => {
  const data = fixture();
  const metrics = computeMetrics(data);

  it("uses full cost (with overhead) per channel", () => {
    // offline: 9.625 / 0,6 = 16.041,67 → 16.500
    expect(recommendForChannel(data, metrics, "eskopi", "offline")).toEqual({ kind: "price", price: 16500, includesOperatingCosts: true });
    // online: (9.825 + 1.000) / 0,4 → 27.500
    expect(recommendForChannel(data, metrics, "eskopi", "online")).toEqual({ kind: "price", price: 27500, includesOperatingCosts: true });
  });

  it("uses the product's own target margin", () => {
    const own = fixture();
    own.products[0] = { ...own.products[0], targetMarginPct: 20 };
    // (9.825 + 1.000) / (1 − 0,2 − 0,2) = 18.041,67 → 18.500
    expect(recommendForChannel(own, computeMetrics(own), "eskopi", "online")).toMatchObject({ price: 18500 });
  });

  it("falls back to material cost without sales estimates, and says so", () => {
    const noSales = fixture();
    noSales.prices = noSales.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    // (5.700 + 1.000) / 0,4 = 16.750 → 17.000
    expect(recommendForChannel(noSales, computeMetrics(noSales), "eskopi", "online")).toEqual({
      kind: "price",
      price: 17000,
      includesOperatingCosts: false,
    });
  });

  it("works for a channel without a price yet", () => {
    const extra = fixture();
    extra.channels.push({ id: "qris", name: "Offline – QRIS", commissionPct: 0, fixedFee: 0 });
    expect(recommendForChannel(extra, computeMetrics(extra), "eskopi", "qris")).toMatchObject({ kind: "price", price: 16500 });
  });

  it("returns null for an unknown product or channel", () => {
    expect(recommendForChannel(data, metrics, "nope", "offline")).toBeNull();
    expect(recommendForChannel(data, metrics, "eskopi", "nope")).toBeNull();
  });
});
