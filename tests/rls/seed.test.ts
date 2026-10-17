import { describe, expect, it } from "vitest";
import { buildDemoStore, seedDemoStore } from "@/lib/seed/demo-store";
import { createTestUser } from "./helpers";

async function counts(client: Awaited<ReturnType<typeof createTestUser>>["client"], storeId: string) {
  const tables = ["materials", "products", "product_materials", "product_channel_prices", "operating_expenses", "assets", "sales_channels"] as const;
  const result: Record<string, number> = {};
  for (const table of tables) {
    const { count } = await client.from(table).select("*", { count: "exact", head: true }).eq("store_id", storeId);
    result[table] = count ?? 0;
  }
  return result;
}

describe("seedDemoStore", () => {
  it("creates the whole sample store for the signed-in user", async () => {
    const user = await createTestUser("seed");
    const demo = buildDemoStore("id");
    const result = await seedDemoStore(user.client, demo, demo.store.name);
    expect("storeId" in result).toBe(true);
    const storeId = (result as { storeId: string }).storeId;
    expect(await counts(user.client, storeId)).toEqual({
      materials: demo.materials.length,
      products: demo.products.length,
      product_materials: demo.composition.length,
      product_channel_prices: demo.prices.length,
      operating_expenses: demo.expenses.length,
      assets: demo.assets.length,
      sales_channels: 2,
    });
  });

  it("reports a duplicate name without creating anything", async () => {
    const user = await createTestUser("seed-dup");
    const demo = buildDemoStore("id");
    await seedDemoStore(user.client, demo, demo.store.name);
    expect(await seedDemoStore(user.client, demo, demo.store.name)).toEqual({ error: "duplicate" });
    const { count } = await user.client.from("stores").select("*", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("removes the store when a later insert fails", async () => {
    const user = await createTestUser("seed-fail");
    const demo = buildDemoStore("id");
    const broken = { ...demo, assets: [{ ...demo.assets[0], usefulLifeMonths: 0 }] }; // violates useful_life_months >= 1
    expect(await seedDemoStore(user.client, broken, "Toko Gagal")).toEqual({ error: "failed" });
    const { count } = await user.client.from("stores").select("*", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("respects the store limit", async () => {
    const user = await createTestUser("seed-limit");
    const demo = buildDemoStore("id");
    await seedDemoStore(user.client, demo, "Satu");
    await seedDemoStore(user.client, demo, "Dua");
    expect(await seedDemoStore(user.client, demo, "Tiga")).toEqual({ error: "limit" });
  });
});
