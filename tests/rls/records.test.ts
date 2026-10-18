import { beforeAll, describe, expect, it } from "vitest";
import type { Tables } from "@/lib/supabase/database.types";
import { admin, anonClient, createStore, createTestUser, type TestUser } from "./helpers";

const jakartaDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
};

describe("sales and purchase records", () => {
  let owner: TestUser;
  let other: TestUser;
  let storeId: string;
  let productId: string;
  let product2Id: string;
  let channelId: string;
  let materialId: string;

  const line = (over: Record<string, unknown> = {}) => ({
    product_id: productId,
    channel_id: channelId,
    product_name: "Es Kopi",
    channel_name: "Offline – Tunai",
    qty: 10,
    unit_price: 15000,
    net_unit: 15000,
    hpp_unit: 6200,
    ...over,
  });

  const saveDay = (date: string, lines: unknown[], user = owner, store = storeId) =>
    user.client.rpc("save_sales_day", { p_store_id: store, p_date: date, p_lines: lines });

  const lines = async (date: string) => {
    const { data: day } = await owner.client
      .from("sales_days")
      .select("id, closed")
      .eq("store_id", storeId)
      .eq("date", date)
      .maybeSingle();
    if (!day) return { day: null, rows: [] as Tables<"sales_lines">[] };
    const { data } = await owner.client.from("sales_lines").select("*").eq("day_id", day.id);
    return { day, rows: data ?? [] };
  };

  const savePurchase = (over: Record<string, unknown>) =>
    owner.client.rpc("save_purchase", {
      p_store_id: storeId,
      p_purchase_id: null,
      p_material_id: materialId,
      p_date: jakartaDate(),
      p_qty: 1,
      p_unit: "kg",
      p_total_paid: 17000,
      p_new_price: 17000,
      ...over,
    });

  const price = async () => {
    const { data } = await owner.client
      .from("materials")
      .select("purchase_price")
      .eq("id", materialId)
      .single();
    return data?.purchase_price;
  };

  const newMaterial = async () => {
    const { data, error } = await owner.client
      .from("materials")
      .insert({
        store_id: storeId,
        name: "Kopi",
        category: "bahan",
        purchase_qty: 1,
        purchase_unit: "kg",
        purchase_price: 15000,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  beforeAll(async () => {
    owner = await createTestUser("records");
    other = await createTestUser("records-other");
    storeId = await createStore(owner, "Toko Catatan");
    const { data: channel } = await owner.client
      .from("sales_channels")
      .select("id")
      .eq("store_id", storeId)
      .single();
    channelId = channel!.id;
    const mk = async (name: string) => {
      const { data, error } = await owner.client
        .from("products")
        .insert({ store_id: storeId, name })
        .select("id")
        .single();
      if (error) throw error;
      await owner.client
        .from("product_channel_prices")
        .insert({ store_id: storeId, product_id: data.id, channel_id: channelId, price: 15000 });
      return data.id as string;
    };
    productId = await mk("Es Kopi");
    product2Id = await mk("Es Teh");
    materialId = await newMaterial();
  });

  it("owner saves a day and reads it back", async () => {
    const date = jakartaDate();
    const { error } = await saveDay(date, [line()]);
    expect(error).toBeNull();
    const { day, rows } = await lines(date);
    expect(day?.closed).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      product_id: productId,
      channel_id: channelId,
      product_name: "Es Kopi",
      channel_name: "Offline – Tunai",
      qty: 10,
      unit_price: 15000,
    });
    expect(Number(rows[0].net_unit)).toBe(15000);
    expect(Number(rows[0].hpp_unit)).toBe(6200);
  });

  it("qty 0 removes only that pair; other lines stay", async () => {
    const date = jakartaDate(-1);
    await saveDay(date, [line(), line({ product_id: product2Id, product_name: "Es Teh" })]);
    expect((await lines(date)).rows).toHaveLength(2);
    const { error } = await saveDay(date, [line({ qty: 0 })]);
    expect(error).toBeNull();
    const { rows } = await lines(date);
    expect(rows).toHaveLength(1);
    expect(rows[0].product_id).toBe(product2Id);
  });

  it("snapshot is kept when qty is unchanged", async () => {
    const date = jakartaDate(-2);
    await saveDay(date, [line({ qty: 10, hpp_unit: 6200 })]);
    await saveDay(date, [line({ qty: 10, hpp_unit: 7000 })]);
    expect(Number((await lines(date)).rows[0].hpp_unit)).toBe(6200);
    await saveDay(date, [line({ qty: 11, hpp_unit: 7000 })]);
    const { rows } = await lines(date);
    expect(rows[0].qty).toBe(11);
    expect(Number(rows[0].hpp_unit)).toBe(7000);
  });

  it("removing the last line deletes the day", async () => {
    const date = jakartaDate(-3);
    await saveDay(date, [line()]);
    await saveDay(date, [line({ qty: 0 })]);
    expect((await lines(date)).day).toBeNull();
  });

  it("close_sales_day clears lines and marks closed", async () => {
    const date = jakartaDate(-4);
    await saveDay(date, [line()]);
    const { error } = await owner.client.rpc("close_sales_day", { p_store_id: storeId, p_date: date });
    expect(error).toBeNull();
    let res = await lines(date);
    expect(res.day?.closed).toBe(true);
    expect(res.rows).toHaveLength(0);
    await saveDay(date, [line()]);
    res = await lines(date);
    expect(res.day?.closed).toBe(false);
    expect(res.rows).toHaveLength(1);
  });

  it("delete_sales_line removes the day when empty and not closed", async () => {
    const date = jakartaDate(-5);
    await saveDay(date, [line()]);
    const { rows } = await lines(date);
    const { error } = await owner.client.rpc("delete_sales_line", { p_line_id: rows[0].id });
    expect(error).toBeNull();
    expect((await lines(date)).day).toBeNull();
  });

  it("deleting a product keeps its line with product_id null and the name snapshot", async () => {
    const date = jakartaDate(-6);
    const { data: p } = await owner.client
      .from("products")
      .insert({ store_id: storeId, name: "Sementara" })
      .select("id")
      .single();
    await saveDay(date, [line({ product_id: p!.id, product_name: "Sementara" })]);
    const { error } = await owner.client.from("products").delete().eq("id", p!.id);
    expect(error).toBeNull();
    const { rows } = await lines(date);
    expect(rows).toHaveLength(1);
    expect(rows[0].product_id).toBeNull();
    expect(rows[0].product_name).toBe("Sementara");
    expect(rows[0].channel_id).toBe(channelId);
  });

  it("future date and date older than 92 days are refused", async () => {
    for (const date of [jakartaDate(1), jakartaDate(-93)]) {
      const { error } = await saveDay(date, [line()]);
      expect(error?.code).toBe("UT002");
      const close = await owner.client.rpc("close_sales_day", { p_store_id: storeId, p_date: date });
      expect(close.error?.code).toBe("UT002");
      const buy = await savePurchase({ p_date: date });
      expect(buy.error?.code).toBe("UT002");
    }
    const { error } = await saveDay(jakartaDate(-92), [line()]);
    expect(error).toBeNull();
  });

  it("another user can neither read nor write", async () => {
    const date = jakartaDate();
    const { data } = await other.client.from("sales_days").select("id").eq("store_id", storeId);
    expect(data).toHaveLength(0);
    const { data: l } = await other.client.from("sales_lines").select("id").eq("store_id", storeId);
    expect(l).toHaveLength(0);
    const { error } = await saveDay(date, [line({ qty: 99 })], other);
    expect(error?.code).toBe("42501");
    const buy = await other.client.rpc("save_purchase", {
      p_store_id: storeId,
      p_purchase_id: null,
      p_material_id: materialId,
      p_date: date,
      p_qty: 1,
      p_unit: "kg",
      p_total_paid: 1,
      p_new_price: 1,
    });
    expect(buy.error?.code).toBe("P0002");
    expect((await lines(date)).rows[0].qty).toBe(10);

    const anon = anonClient();
    for (const table of ["sales_days", "sales_lines", "purchases"] as const) {
      const res = await anon.from(table).select("id");
      expect(res.error).not.toBeNull();
    }
  });

  describe("delete_sales_day", () => {
    const del = (date: string, user = owner, store = storeId) =>
      user.client.rpc("delete_sales_day", { p_store_id: store, p_date: date });

    it("deletes a day with its lines", async () => {
      const date = jakartaDate(-20);
      await saveDay(date, [line()]);
      expect((await lines(date)).rows).toHaveLength(1);
      const { error } = await del(date);
      expect(error).toBeNull();
      expect(await lines(date)).toEqual({ day: null, rows: [] });
    });

    it("deletes a closed day", async () => {
      const date = jakartaDate(-21);
      await owner.client.rpc("close_sales_day", { p_store_id: storeId, p_date: date });
      expect((await lines(date)).day?.closed).toBe(true);
      const { error } = await del(date);
      expect(error).toBeNull();
      expect((await lines(date)).day).toBeNull();
    });

    it("another user's call changes nothing", async () => {
      const date = jakartaDate(-22);
      await saveDay(date, [line()]);
      const { error } = await del(date, other);
      expect(error).toBeNull();
      expect((await lines(date)).rows).toHaveLength(1);
    });

    it("refuses a future date and one older than 92 days (UT002)", async () => {
      expect((await del(jakartaDate(1))).error?.code).toBe("UT002");
      expect((await del(jakartaDate(-93))).error?.code).toBe("UT002");
    });

    it("is not callable by anon", async () => {
      const { error } = await anonClient().rpc("delete_sales_day", { p_store_id: storeId, p_date: jakartaDate() });
      expect(error).not.toBeNull();
    });
  });

  it("purchase updates the material price", async () => {
    const { data, error } = await savePurchase({ p_new_price: 17000 });
    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await price()).toBe(17000);
  });

  it("back-dated purchase does not change the price", async () => {
    const { data, error } = await savePurchase({ p_date: jakartaDate(-1), p_new_price: 12000 });
    expect(error).toBeNull();
    expect(data).toBe(false);
    expect(await price()).toBe(17000);
  });

  it("editing the latest purchase re-applies the price", async () => {
    const { data: latest } = await owner.client
      .from("purchases")
      .select("id")
      .eq("material_id", materialId)
      .eq("date", jakartaDate())
      .single();
    const { data, error } = await savePurchase({ p_purchase_id: latest!.id, p_new_price: 16000 });
    expect(error).toBeNull();
    expect(data).toBe(true);
    expect(await price()).toBe(16000);
  });

  it("same date: the one saved last wins", async () => {
    materialId = await newMaterial();
    const first = await savePurchase({ p_new_price: 20000 });
    expect(first.data).toBe(true);
    const second = await savePurchase({ p_new_price: 21000 });
    expect(second.data).toBe(true);
    expect(await price()).toBe(21000);
    const { data: rows } = await owner.client
      .from("purchases")
      .select("id, material_name")
      .eq("material_id", materialId)
      .order("saved_at");
    expect(rows![0].material_name).toBe("Kopi");
    // Re-saving the older one makes it the latest again.
    const again = await savePurchase({ p_purchase_id: rows![0].id, p_new_price: 19000 });
    expect(again.data).toBe(true);
    expect(await price()).toBe(19000);
  });

  describe("ids from another store", () => {
    let foreign: {
      productId: string;
      channelId: string;
      materialId: string;
      lineId: string;
      purchaseId: string;
    };

    beforeAll(async () => {
      const user = await createTestUser("records-foreign");
      const store = await createStore(user, "Toko Lain");
      const one = async (q: PromiseLike<{ data: { id: string } | null; error: unknown }>) => {
        const { data, error } = await q;
        if (error) throw error;
        return data!.id;
      };
      const channel = await one(
        user.client.from("sales_channels").select("id").eq("store_id", store).single(),
      );
      const product = await one(
        user.client.from("products").insert({ store_id: store, name: "Lain" }).select("id").single(),
      );
      const material = await one(
        user.client
          .from("materials")
          .insert({
            store_id: store,
            name: "Gula",
            category: "bahan",
            purchase_qty: 1,
            purchase_unit: "kg",
            purchase_price: 1000,
          })
          .select("id")
          .single(),
      );
      const date = jakartaDate();
      const { error } = await user.client.rpc("save_sales_day", {
        p_store_id: store,
        p_date: date,
        p_lines: [
          {
            product_id: product,
            channel_id: channel,
            product_name: "Lain",
            channel_name: "Offline",
            qty: 3,
            unit_price: 1000,
            net_unit: 1000,
            hpp_unit: 500,
          },
        ],
      });
      if (error) throw error;
      const { data: l } = await user.client.from("sales_lines").select("id").eq("store_id", store).single();
      await user.client.rpc("save_purchase", {
        p_store_id: store,
        p_purchase_id: null,
        p_material_id: material,
        p_date: date,
        p_qty: 1,
        p_unit: "kg",
        p_total_paid: 1000,
        p_new_price: 1000,
      });
      const { data: pu } = await user.client.from("purchases").select("id").eq("store_id", store).single();
      foreign = {
        productId: product,
        channelId: channel,
        materialId: material,
        lineId: l!.id,
        purchaseId: pu!.id,
      };
    });

    it("save_sales_day refuses a product from another store (23503)", async () => {
      const { error } = await saveDay(jakartaDate(-10), [line({ product_id: foreign.productId })]);
      expect(error?.code).toBe("23503");
    });

    it("save_sales_day refuses a channel from another store (23503)", async () => {
      const { error } = await saveDay(jakartaDate(-11), [line({ channel_id: foreign.channelId })]);
      expect(error?.code).toBe("23503");
    });

    it("save_purchase refuses a material from another store (P0002)", async () => {
      const { error } = await savePurchase({ p_material_id: foreign.materialId });
      expect(error?.code).toBe("P0002");
    });

    it("save_purchase refuses a purchase from another store (P0002)", async () => {
      const { error } = await savePurchase({ p_purchase_id: foreign.purchaseId });
      expect(error?.code).toBe("P0002");
    });

    it("delete_sales_line on another store's line is a no-op", async () => {
      const { error } = await owner.client.rpc("delete_sales_line", { p_line_id: foreign.lineId });
      expect(error).toBeNull();
      const { data } = await admin.from("sales_lines").select("id").eq("id", foreign.lineId);
      expect(data).toHaveLength(1);
    });
  });
});
