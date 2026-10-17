import { describe, expect, it } from "vitest";
import { computeMetrics, lineStatus } from "@/lib/calc/metrics";
import { fixture } from "./fixture";

/** Every number anywhere in a value (JSON.stringify would hide NaN as null). */
function allNumbers(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(allNumbers);
  return [];
}

function line(metrics: ReturnType<typeof computeMetrics>, channelId: string) {
  const found = metrics.lines.find((l) => l.channelId === channelId);
  if (!found) throw new Error(`no line for ${channelId}`);
  return found;
}

describe("computeMetrics — the coffee-shop fixture", () => {
  const m = computeMetrics(fixture());

  it("computes fixed costs, total units and overhead", () => {
    expect(m.fixedCosts.expenses).toBeCloseTo(1550000, 6);
    expect(m.fixedCosts.depreciation).toBeCloseTo(100000, 6);
    expect(m.fixedCosts.total).toBeCloseTo(1650000, 6);
    expect(m.totalUnits).toBe(400);
    expect(m.overheadPerUnit).toBeCloseTo(4125, 6);
  });

  it("computes each product-channel line", () => {
    expect(line(m, "offline")).toMatchObject({ price: 18000, estMonthlySales: 300, status: "green", targetMarginPct: 40 });
    expect(line(m, "offline").materialCost).toBeCloseTo(5500, 6);
    expect(line(m, "offline").fullCost).toBeCloseTo(9625, 6);
    expect(line(m, "offline").netPrice).toBeCloseTo(18000, 6);
    expect(line(m, "offline").contribution).toBeCloseTo(12500, 6);
    expect(line(m, "offline").marginPct).toBeCloseTo((8375 / 18000) * 100, 6);

    expect(line(m, "online")).toMatchObject({ status: "yellow", competitorPrice: 18000 });
    expect(line(m, "online").materialCost).toBeCloseTo(5700, 6);
    expect(line(m, "online").fullCost).toBeCloseTo(9825, 6);
    expect(line(m, "online").netPrice).toBeCloseTo(15000, 6);
    expect(line(m, "online").contribution).toBeCloseTo(9300, 6);
    expect(line(m, "online").marginPct).toBeCloseTo(25.875, 6);
  });

  it("computes monthly totals", () => {
    expect(m.grossRevenue).toBeCloseTo(7400000, 6);
    expect(m.netRevenue).toBeCloseTo(6900000, 6);
    expect(m.materialCosts).toBeCloseTo(2220000, 6);
    expect(m.grossProfit).toBeCloseTo(4680000, 6);
    expect(m.netProfit).toBeCloseTo(3030000, 6);
    expect(m.netMarginPct).toBeCloseTo((3030000 / 7400000) * 100, 6);
  });

  it("computes break-even and payback", () => {
    expect(m.avgContribution).toBeCloseTo(11700, 6);
    expect(m.bepUnitsMonthly).toBe(142);
    expect(m.bepUnitsDaily).toBe(6);
    expect(m.totalCapital).toBe(6000000);
    expect(m.paybackMonths).toBeCloseTo(6000000 / 3030000, 6);
    expect(m.productsWithoutPrice).toEqual([]);
  });
});

describe("computeMetrics — edge cases", () => {
  it("without sales estimates: no overhead, BEP, or margin from revenue; nothing is NaN", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    const m = computeMetrics(data);
    expect(m.totalUnits).toBe(0);
    expect(m.overheadPerUnit).toBeNull();
    expect(m.lines.every((l) => l.fullCost === null)).toBe(true);
    expect(line(m, "offline").marginPct).toBeCloseTo((12500 / 18000) * 100, 6); // falls back to materialCost
    expect(m.grossRevenue).toBe(0);
    expect(m.netMarginPct).toBeNull();
    expect(m.avgContribution).toBeNull();
    expect(m.bepUnitsMonthly).toBeNull();
    expect(m.bepUnitsDaily).toBeNull();
    expect(m.netProfit).toBeCloseTo(-1650000, 6);
    expect(m.paybackMonths).toBeNull();
    expect(allNumbers(m).every(Number.isFinite)).toBe(true);
  });

  it("an empty store gives zeros and nulls", () => {
    const m = computeMetrics({ ...fixture(), materials: [], products: [], composition: [], prices: [], expenses: [], assets: [] });
    expect(m).toMatchObject({
      lines: [],
      productsWithoutPrice: [],
      totalUnits: 0,
      overheadPerUnit: null,
      grossRevenue: 0,
      netProfit: 0,
      netMarginPct: null,
      avgContribution: null,
      bepUnitsMonthly: null,
      totalCapital: 0,
      paybackMonths: null,
    });
  });

  it("break-even is null when every sale loses money", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, price: 5000 }));
    const m = computeMetrics(data);
    expect(m.avgContribution).toBeLessThan(0);
    expect(m.bepUnitsMonthly).toBeNull();
    expect(m.bepUnitsDaily).toBeNull();
  });

  it("break-even is 0 without fixed costs", () => {
    const data = fixture();
    data.expenses = [];
    data.assets = [];
    expect(computeMetrics(data).bepUnitsMonthly).toBe(0);
  });

  it("does not round an exact break-even up because of floating point", () => {
    const data = fixture();
    data.expenses = [{ id: "e", name: "Sewa", category: "sewa", amount: 1170000, frequency: "bulanan" }];
    data.assets = [];
    expect(computeMetrics(data).bepUnitsMonthly).toBe(100); // 1.170.000 / 11.700
  });

  it("leaves inactive products out of lines and totals", () => {
    const data = fixture();
    data.products = [...data.products, { id: "old", name: "Lama", yieldQty: 1, targetMarginPct: null, isActive: false }];
    data.prices = [...data.prices, { productId: "old", channelId: "offline", price: 1000, estMonthlySales: 999, competitorPrice: null }];
    const m = computeMetrics(data);
    expect(m.lines).toHaveLength(2);
    expect(m.totalUnits).toBe(400);
    expect(m.productsWithoutPrice).toEqual([]);
  });

  it("lists active products without a price", () => {
    const data = fixture();
    data.products = [...data.products, { id: "baru", name: "Baru", yieldQty: 1, targetMarginPct: null, isActive: true }];
    expect(computeMetrics(data).productsWithoutPrice).toEqual(["baru"]);
  });

  it("a price of 0 has no margin and is red when it loses money", () => {
    const data = fixture();
    data.prices[0] = { ...data.prices[0], price: 0 };
    const offline = line(computeMetrics(data), "offline");
    expect(offline.marginPct).toBeNull();
    expect(offline.status).toBe("red");
  });

  it("uses the product's own target margin", () => {
    const data = fixture();
    data.products[0] = { ...data.products[0], targetMarginPct: 20 };
    const online = line(computeMetrics(data), "online");
    expect(online.targetMarginPct).toBe(20);
    expect(online.status).toBe("green");
  });
});

describe("lineStatus", () => {
  it.each([
    [-1, 50, 40, "red"],
    [0, 40, 40, "green"],
    [100, 39.9, 40, "yellow"],
    [100, null, 40, "yellow"],
    [0, null, 40, "yellow"],
  ] as const)("contribution %d, margin %s, target %d → %s", (contribution, margin, target, expected) => {
    expect(lineStatus(contribution, margin, target)).toBe(expected);
  });
});
