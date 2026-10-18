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

  it("creates the sample records under RLS for the seeding user", async () => {
    const user = await createTestUser("seed-records");
    const demo = buildDemoStore("id");
    const result = await seedDemoStore(user.client, demo, demo.store.name);
    const storeId = (result as { storeId: string }).storeId;

    const { data: days } = await user.client.from("sales_days").select("id, date, closed").eq("store_id", storeId).order("date");
    expect(days).toHaveLength(demo.records.days.length);
    expect(days!.filter((d) => d.closed)).toHaveLength(1);
    expect(days![0].date).toBe(demo.records.from);

    const { data: lines } = await user.client.from("sales_lines").select("day_id, product_id, channel_id, qty, net_unit, hpp_unit").eq("store_id", storeId);
    const expectedLines = demo.records.days.reduce((n, d) => n + d.counts.length, 0);
    expect(lines).toHaveLength(expectedLines);
    expect(lines!.every((l) => l.product_id && l.channel_id && l.qty > 0 && Number(l.hpp_unit) > 0)).toBe(true);

    const { data: purchases } = await user.client.from("purchases").select("material_id, material_name").eq("store_id", storeId);
    expect(purchases).toHaveLength(2);
    expect(purchases!.every((p) => p.material_id)).toBe(true);

    // Purchases at today's price leave every material price as seeded.
    const { data: materials } = await user.client.from("materials").select("name, purchase_price").eq("store_id", storeId);
    for (const m of demo.materials) expect(materials!.find((row) => row.name === m.name)!.purchase_price).toBe(m.purchasePrice);
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
