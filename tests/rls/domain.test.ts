import { beforeAll, describe, expect, it } from "vitest";
import { admin, createStore, createTestUser, type TestUser } from "./helpers";

const rows = {
  materials: (storeId: string) => ({
    store_id: storeId,
    name: "Gula",
    category: "bahan",
    purchase_qty: 1,
    purchase_unit: "kg",
    purchase_price: 18000,
  }),
  products: (storeId: string) => ({ store_id: storeId, name: "Es Kopi Susu" }),
  operating_expenses: (storeId: string) => ({
    store_id: storeId,
    name: "Listrik",
    category: "listrik_air",
    amount: 300000,
    frequency: "bulanan",
  }),
  assets: (storeId: string) => ({
    store_id: storeId,
    name: "Meja",
    category: "furnitur",
    qty: 2,
    unit_price: 500000,
    useful_life_months: 36,
  }),
} as const;

async function insertOne(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table).insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

describe("store-scoped tables", () => {
  let a: TestUser;
  let b: TestUser;
  let storeA: string;

  beforeAll(async () => {
    a = await createTestUser("dom-a");
    b = await createTestUser("dom-b");
    storeA = await createStore(a, "Toko A");
  });

  for (const [table, row] of Object.entries(rows)) {
    it(`${table}: owner can insert and read; others cannot read or insert`, async () => {
      const id = await insertOne(a, table, row(storeA));

      const own = await a.client.from(table).select("id").eq("id", id);
      expect(own.data).toEqual([{ id }]);

      const other = await b.client.from(table).select("id").eq("id", id);
      expect(other.data).toEqual([]);

      const { error } = await b.client.from(table).insert(row(storeA));
      expect(error?.code).toBe("42501");
    });
  }

  it("rejects units outside the supported list", async () => {
    const { error } = await a.client
      .from("materials")
      .insert({ ...rows.materials(storeA), purchase_unit: "sdm" });
    expect(error?.code).toBe("23514");
  });
});

describe("cross-store references", () => {
  let a: TestUser;
  let store1: string;
  let store2: string;
  let product1: string;
  let material1: string;
  let material2: string;
  let channel2: string;

  beforeAll(async () => {
    a = await createTestUser("cross");
    store1 = await createStore(a, "Satu");
    store2 = await createStore(a, "Dua");
    product1 = await insertOne(a, "products", rows.products(store1));
    material1 = await insertOne(a, "materials", rows.materials(store1));
    material2 = await insertOne(a, "materials", rows.materials(store2));
    const { data } = await a.client.from("sales_channels").select("id").eq("store_id", store2).single();
    channel2 = data!.id;
  });

  it("product_materials rejects a material from another store", async () => {
    const { error } = await a.client.from("product_materials").insert({
      store_id: store1,
      product_id: product1,
      material_id: material2,
      qty: 15,
      unit: "g",
    });
    expect(error?.code).toBe("23503");
  });

  it("product_materials rejects a channel from another store", async () => {
    const { error } = await a.client.from("product_materials").insert({
      store_id: store1,
      product_id: product1,
      material_id: material1,
      qty: 1,
      unit: "pcs",
      basis: "unit",
      channel_id: channel2,
    });
    expect(error?.code).toBe("23503");
  });

  it("product_channel_prices rejects a channel from another store", async () => {
    const { error } = await a.client.from("product_channel_prices").insert({
      store_id: store1,
      product_id: product1,
      channel_id: channel2,
      price: 15000,
    });
    expect(error?.code).toBe("23503");
  });

  it("blocks deleting a material that a product uses", async () => {
    await insertOne(a, "product_materials", {
      store_id: store1,
      product_id: product1,
      material_id: material1,
      qty: 15,
      unit: "g",
    });
    const { error } = await a.client.from("materials").delete().eq("id", material1);
    expect(error?.code).toBe("23503");
  });

  it("deleting a store removes all of its data", async () => {
    const { error } = await a.client.from("stores").delete().eq("id", store1);
    expect(error).toBeNull();
    const left = await admin.from("materials").select("id").eq("store_id", store1);
    expect(left.data).toEqual([]);
    const pm = await admin.from("product_materials").select("id").eq("store_id", store1);
    expect(pm.data).toEqual([]);
  });
});

describe("ai_analyses", () => {
  let a: TestUser;
  let b: TestUser;
  let storeA: string;

  beforeAll(async () => {
    a = await createTestUser("ai-a");
    b = await createTestUser("ai-b");
    storeA = await createStore(a, "AI Toko");
  });

  const analysis = (storeId: string, userId: string) => ({
    store_id: storeId,
    user_id: userId,
    model: "test-model",
    snapshot_hash: "abc",
    input_snapshot: {},
    output: { summary: "ok" },
  });

  it("users cannot insert analyses directly", async () => {
    const { error } = await a.client.from("ai_analyses").insert(analysis(storeA, a.id));
    expect(error?.code).toBe("42501");
  });

  it("owner can read analyses written by the server; others cannot", async () => {
    const { error } = await admin.from("ai_analyses").insert(analysis(storeA, a.id));
    expect(error).toBeNull();
    const own = await a.client.from("ai_analyses").select("model").eq("store_id", storeA);
    expect(own.data).toEqual([{ model: "test-model" }]);
    const other = await b.client.from("ai_analyses").select("model").eq("store_id", storeA);
    expect(other.data).toEqual([]);
  });
});
