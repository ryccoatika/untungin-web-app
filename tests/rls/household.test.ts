import { beforeAll, describe, expect, it } from "vitest";
import { createStore, createTestUser, type TestUser } from "./helpers";

describe("household recipe units", () => {
  let owner: TestUser;
  let storeId: string;
  let materialId: string;
  let productId: string;

  const material = (extra: Record<string, unknown>) => ({
    store_id: storeId,
    name: "Gula",
    category: "bahan",
    purchase_qty: 1,
    purchase_unit: "kg",
    purchase_price: 18000,
    ...extra,
  });

  beforeAll(async () => {
    owner = await createTestUser("household");
    storeId = await createStore(owner, "Toko Takaran");
    const { data: product, error } = await owner.client
      .from("products")
      .insert({ store_id: storeId, name: "Es Kopi" })
      .select("id")
      .single();
    if (error) throw error;
    productId = product.id;
  });

  it("accepts a spoon weight within range", async () => {
    const { data, error } = await owner.client
      .from("materials")
      .insert(material({ grams_per_sdm: 12.5 }))
      .select("id, grams_per_sdm")
      .single();
    expect(error).toBeNull();
    expect(Number(data?.grams_per_sdm)).toBe(12.5);
    materialId = data!.id;
  });

  it.each([0, 2000, -1])("rejects a spoon weight of %d", async (value) => {
    const { error } = await owner.client.from("materials").insert(material({ grams_per_sdm: value }));
    expect(error?.code).toBe("23514");
  });

  it("accepts household recipe units and rejects unknown ones", async () => {
    const row = (unit: string) => ({
      store_id: storeId,
      product_id: productId,
      material_id: materialId,
      qty: 1,
      unit,
      basis: "batch",
    });
    for (const unit of ["sdm", "sdt", "gelas"]) {
      const { error } = await owner.client.from("product_materials").insert(row(unit));
      expect(error).toBeNull();
    }
    const { error } = await owner.client.from("product_materials").insert(row("sendok"));
    expect(error?.code).toBe("23514");
  });
});
