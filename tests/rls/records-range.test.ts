import { beforeAll, describe, expect, it } from "vitest";
import { fetchSalesRange } from "@/lib/data/sales-range";
import { admin, createStore, createTestUser, type TestUser } from "./helpers";

const jakartaDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

describe("fetchSalesRange reads past the API row cap", () => {
  const DAYS = 31;
  const PRODUCTS = 6;
  const CHANNELS = 6;
  let owner: TestUser;
  let storeId: string;

  beforeAll(async () => {
    owner = await createTestUser("records-range");
    storeId = await createStore(owner, "Toko Rentang");
    const products = await admin
      .from("products")
      .insert(Array.from({ length: PRODUCTS }, (_, i) => ({ store_id: storeId, name: `Produk ${i}` })))
      .select("id");
    const channels = await admin
      .from("sales_channels")
      .insert(Array.from({ length: CHANNELS }, (_, i) => ({ store_id: storeId, name: `Kanal ${i}`, sort_order: i + 10 })))
      .select("id");
    if (products.error || channels.error) throw products.error ?? channels.error;
    const days = await admin
      .from("sales_days")
      .insert(Array.from({ length: DAYS }, (_, i) => ({ store_id: storeId, date: jakartaDate(-i) })))
      .select("id");
    if (days.error) throw days.error;

    const rows = days.data.flatMap((day) =>
      products.data.flatMap((p) =>
        channels.data.map((c) => ({
          store_id: storeId,
          day_id: day.id,
          product_id: p.id,
          channel_id: c.id,
          product_name: "P",
          channel_name: "C",
          qty: 1,
          unit_price: 1000,
          net_unit: 1000,
          hpp_unit: 500,
        })),
      ),
    );
    expect(rows.length).toBeGreaterThan(1000);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("sales_lines").insert(rows.slice(i, i + 500));
      if (error) throw error;
    }
  }, 60_000);

  it("returns every line of a month with more than 1000 lines", async () => {
    const { days, lines } = await fetchSalesRange(owner.client, storeId, jakartaDate(-(DAYS - 1)), jakartaDate());
    expect(days).toHaveLength(DAYS);
    expect(lines).toHaveLength(DAYS * PRODUCTS * CHANNELS);
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
  });

  it("a plain single request is cut at 1000 rows (why paging is needed)", async () => {
    const { data } = await owner.client.from("sales_lines").select("id").eq("store_id", storeId);
    expect(data).toHaveLength(1000);
  });

  it("works with a small page size", async () => {
    const { lines } = await fetchSalesRange(owner.client, storeId, jakartaDate(-2), jakartaDate(), 7);
    expect(lines).toHaveLength(3 * PRODUCTS * CHANNELS);
  });
});
