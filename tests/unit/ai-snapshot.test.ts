import { describe, expect, it } from "vitest";
import { analyzeStore, type StoreData } from "@/lib/calc";
import { remainingQuota, startOfJakartaDay } from "@/lib/ai/quota";
import { buildSnapshot, canonicalJson, snapshotHash } from "@/lib/ai/snapshot";

const ids = {
  store: "00000000-0000-4000-8000-000000000001",
  gula: "00000000-0000-4000-8000-000000000002",
  teh: "00000000-0000-4000-8000-000000000003",
  tunai: "00000000-0000-4000-8000-000000000004",
  lama: "00000000-0000-4000-8000-000000000005",
};

/** Gula Rp15/g; Es teh 200 g per 10 → Rp300; Rp5.000 × 600; rent Rp1.000.000 → net Rp1.820.000. */
function storeData(overrides: Partial<StoreData> = {}): StoreData {
  return {
    store: { id: ids.store, name: "Toko Teh", targetMarginPct: 40, operatingDaysPerMonth: 26 },
    materials: [
      { id: ids.gula, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 },
    ],
    products: [
      { id: ids.teh, name: "Es teh", category: null, yieldQty: 10, targetMarginPct: null, isActive: true },
      { id: ids.lama, name: "Produk lama", category: null, yieldQty: 1, targetMarginPct: null, isActive: false },
    ],
    composition: [
      { id: "c1", productId: ids.teh, materialId: ids.gula, qty: 200, unit: "g", basis: "batch", channelId: null },
    ],
    channels: [{ id: ids.tunai, name: "Offline – Tunai", commissionPct: 0, fixedFee: 0 }],
    prices: [{ productId: ids.teh, channelId: ids.tunai, price: 5000, estMonthlySales: 600, competitorPrice: 4500 }],
    expenses: [{ id: "e1", name: "Sewa", category: "sewa", amount: 1000000, frequency: "bulanan" }],
    assets: [],
    ...overrides,
  };
}

const info = { businessType: "minuman", targetMarket: "menengah" };

function snapshotOf(data = storeData(), locale: "id" | "en" = "id") {
  return buildSnapshot(data, analyzeStore(data), info, locale);
}

describe("startOfJakartaDay", () => {
  it.each([
    ["2026-10-17T16:59:59.999Z", "2026-10-16T17:00:00.000Z"], // 23:59:59 WIB on the 17th
    ["2026-10-17T17:00:00.000Z", "2026-10-17T17:00:00.000Z"], // 00:00 WIB on the 18th
    ["2026-10-17T00:00:00.000Z", "2026-10-16T17:00:00.000Z"], // 07:00 WIB on the 17th
    ["2026-12-31T17:30:00.000Z", "2026-12-31T17:00:00.000Z"], // 00:30 WIB on 1 January
    ["1969-12-30T20:00:00.000Z", "1969-12-30T17:00:00.000Z"], // before 1970: 03:00 WIB on Dec 31
  ])("%s → %s", (now, start) => {
    expect(startOfJakartaDay(new Date(now)).toISOString()).toBe(start);
  });
});

describe("remainingQuota", () => {
  it("never goes below zero", () => {
    expect(remainingQuota(3, 1)).toBe(2);
    expect(remainingQuota(3, 5)).toBe(0);
  });
});

describe("buildSnapshot", () => {
  it("summarises the store with rounded numbers", () => {
    const snapshot = snapshotOf();
    expect(snapshot.locale).toBe("id");
    expect(snapshot.store).toEqual({
      name: "Toko Teh",
      businessType: "minuman",
      targetMarket: "menengah",
      targetMarginPct: 40,
      operatingDaysPerMonth: 26,
    });
    expect(snapshot.products).toEqual([
      {
        id: ids.teh,
        name: "Es teh",
        lines: [
          {
            channelId: ids.tunai,
            price: 5000,
            competitorPrice: 4500,
            estMonthlySales: 600,
            materialCost: 300,
            fullCost: 1967,
            netPrice: 5000,
            contribution: 4700,
            marginPct: 60.7,
            targetMarginPct: 40,
            status: "green",
          },
        ],
      },
    ]);
    expect(snapshot.totals).toEqual({
      grossRevenue: 3000000,
      netRevenue: 3000000,
      materialCosts: 180000,
      netProfit: 1820000,
      netMarginPct: 60.7,
      totalUnits: 600,
      fixedCosts: { byCategory: { sewa: 1000000 }, depreciation: 0, total: 1000000 },
      bepUnitsMonthly: 213,
      bepUnitsDaily: 9,
      totalCapital: 0,
      paybackMonths: null,
    });
    expect(snapshot.warnings).toEqual([{ code: "NO_OWNER_SALARY", lines: [] }]);
    expect(snapshot.materials).toEqual([
      { id: ids.gula, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 },
    ]);
    expect(snapshot.channels).toEqual([{ id: ids.tunai, name: "Offline – Tunai", commissionPct: 0, fixedFee: 0 }]);
  });

  it("leaves out inactive products and keeps active products without a price", () => {
    const data = storeData({
      products: [
        ...storeData().products,
        { id: "00000000-0000-4000-8000-000000000006", name: "Kopi", category: null, yieldQty: 1, targetMarginPct: null, isActive: true },
      ],
    });
    const names = snapshotOf(data).products.map((product) => [product.name, product.lines.length]);
    expect(names).toEqual([
      ["Es teh", 1],
      ["Kopi", 0],
    ]);
  });

  it("gives payback months when there is capital", () => {
    const data = storeData({
      assets: [{ id: "a1", name: "Kulkas", category: "elektronik", qty: 1, unitPrice: 3640000, usefulLifeMonths: 1000 }],
    });
    // depreciation 3.640/month → net 1.816.360 → 3.640.000 / 1.816.360 ≈ 2.0
    expect(snapshotOf(data).totals.paybackMonths).toBe(2);
  });

  it("sets marginPct to null when price is 0", () => {
    const data = storeData({
      prices: [{ ...storeData().prices[0], price: 0 }],
    });
    const snapshot = snapshotOf(data);
    expect(snapshot.products[0]?.lines[0]?.marginPct).toBeNull();
  });

  it("nulls fullCost, netMarginPct, bepUnitsMonthly, bepUnitsDaily when all estMonthlySales is 0", () => {
    const data = storeData({
      prices: [{ ...storeData().prices[0], estMonthlySales: 0 }],
    });
    const snapshot = snapshotOf(data);
    expect(snapshot.products[0]?.lines[0]?.fullCost).toBeNull();
    expect(snapshot.totals.netMarginPct).toBeNull();
    expect(snapshot.totals.bepUnitsMonthly).toBeNull();
    expect(snapshot.totals.bepUnitsDaily).toBeNull();
  });

  it("makes fixedCosts.byCategory empty when no expenses", () => {
    const data = storeData({ expenses: [] });
    const snapshot = snapshotOf(data);
    expect(snapshot.totals.fixedCosts.byCategory).toEqual({});
  });

  it("serializes tiny negative contribution as 0, not -0", () => {
    const data = storeData({
      prices: [{ ...storeData().prices[0], price: 299.6 }], // material cost 300, contribution = 299.6 - 300 = -0.4 → rounds to -0
    });
    const snapshot = snapshotOf(data);
    const line = snapshot.products[0]?.lines[0];
    expect(line).toBeDefined();
    expect(Object.is(line!.contribution, -0)).toBe(false);
    expect(line!.contribution).toBe(0);
  });

  it("ignores price rows for non-existent channels", () => {
    const data = storeData({
      prices: [
        storeData().prices[0]!,
        {
          productId: ids.teh,
          channelId: "00000000-0000-4000-8000-000000000099", // doesn't exist
          price: 4000,
          estMonthlySales: 100,
          competitorPrice: null,
        },
      ],
    });
    const snapshot = snapshotOf(data);
    // Should only have the one line for the tunai channel
    expect(snapshot.products[0]?.lines.length).toBe(1);
  });
});

