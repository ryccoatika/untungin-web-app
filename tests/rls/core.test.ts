import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, createStore, createTestUser, type TestUser } from "./helpers";

describe("profiles", () => {
  let a: TestUser;

  beforeAll(async () => {
    a = await createTestUser("profile");
  });

  it("creates a free-plan profile with the auth full_name on signup", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .select("plan, full_name")
      .eq("id", a.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ plan: "free", full_name: "Test profile" });
  });

  it("lets a user update their own full_name", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ full_name: "Budi" })
      .eq("id", a.id);
    expect(error).toBeNull();
  });

  it("does not let a user change their own plan", async () => {
    const { error } = await a.client.from("profiles").update({ plan: "pro" }).eq("id", a.id);
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("profiles").select("plan").eq("id", a.id).single();
    expect(data?.plan).toBe("free");
  });
});

describe("stores", () => {
  let a: TestUser;
  let b: TestUser;
  let storeA: string;

  beforeAll(async () => {
    a = await createTestUser("store-a");
    b = await createTestUser("store-b");
    storeA = await createStore(a, "Kopi A");
  });

  it("create_store creates a store owned by the caller with defaults", async () => {
    const { data } = await a.client
      .from("stores")
      .select("owner_id, name, target_margin_pct, operating_days_per_month, target_market")
      .eq("id", storeA)
      .single();
    expect(data).toEqual({
      owner_id: a.id,
      name: "Kopi A",
      target_margin_pct: 40,
      operating_days_per_month: 26,
      target_market: null,
    });
  });

  it("create_store adds the 'Offline – Tunai' channel", async () => {
    const { data } = await a.client
      .from("sales_channels")
      .select("name, commission_pct, fixed_fee")
      .eq("store_id", storeA);
    expect(data).toEqual([{ name: "Offline – Tunai", commission_pct: 0, fixed_fee: 0 }]);
  });

  it("hides other users' stores and channels", async () => {
    const stores = await b.client.from("stores").select("id").eq("id", storeA);
    expect(stores.data).toEqual([]);
    const channels = await b.client.from("sales_channels").select("id").eq("store_id", storeA);
    expect(channels.data).toEqual([]);
  });

  it("does not let other users update or delete a store", async () => {
    const updated = await b.client.from("stores").update({ name: "Dibajak" }).eq("id", storeA).select("id");
    expect(updated.data).toEqual([]);
    const deleted = await b.client.from("stores").delete().eq("id", storeA).select("id");
    expect(deleted.data).toEqual([]);
    const { data } = await admin.from("stores").select("name").eq("id", storeA).single();
    expect(data?.name).toBe("Kopi A");
  });

  it("does not let a user insert a store owned by someone else", async () => {
    const { error } = await b.client
      .from("stores")
      .insert({ owner_id: a.id, name: "Palsu", business_type: "minuman" });
    expect(error?.code).toBe("42501");
  });

  it("rejects a duplicate store name for the same owner, case-insensitively", async () => {
    await expect(createStore(a, "kopi a")).rejects.toMatchObject({ code: "23505" });
  });

  it("allows the same store name for different owners", async () => {
    await expect(createStore(b, "Kopi A")).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects an unknown business type", async () => {
    const { error } = await a.client.rpc("create_store", {
      p_name: "Jasa",
      p_business_type: "jasa",
      p_operating_days: 26,
      p_target_margin: 40,
    });
    expect(error?.code).toBe("23514");
  });

  it("rejects create_store for anonymous callers", async () => {
    const { error } = await anonClient().rpc("create_store", {
      p_name: "Anon",
      p_business_type: "minuman",
      p_operating_days: 26,
      p_target_margin: 40,
    });
    expect(error).not.toBeNull();
  });
});
