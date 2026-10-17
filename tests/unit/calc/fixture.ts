import type { StoreData } from "@/lib/calc/types";

/** The hand-calculated coffee-shop store described in the Phase 2 plan. Returns a fresh copy. */
export function fixture(): StoreData {
  return {
    store: { id: "store", name: "Kedai Kopi", targetMarginPct: 40, operatingDaysPerMonth: 26 },
    materials: [
      { id: "kopi", name: "Kopi", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 150000, wastePct: 0 },
      { id: "susu", name: "Susu", category: "bahan", purchaseQty: 1, purchaseUnit: "l", purchasePrice: 20000, wastePct: 0 },
      { id: "cup", name: "Cup", category: "kemasan", purchaseQty: 1, purchaseUnit: "lusin", purchasePrice: 6000, wastePct: 0 },
      { id: "bubble", name: "Bubble wrap", category: "kemasan", purchaseQty: 100, purchaseUnit: "pcs", purchasePrice: 20000, wastePct: 0 },
    ],
    products: [{ id: "eskopi", name: "Es Kopi Susu", yieldQty: 10, targetMarginPct: null, isActive: true }],
    composition: [
      { id: "r1", productId: "eskopi", materialId: "kopi", qty: 200, unit: "g", basis: "batch", channelId: null },
      { id: "r2", productId: "eskopi", materialId: "susu", qty: 1, unit: "l", basis: "batch", channelId: null },
      { id: "r3", productId: "eskopi", materialId: "cup", qty: 1, unit: "pcs", basis: "unit", channelId: null },
      { id: "r4", productId: "eskopi", materialId: "bubble", qty: 1, unit: "pcs", basis: "unit", channelId: "online" },
    ],
    channels: [
      { id: "offline", name: "Offline – Tunai", commissionPct: 0, fixedFee: 0 },
      { id: "online", name: "GoFood", commissionPct: 20, fixedFee: 1000 },
    ],
    prices: [
      { productId: "eskopi", channelId: "offline", price: 18000, estMonthlySales: 300, competitorPrice: null },
      { productId: "eskopi", channelId: "online", price: 20000, estMonthlySales: 100, competitorPrice: 18000 },
    ],
    expenses: [
      { id: "e1", name: "Sewa kios", category: "sewa", amount: 1500000, frequency: "bulanan" },
      { id: "e2", name: "Listrik", category: "listrik_air", amount: 600000, frequency: "tahunan" },
    ],
    assets: [{ id: "a1", name: "Mesin kopi", category: "peralatan", qty: 1, unitPrice: 6000000, usefulLifeMonths: 60 }],
  };
}