describe("canonicalJson and snapshotHash", () => {
  it("ignores key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,{"x":2,"y":1}]},"b":1}',
    );
  });

  it("serializes undefined array elements as null", () => {
    expect(canonicalJson([1, undefined])).toBe("[1,null]");
  });

  it("is stable for the same data and changes when a number the AI sees changes", () => {
    const first = snapshotHash(snapshotOf());
    expect(snapshotHash(snapshotOf())).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);

    const cheaper = storeData({ prices: [{ ...storeData().prices[0], price: 4900 }] });
    expect(snapshotHash(snapshotOf(cheaper))).not.toBe(first);
  });

  it("changes with the language", () => {
    expect(snapshotHash(snapshotOf(storeData(), "en"))).not.toBe(snapshotHash(snapshotOf()));
  });

  it("ignores float noise below the rounding", () => {
    const noisy = storeData({ materials: [{ ...storeData().materials[0], purchasePrice: 15000.0000001 }] });
    expect(snapshotHash(snapshotOf(noisy))).toBe(snapshotHash(snapshotOf()));
  });

  it("ignores float noise in competitorPrice", () => {
    const noisy = storeData({
      prices: [{ ...storeData().prices[0], competitorPrice: (storeData().prices[0]!.competitorPrice ?? 0) + 1e-7 }],
    });
    expect(snapshotHash(snapshotOf(noisy))).toBe(snapshotHash(snapshotOf()));
  });

  it("ignores float noise in channel commissionPct", () => {
    const noisy = storeData({
      channels: [{ ...storeData().channels[0]!, commissionPct: 0 + 1e-7 }],
    });
    expect(snapshotHash(snapshotOf(noisy))).toBe(snapshotHash(snapshotOf()));
  });

  it("ignores float noise in channel fixedFee", () => {
    const noisy = storeData({
      channels: [{ ...storeData().channels[0]!, fixedFee: 0 + 1e-7 }],
    });
    expect(snapshotHash(snapshotOf(noisy))).toBe(snapshotHash(snapshotOf()));
  });

  it("ignores float noise in material wastePct", () => {
    const noisy = storeData({
      materials: [{ ...storeData().materials[0]!, wastePct: 0 + 1e-7 }],
    });
    expect(snapshotHash(snapshotOf(noisy))).toBe(snapshotHash(snapshotOf()));
  });

  it("ignores float noise in expense amount", () => {
    const noisy = storeData({
      expenses: [{ ...storeData().expenses[0]!, amount: 1000000 + 1e-7 }],
    });
    expect(snapshotHash(snapshotOf(noisy))).toBe(snapshotHash(snapshotOf()));
  });
});

describe("buildSnapshot NaN handling", () => {
  it("throws on NaN in analysis totals", () => {
    const data = storeData();
    const analysis = analyzeStore(data);
    const badAnalysis = { ...analysis, netMarginPct: NaN } as unknown as typeof analysis;
    expect(() => buildSnapshot(data, badAnalysis, info, "id")).toThrow(
      "Non-finite number in AI snapshot",
    );
  });

  it("throws on Infinity in line prices", () => {
    const data = storeData();
    const analysis = analyzeStore(data);
    const badAnalysis = {
      ...analysis,
      lines: [{ ...analysis.lines[0]!, price: Infinity }],
    } as unknown as typeof analysis;
    expect(() => buildSnapshot(data, badAnalysis, info, "id")).toThrow(
      "Non-finite number in AI snapshot",
    );
  });
});
