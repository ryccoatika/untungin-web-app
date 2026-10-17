import { describe, expect, it, vi } from "vitest";
import { analyzeStore } from "@/lib/calc";
import { buildDemoStore, demoAsStoreData, seedDemoStore } from "@/lib/seed/demo-store";

describe("buildDemoStore", () => {
  it("is a profitable coffee shop with every part the spec lists", () => {
    const demo = buildDemoStore("id");
    const data = demoAsStoreData(demo);
    const analysis = analyzeStore(data);

    expect(demo.store.name).toBe("Kedai Kopi Contoh");
    expect(data.materials.some((m) => m.category === "kemasan")).toBe(true);
    expect(data.channels.map((c) => c.name)).toEqual(["Offline – Tunai", "GoFood"]);
    // Online-only packaging: some composition row is tied to the GoFood channel.
    expect(data.composition.some((row) => row.channelId === data.channels[1].id)).toBe(true);
    expect(data.expenses.some((e) => e.category === "gaji_pemilik")).toBe(true);
    expect(data.assets.length).toBeGreaterThan(0);
    expect(data.prices.some((p) => p.competitorPrice !== null)).toBe(true);

    expect(analysis.netProfit).toBeGreaterThan(0);
    expect(analysis.lines.length).toBe(data.products.length * 2);
    const codes = analysis.warnings.map((w) => w.code);
    expect(codes).not.toContain("NO_OWNER_SALARY");
    expect(codes).not.toContain("NET_LOSS");
    // Something to learn from: at least one line is below target or far from the competitor.
    expect(codes.some((code) => code === "BELOW_TARGET" || code === "COMPETITOR_GAP")).toBe(true);
  });

  it("names everything in the chosen language with the same numbers", () => {
    const id = buildDemoStore("id");
    const en = buildDemoStore("en");
    expect(en.store.name).toBe("Sample Coffee Shop");
    expect(en.channels[0].name).toBe("Offline – Cash");
    expect(en.materials.map((m) => m.name)).not.toEqual(id.materials.map((m) => m.name));
    const numbers = (demo: typeof id) => demo.materials.map((m) => [m.purchaseQty, m.purchaseUnit, m.purchasePrice]);
    expect(numbers(en)).toEqual(numbers(id));
    expect(analyzeStore(demoAsStoreData(en)).netProfit).toBe(analyzeStore(demoAsStoreData(id)).netProfit);
  });

  it("refers only to keys it defines", () => {
    const demo = buildDemoStore("id");
    const materials = new Set(demo.materials.map((m) => m.key));
    const products = new Set(demo.products.map((p) => p.key));
    const channels = new Set(demo.channels.map((c) => c.key));
    for (const row of demo.composition) {
      expect(materials.has(row.material)).toBe(true);
      expect(products.has(row.product)).toBe(true);
      if (row.channel) expect(channels.has(row.channel)).toBe(true);
    }
    for (const price of demo.prices) {
      expect(products.has(price.product)).toBe(true);
      expect(channels.has(price.channel)).toBe(true);
    }
  });

  it("has unique material and product names in every language (the seeder maps rows by name)", () => {
    for (const locale of ["id", "en"] as const) {
      const demo = buildDemoStore(locale);
      expect(new Set(demo.materials.map((m) => m.name)).size).toBe(demo.materials.length);
      expect(new Set(demo.products.map((p) => p.name)).size).toBe(demo.products.length);
    }
  });
});

describe("seedDemoStore cleanup", () => {
  it("still returns failed when the cleanup delete throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = {
      rpc: async () => ({ data: "store-1", error: null }),
      from: (table: string) => {
        if (table === "stores") return { delete: () => ({ eq: async () => { throw new Error("network down"); } }) };
        return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: "boom" } }) }) }) };
      },
    };
    const demo = buildDemoStore("id");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(seedDemoStore(fake as any, demo, demo.store.name)).resolves.toEqual({ error: "failed" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
