import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, createTestUser, type TestUser } from "./helpers";

describe("consents", () => {
  let owner: TestUser;
  let other: TestUser;

  const row = (userId: string, over: Record<string, unknown> = {}) => ({
    user_id: userId,
    kind: "terms",
    version: "2026-10-18",
    ...over,
  });

  const adminRows = async (userId: string) => {
    const { data, error } = await admin.from("consents").select("*").eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  };

  beforeAll(async () => {
    owner = await createTestUser("consent-owner");
    other = await createTestUser("consent-other");
  });

  it("owner inserts a row and reads it back with a database-set accepted_at", async () => {
    const { error } = await owner.client.from("consents").insert(row(owner.id));
    expect(error).toBeNull();
    const { data } = await owner.client.from("consents").select("*").eq("user_id", owner.id);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ kind: "terms", version: "2026-10-18" });
    expect(Math.abs(Date.now() - new Date(data![0].accepted_at).getTime())).toBeLessThan(60_000);
  });

  it("rejects a client-supplied accepted_at (column not granted)", async () => {
    const { error } = await owner.client
      .from("consents")
      .insert(row(owner.id, { kind: "ai", accepted_at: "2020-01-01T00:00:00Z" }));
    expect(error?.code).toBe("42501");
  });

  it("owner cannot insert a row for another user", async () => {
    const { error } = await owner.client.from("consents").insert(row(other.id));
    expect(error).not.toBeNull();
    expect(await adminRows(other.id)).toHaveLength(0);
  });

  it("another user sees none of the owner's rows", async () => {
    const { data, error } = await other.client.from("consents").select("*").eq("user_id", owner.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("owner cannot update or delete their own row", async () => {
    const { error } = await owner.client.from("consents").insert(row(owner.id, { kind: "ai" }));
    expect(error).toBeNull();
    const before = await adminRows(owner.id);
    expect(before.length).toBeGreaterThan(0);
    await owner.client.from("consents").update({ version: "2030-01-01" }).eq("user_id", owner.id);
    await owner.client.from("consents").delete().eq("user_id", owner.id);
    expect(await adminRows(owner.id)).toEqual(before);
  });

  it("rejects an unknown kind and a malformed version", async () => {
    const badKind = await owner.client.from("consents").insert(row(owner.id, { kind: "cookies" }));
    expect(badKind.error?.code).toBe("23514");
    const badVersion = await owner.client.from("consents").insert(row(owner.id, { version: "v2" }));
    expect(badVersion.error?.code).toBe("23514");
  });

  it("anon can neither read nor insert", async () => {
    const anon = anonClient();
    const { data } = await anon.from("consents").select("*");
    expect(data ?? []).toEqual([]);
    const { error } = await anon.from("consents").insert(row(owner.id));
    expect(error?.code).toBe("42501");
  });

  it("deleting the user removes their rows", async () => {
    const temp = await createTestUser("consent-temp");
    const { error } = await temp.client.from("consents").insert(row(temp.id));
    expect(error).toBeNull();
    expect(await adminRows(temp.id)).toHaveLength(1);
    await admin.auth.admin.deleteUser(temp.id);
    expect(await adminRows(temp.id)).toHaveLength(0);
  });
});
