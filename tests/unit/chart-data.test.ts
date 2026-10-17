import { describe, expect, it } from "vitest";
import { analyzeStore, type StoreData } from "@/lib/calc";
import { MAX_CHART_BARS, productChartData } from "@/lib/dashboard/chart-data";

const CASH = "00000000-0000-4000-8000-0000000000c1";
const GOFOOD = "00000000-0000-4000-8000-0000000000c2";
const GULA = "00000000-0000-4000-8000-0000000000a1";

/** n products; product i: price 5.000 + 1.000·i, material Rp300 (200 g gula per 10), est 100 per month. */
function store(n: number, overrides: Partial<StoreData> = {}): StoreData {
  const ids = Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
  return {
    store: { id: "s", name: "Toko", targetMarginPct: 40, operatingDaysPerMonth: 26 },
    materials: [{ id: GULA, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 }],
    products: ids.map((id, i) => ({ id, name: `Produk ${i + 1}`, category: null, yieldQty: 10, targetMarginPct: null, isActive: true })),
    composition: ids.map((id, i) => ({ id: `c${i}`, productId: id, materialId: GULA, qty: 200, unit: "g", basis: "batch", channelId: null })),
    channels: [
      { id: CASH, name: "Tunai", commissionPct: 0, fixedFee: 0 },
      { id: GOFOOD, name: "GoFood", commissionPct: 20, fixedFee: 0 },
    ],
    prices: ids.map((id, i) => ({ productId: id, channelId: CASH, price: 5000 + 1000 * i, estMonthlySales: 100, competitorPrice: null })),
    expenses: [],
    assets: [],
    ...overrides,
  };
}

const chart = (data: StoreData) => productChartData(analyzeStore(data), data);

describe("productChartData", () => {
  it("gives each product its monthly contribution, highest first", () => {
    const bars = chart(store(2));
    // Produk 2: (6.000 − 300) × 100; Produk 1: (5.000 − 300) × 100
    expect(bars.map((bar) => [bar.name, bar.value])).toEqual([
      ["Produk 2", 570_000],
      ["Produk 1", 470_000],
    ]);
    expect(bars[0].status).toBe("green");
  });

  it("adds a product's channels together and takes the worst status", () => {
    const data = store(1);
    data.prices.push({ productId: data.products[0].id, channelId: GOFOOD, price: 300, estMonthlySales: 10, competitorPrice: null });
    const [bar] = chart(data);
    // cash 4.700 × 100 + GoFood (240 − 300) × 10
    expect(bar.value).toBe(470_000 - 600);
    expect(bar.status).toBe("red");
  });

  it("shows losses as negative values", () => {
    const data = store(1, {});
    data.prices[0].price = 200;
    expect(chart(data)[0].value).toBe(-10_000);
  });

  it("leaves out products without a sales estimate and inactive products", () => {
    const data = store(3);
    data.prices[0].estMonthlySales = 0;
    data.products[1].isActive = false;
    expect(chart(data).map((bar) => bar.name)).toEqual(["Produk 3"]);
  });

  it(`keeps the ${MAX_CHART_BARS} largest by size, losses included`, () => {
    const data = store(12);
    // Produk 1 becomes a big loss: (100 − 300) × 10.000 = −2.000.000, the largest by size.
    data.prices[0].price = 100;
    data.prices[0].estMonthlySales = 10_000;
    const bars = chart(data);
    expect(bars).toHaveLength(MAX_CHART_BARS);
    expect(bars.at(-1)!.name).toBe("Produk 1");
    expect(bars.at(-1)!.value).toBe(-2_000_000);
    expect(bars.map((bar) => bar.value)).toEqual([...bars.map((bar) => bar.value)].sort((a, b) => b - a));
  });

  it("returns nothing for a store without sales", () => {
    const data = store(2);
    for (const price of data.prices) price.estMonthlySales = 0;
    expect(chart(data)).toEqual([]);
  });
});
