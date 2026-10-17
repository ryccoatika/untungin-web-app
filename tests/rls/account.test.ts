import { describe, expect, it } from "vitest";
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
});
