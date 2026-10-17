import { describe, expect, it } from "vitest";
import { MAX_ITEMS, refsFromStoreData, sanitizeOutput, simulationHref, type KnownRefs } from "@/lib/ai/output";
import { systemInstruction, userPrompt } from "@/lib/ai/prompt";
import type { AnalysisSnapshot } from "@/lib/ai/snapshot";
import { parseOverrides } from "@/lib/simulation/query";
import type { StoreData } from "@/lib/calc";

const P = "00000000-0000-4000-8000-00000000000a";
const P_OFF = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";
const C2 = "00000000-0000-4000-8000-00000000000e";
const M = "00000000-0000-4000-8000-00000000000d";
const UNKNOWN = "00000000-0000-4000-8000-0000000000ff";

const refs: KnownRefs = {
  productIds: new Set([P]),
  materialIds: new Set([M]),
  priceLines: new Set([`${P}:${C}`]),
};

function output(extra: Record<string, unknown> = {}) {
  return {
    summary: "Usahamu untung Rp1.820.000 per bulan.",
    highlights: ["Es teh untung di semua kanal."],
    issues: [{ title: "Belum ada gaji pemilik", explanation: "Catat gajimu.", related_product_ids: [P], priority: "tinggi" }],
    recommendations: [
      { action: "Naikkan harga Es teh", reason: "Margin masih bisa naik.", simulation: { type: "change_price", product_id: P, channel_id: C, new_price: 6000 } },
    ],
    ...extra,
  };
}

describe("sanitizeOutput", () => {
  it("keeps a valid answer as it is", () => {
    expect(sanitizeOutput(output(), refs)).toEqual(output());
  });

  it("rejects broken answers", () => {
    expect(sanitizeOutput(null, refs)).toBeNull();
    expect(sanitizeOutput("text", refs)).toBeNull();
    expect(sanitizeOutput({ summary: "x" }, refs)).toBeNull();
    expect(sanitizeOutput(output({ summary: "" }), refs)).toBeNull();
    expect(sanitizeOutput(output({ summary: "x".repeat(2001) }), refs)).toBeNull();
    expect(sanitizeOutput(output({ issues: [{ title: "t", explanation: "e", related_product_ids: [], priority: "urgent" }] }), refs)).toBeNull();
  });

  it("drops unknown fields and trims text", () => {
    const result = sanitizeOutput(output({ summary: "  Halo  ", extra: 1 }), refs);
    expect(result?.summary).toBe("Halo");
    expect(result).not.toHaveProperty("extra");
  });

  it("keeps at most MAX_ITEMS of each list", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Bagus ${i}`);
    expect(sanitizeOutput(output({ highlights: many }), refs)?.highlights).toHaveLength(MAX_ITEMS);
  });

  it("keeps only known, distinct product ids", () => {
    const issues = [{ title: "t", explanation: "e", related_product_ids: [P, UNKNOWN, P, P_OFF], priority: "sedang" }];
    expect(sanitizeOutput(output({ issues }), refs)?.issues[0].related_product_ids).toEqual([P]);
  });

  it.each([
    ["unknown product", { type: "change_price", product_id: UNKNOWN, channel_id: C, new_price: 6000 }],
    ["a channel without a saved price", { type: "change_price", product_id: P, channel_id: C2, new_price: 6000 }],
    ["a fractional price", { type: "change_price", product_id: P, channel_id: C, new_price: 6000.5 }],
    ["a negative price", { type: "change_price", product_id: P, channel_id: C, new_price: -1 }],
    ["a huge price", { type: "change_price", product_id: P, channel_id: C, new_price: 3_000_000_000 }],
    ["unknown material", { type: "change_material_price", material_id: UNKNOWN, pct: 10 }],
    ["a material change below -100%", { type: "change_material_price", material_id: M, pct: -150 }],
    ["a sales multiplier above 4", { type: "change_sales_volume", multiplier: 5 }],
    ["a negative sales multiplier", { type: "change_sales_volume", multiplier: -1 }],
    ["an unknown type", { type: "change_rent", pct: 10 }],
  ])("drops the simulation for %s but keeps the advice", (_label, simulation) => {
    const result = sanitizeOutput(output({ recommendations: [{ action: "Coba", reason: "Karena", simulation }] }), refs);
    expect(result?.recommendations).toEqual([{ action: "Coba", reason: "Karena" }]);
  });

  it("accepts a null simulation", () => {
    const result = sanitizeOutput(output({ recommendations: [{ action: "Coba", reason: "Karena", simulation: null }] }), refs);
    expect(result?.recommendations).toEqual([{ action: "Coba", reason: "Karena" }]);
  });
});

describe("refsFromStoreData", () => {
  it("knows active products, materials and saved price lines", () => {
    const data = {
      store: { id: "s", name: "T", targetMarginPct: 40, operatingDaysPerMonth: 26 },
      materials: [{ id: M, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 1, wastePct: 0 }],
      products: [
        { id: P, name: "Es teh", category: null, yieldQty: 1, targetMarginPct: null, isActive: true },
        { id: P_OFF, name: "Lama", category: null, yieldQty: 1, targetMarginPct: null, isActive: false },
      ],
      composition: [],
      channels: [{ id: C, name: "Tunai", commissionPct: 0, fixedFee: 0 }],
      prices: [
        { productId: P, channelId: C, price: 5000, estMonthlySales: 1, competitorPrice: null },
        { productId: P_OFF, channelId: C, price: 5000, estMonthlySales: 1, competitorPrice: null },
        { productId: P, channelId: C2, price: 5000, estMonthlySales: 1, competitorPrice: null },
      ],
      expenses: [],
      assets: [],
    } satisfies StoreData;
    const known = refsFromStoreData(data);
    expect([...known.productIds]).toEqual([P]);
    expect([...known.materialIds]).toEqual([M]);
    expect([...known.priceLines]).toEqual([`${P}:${C}`]);
  });
});

describe("simulationHref", () => {
  const query = (href: string) => Object.fromEntries(new URL(href, "https://x.test").searchParams);

  it("maps each simulation to the simulation page URL", () => {
    expect(simulationHref("s1", { type: "change_price", product_id: P, channel_id: C, new_price: 6000 })).toBe(
      `/s/s1/simulasi?p.${P}.${C}=6000`,
    );
    expect(simulationHref("s1", { type: "change_material_price", material_id: M, pct: -10 })).toBe(`/s/s1/simulasi?m.${M}=-10`);
    expect(simulationHref("s1", { type: "change_sales_volume", multiplier: 1.2 })).toBe("/s/s1/simulasi?s=20");
  });

  it("produces links the simulation page reads back", () => {
    const href = simulationHref("s1", { type: "change_sales_volume", multiplier: 0.75 });
    expect(parseOverrides(query(href))).toEqual({ salesMultiplier: 0.75 });
  });
});

describe("prompt", () => {
  it("asks for the user's language", () => {
    expect(systemInstruction("id")).toContain("Bahasa Indonesia");
    expect(systemInstruction("en")).toContain("English");
  });

  it("states the spec §6.3 rules", () => {
    const text = systemInstruction("id");
    for (const rule of ["Only quote numbers", "NO_OWNER_SALARY", "LOSS_PRODUCTS", "competitorPrice", "targetMarket"]) {
      expect(text).toContain(rule);
    }
  });

  it("sends the snapshot as JSON", () => {
    const snapshot = { locale: "id", store: { name: "Toko" } } as unknown as AnalysisSnapshot;
    expect(userPrompt(snapshot)).toContain('"name":"Toko"');
  });
});
