import { describe, expect, it } from "vitest";
import { buildDemoStore, seedDemoStore } from "@/lib/seed/demo-store";
import { admin, createStore, createTestUser } from "./helpers";

describe("deleting an auth user", () => {
  it("removes that user's profile, stores, store data, analyses and usage — and nobody else's", async () => {
    const leaving = await createTestUser("acct-leave");
    const staying = await createTestUser("acct-stay");
    const leavingStore = await createStore(leaving, "Toko Pergi");
    const stayingStore = await createStore(staying, "Toko Tetap");
    await leaving.client
      .from("materials")
      .insert({ store_id: leavingStore, name: "Gula", category: "bahan", purchase_qty: 1, purchase_unit: "kg", purchase_price: 1 });
    await admin.from("ai_usage").insert({ user_id: leaving.id });
    await admin.from("ai_analyses").insert({ store_id: leavingStore, user_id: leaving.id, model: "m", snapshot_hash: "h", input_snapshot: {}, output: {} });

    const { error } = await admin.auth.admin.deleteUser(leaving.id);
    expect(error).toBeNull();

    const count = async (table: string, column: string, value: string) =>
      (await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value)).count;
    expect(await count("profiles", "id", leaving.id)).toBe(0);
    expect(await count("stores", "id", leavingStore)).toBe(0);
    expect(await count("materials", "store_id", leavingStore)).toBe(0);
    expect(await count("ai_usage", "user_id", leaving.id)).toBe(0);
    expect(await count("ai_analyses", "store_id", leavingStore)).toBe(0);
    expect(await count("stores", "id", stayingStore)).toBe(1);
    expect(await count("profiles", "id", staying.id)).toBe(1);
  });

  it("removes a fully seeded sample store, including product_materials", async () => {
    const user = await createTestUser("acct-demo");
    const seeded = await seedDemoStore(user.client, buildDemoStore("id"), "Toko Contoh");
    if (!("storeId" in seeded)) throw new Error(`seed failed: ${seeded.error}`);
    const { storeId } = seeded;
    const tables = ["sales_channels", "materials", "products", "product_channel_prices", "operating_expenses", "assets"];
    const countBy = async (table: string) => (await admin.from(table).select("*", { count: "exact", head: true }).eq("store_id", storeId)).count ?? 0;
    for (const table of tables) expect(await countBy(table), `${table} seeded`).toBeGreaterThan(0);
    const productIds = (await admin.from("products").select("id").eq("store_id", storeId)).data!.map((row) => row.id);
    const links = async () => (await admin.from("product_materials").select("*", { count: "exact", head: true }).in("product_id", productIds)).count ?? 0;
    expect(await links()).toBeGreaterThan(0);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    expect(error).toBeNull();

    expect(await links()).toBe(0);
    for (const table of tables) expect(await countBy(table), `${table} deleted`).toBe(0);
    expect((await admin.from("stores").select("*", { count: "exact", head: true }).eq("id", storeId)).count).toBe(0);
  });
});
