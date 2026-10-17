import { beforeAll, describe, expect, it } from "vitest";
import { admin, createStore, createTestUser, type TestUser } from "./helpers";

// SQLSTATE raised by the stores_enforce_limit trigger (see 20261016000003_store_limit.sql).
const STORE_LIMIT = "UT001";

describe("store limit enforced by the database", () => {
  let free: TestUser;
  let pro: TestUser;

  beforeAll(async () => {
    free = await createTestUser("limit-free");
    pro = await createTestUser("limit-pro");
    await admin.from("profiles").update({ plan: "pro" }).eq("id", pro.id);
    await createStore(free, "Satu");
    await createStore(free, "Dua");
  });

  it("rejects a 3rd store for a free user via create_store", async () => {
    await expect(createStore(free, "Tiga")).rejects.toMatchObject({ code: STORE_LIMIT });
  });

  it("rejects a 3rd store for a free user via direct insert", async () => {
    const { error } = await free.client
      .from("stores")
      .insert({ owner_id: free.id, name: "Tiga", business_type: "minuman" });
    expect(error?.code).toBe(STORE_LIMIT);
  });

  it("lets a pro user create more than 2 stores", async () => {
    await createStore(pro, "Satu");
    await createStore(pro, "Dua");
    await expect(createStore(pro, "Tiga")).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("treats names that differ only by surrounding spaces as duplicates", async () => {
    const user = await createTestUser("limit-trim");
    await createStore(user, "Kopi");
    const { error } = await user.client
      .from("stores")
      .insert({ owner_id: user.id, name: "Kopi ", business_type: "minuman" });
    expect(error?.code).toBe("23505");
  });
});
