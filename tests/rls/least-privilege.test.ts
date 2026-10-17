import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, createStore, createTestUser, type TestUser } from "./helpers";

const APP_TABLES = [
  "profiles",
  "stores",
  "sales_channels",
  "materials",
  "products",
  "product_materials",
  "product_channel_prices",
  "operating_expenses",
  "assets",
  "ai_analyses",
  "ai_usage",
] as const;

describe("anon has no access to app tables", () => {
  it.each(APP_TABLES)("anon cannot read %s", async (table) => {
    const { data, error } = await anonClient().from(table).select("*").limit(1);
    expect(error?.code === "42501" || /permission denied/i.test(error?.message ?? "")).toBe(true);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("signed-in users keep normal access to their own data", () => {
  let owner: TestUser;
  let storeId: string;

  beforeAll(async () => {
    owner = await createTestUser("lp-owner");
    storeId = await createStore(owner, "Toko Hak");
  });

  it("can still insert, update, read and delete their materials", async () => {
    const insert = await owner.client
      .from("materials")
      .insert({ store_id: storeId, name: "Gula", category: "bahan", purchase_qty: 1, purchase_unit: "kg", purchase_price: 15000 })
      .select("id")
      .single();
    expect(insert.error).toBeNull();
    const update = await owner.client.from("materials").update({ purchase_price: 16000 }).eq("id", insert.data!.id).select("purchase_price");
    expect(update.data).toEqual([{ purchase_price: 16000 }]);
    const removed = await owner.client.from("materials").delete().eq("id", insert.data!.id).select("id");
    expect(removed.data).toHaveLength(1);
  });

  it("can still read their profile and change their name", async () => {
    const { error } = await owner.client.from("profiles").update({ full_name: "Nama Baru" }).eq("id", owner.id);
    expect(error).toBeNull();
    const { data } = await owner.client.from("profiles").select("full_name").eq("id", owner.id).single();
    expect(data?.full_name).toBe("Nama Baru");
  });
});

describe("the server role keeps what the AI feature needs", () => {
  it("can insert and delete AI usage and analyses", async () => {
    const user = await createTestUser("lp-ai");
    const storeId = await createStore(user, "Toko AI Hak");
    const usage = await admin.from("ai_usage").insert({ user_id: user.id }).select("id").single();
    expect(usage.error).toBeNull();
    expect((await admin.from("ai_usage").delete().eq("id", usage.data!.id)).error).toBeNull();
    const analysis = await admin
      .from("ai_analyses")
      .insert({ store_id: storeId, user_id: user.id, model: "m", snapshot_hash: "h", input_snapshot: {}, output: {} })
      .select("id")
      .single();
    expect(analysis.error).toBeNull();
  });
});
