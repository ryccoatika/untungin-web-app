import { beforeAll, describe, expect, it } from "vitest";
import { admin, createStore, createTestUser, type TestUser } from "./helpers";

describe("profiles.locale", () => {
  let a: TestUser;

  beforeAll(async () => {
    a = await createTestUser("locale");
  });

  it("starts as null", async () => {
    const { data } = await a.client.from("profiles").select("locale").eq("id", a.id).single();
    expect(data?.locale).toBeNull();
  });

  it("lets a user save their own locale", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .update({ locale: "en" })
      .eq("id", a.id)
      .select("locale");
    expect(error).toBeNull();
    expect(data).toEqual([{ locale: "en" }]);
  });

  it("rejects unsupported locales", async () => {
    const { error } = await a.client.from("profiles").update({ locale: "fr" }).eq("id", a.id);
    expect(error?.code).toBe("23514");
  });

  it("still does not let a user change their plan", async () => {
    const { error } = await a.client.from("profiles").update({ plan: "pro" }).eq("id", a.id);
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("profiles").select("plan").eq("id", a.id).single();
    expect(data?.plan).toBe("free");
  });
});

describe("create_store default channel name", () => {
  let a: TestUser;

  beforeAll(async () => {
    a = await createTestUser("channel-name");
  });

  it("defaults to 'Offline – Tunai'", async () => {
    const storeId = await createStore(a, "Toko Default");
    const { data } = await a.client.from("sales_channels").select("name").eq("store_id", storeId);
    expect(data).toEqual([{ name: "Offline – Tunai" }]);
  });

  it("uses the name passed by the app", async () => {
    const { data: storeId, error } = await a.client.rpc("create_store", {
      p_name: "English Store",
      p_business_type: "minuman",
      p_operating_days: 26,
      p_target_margin: 40,
      p_default_channel_name: "Offline – Cash",
    });
    expect(error).toBeNull();
    const { data } = await a.client.from("sales_channels").select("name").eq("store_id", storeId as string);
    expect(data).toEqual([{ name: "Offline – Cash" }]);
  });
});
