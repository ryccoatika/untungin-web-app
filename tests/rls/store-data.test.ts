import { describe, expect, it } from "vitest";
import { fetchStoreData } from "@/lib/data/store-data";
import { createStore, createTestUser } from "./helpers";

describe("fetchStoreData", () => {
  it("maps every table for the owner and returns null for anyone else", async () => {
    const owner = await createTestUser("data-owner");
    const other = await createTestUser("data-other");
    const storeId = await createStore(owner, "Kedai Data");
    const db = owner.client;

    const { data: channel } = await db.from("sales_channels").select("id").eq("store_id", storeId).single();
    const { data: material } = await db
      .from("materials")
      .insert({ store_id: storeId, name: "Gula", category: "bahan", purchase_qty: 1, purchase_unit: "kg", purchase_price: 15000, waste_pct: 5 })
      .select("id")
      .single();
    const { data: product } = await db.from("products").insert({ store_id: storeId, name: "Es Teh", yield_qty: 10 }).select("id").single();
    await db.from("product_materials").insert({
      store_id: storeId,
      product_id: product!.id,
      material_id: material!.id,
      qty: 100,
      unit: "g",
      basis: "batch",
    });
    await db.from("product_channel_prices").insert({
      store_id: storeId,
      product_id: product!.id,
      channel_id: channel!.id,
      price: 5000,
      est_monthly_sales: 200,
    });
    await db.from("operating_expenses").insert({ store_id: storeId, name: "Sewa", category: "sewa", amount: 1000000, frequency: "bulanan" });
    await db.from("assets").insert({
      store_id: storeId,
      name: "Kulkas",
      category: "elektronik",
      qty: 1,
      unit_price: 3000000,
      useful_life_months: 60,
    });

    expect(await fetchStoreData(db, storeId)).toMatchObject({
      store: { id: storeId, name: "Kedai Data", targetMarginPct: 40, operatingDaysPerMonth: 26 },
      materials: [{ id: material!.id, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 5 }],
      products: [{ id: product!.id, name: "Es Teh", yieldQty: 10, targetMarginPct: null, isActive: true }],
      composition: [{ productId: product!.id, materialId: material!.id, qty: 100, unit: "g", basis: "batch", channelId: null }],
      channels: [{ id: channel!.id, commissionPct: 0, fixedFee: 0 }],
      prices: [{ productId: product!.id, channelId: channel!.id, price: 5000, estMonthlySales: 200, competitorPrice: null }],
      expenses: [{ name: "Sewa", category: "sewa", amount: 1000000, frequency: "bulanan" }],
      assets: [{ name: "Kulkas", category: "elektronik", qty: 1, unitPrice: 3000000, usefulLifeMonths: 60 }],
    });
    expect(await fetchStoreData(other.client, storeId)).toBeNull();
  });

  it("returns rows created in one statement in id order", async () => {
    const owner = await createTestUser("data-order");
    const storeId = await createStore(owner, "Kedai Urut");
    const row = (name: string) => ({ store_id: storeId, name, category: "bahan" as const, purchase_qty: 1, purchase_unit: "kg" as const, purchase_price: 1000 });
    const { error } = await owner.client.from("materials").insert([row("A"), row("B"), row("C"), row("D")]);
    expect(error).toBeNull();

    const data = await fetchStoreData(owner.client, storeId);
    const ids = data!.materials.map((material) => material.id);
    expect(ids).toEqual([...ids].sort());
  });
});
