import { beforeAll, describe, expect, it } from "vitest";
import { admin, createStore, createTestUser, type TestUser } from "./helpers";

const farPast = "2000-01-01T00:00:00.000Z";
const farFuture = "2999-01-01T00:00:00.000Z";

async function claim(userId: string, since = farPast, limit = 3) {
  const { data, error } = await admin.rpc("claim_ai_usage", { p_user_id: userId, p_since: since, p_limit: limit });
  if (error) throw error;
  return data as string | null;
}

async function usageCount(userId: string) {
  const { count, error } = await admin.from("ai_usage").select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

describe("ai_usage and claim_ai_usage", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    a = await createTestUser("ai-a");
    b = await createTestUser("ai-b");
  });

  it("claims up to the limit, then returns null", async () => {
    const user = await createTestUser("ai-limit");
    expect(await claim(user.id, farPast, 2)).toMatch(/^[0-9a-f-]{36}$/);
    expect(await claim(user.id, farPast, 2)).toMatch(/^[0-9a-f-]{36}$/);
    expect(await claim(user.id, farPast, 2)).toBeNull();
    expect(await usageCount(user.id)).toBe(2);
  });

  it("counts only usage since p_since (a new day starts fresh)", async () => {
    const user = await createTestUser("ai-day");
    await claim(user.id, farPast, 1);
    expect(await claim(user.id, farPast, 1)).toBeNull();
    expect(await claim(user.id, farFuture, 1)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("never exceeds the limit under concurrent claims", async () => {
    const user = await createTestUser("ai-race");
    const results = await Promise.all(Array.from({ length: 6 }, () => claim(user.id, farPast, 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await usageCount(user.id)).toBe(3);
  });

  it("returns null for an unknown user", async () => {
    expect(await claim(crypto.randomUUID())).toBeNull();
  });

  it("cannot be called by a signed-in user", async () => {
    const { error } = await a.client.rpc("claim_ai_usage", { p_user_id: a.id, p_since: farPast, p_limit: 100 });
    expect(error).not.toBeNull();
    expect(await usageCount(a.id)).toBe(0);
  });

  it("lets users read only their own usage and never write it", async () => {
    await claim(a.id);
    await claim(b.id);
    const own = await a.client.from("ai_usage").select("user_id");
    expect(own.error).toBeNull();
    expect(own.data?.map((row) => row.user_id)).toEqual([a.id]);

    const insert = await a.client.from("ai_usage").insert({ user_id: a.id });
    expect(insert.error).not.toBeNull();

    const removed = await a.client.from("ai_usage").delete().eq("user_id", a.id).select("id");
    expect(removed.data ?? []).toHaveLength(0);
    expect(await usageCount(a.id)).toBe(1);
  });

  it("keeps usage when the store is deleted", async () => {
    const user = await createTestUser("ai-delete");
    const storeId = await createStore(user, "Toko AI");
    await claim(user.id);
    const { error } = await user.client.from("stores").delete().eq("id", storeId);
    expect(error).toBeNull();
    expect(await usageCount(user.id)).toBe(1);
  });
});

describe("ai_analyses", () => {
  it("is readable by the store owner only and never writable by users", async () => {
    const owner = await createTestUser("ai-owner");
    const other = await createTestUser("ai-other");
    const storeId = await createStore(owner, "Toko Analisis");
    const row = {
      store_id: storeId,
      user_id: owner.id,
      model: "test-model",
      snapshot_hash: "hash",
      input_snapshot: {},
      output: { summary: "ok" },
    };

    const userInsert = await owner.client.from("ai_analyses").insert(row);
    expect(userInsert.error).not.toBeNull();

    const { error } = await admin.from("ai_analyses").insert(row);
    expect(error).toBeNull();

    const mine = await owner.client.from("ai_analyses").select("snapshot_hash").eq("store_id", storeId);
    expect(mine.data).toEqual([{ snapshot_hash: "hash" }]);
    const theirs = await other.client.from("ai_analyses").select("id").eq("store_id", storeId);
    expect(theirs.data ?? []).toHaveLength(0);

    const removed = await owner.client.from("ai_analyses").delete().eq("store_id", storeId).select("id");
    expect(removed.data ?? []).toHaveLength(0);
  });
});
