import { describe, expect, it } from "vitest";
import { MAX_ITEMS, refsFromSnapshot, refsFromStoreData, sanitizeOutput, simulationHref, type KnownRefs } from "@/lib/ai/output";
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
    const issuesList = Array.from({ length: 12 }, (_, i) => ({ title: `i${i}`, explanation: `e${i}`, related_product_ids: [], priority: "sedang" as const }));
    expect(sanitizeOutput(output({ issues: issuesList }), refs)?.issues).toHaveLength(MAX_ITEMS);
    const recsList = Array.from({ length: 12 }, (_, i) => ({ action: `a${i}`, reason: `r${i}` }));
    expect(sanitizeOutput(output({ recommendations: recsList }), refs)?.recommendations).toHaveLength(MAX_ITEMS);
  });

  it("slices invalid items out instead of rejecting the whole answer", () => {
    // 8 valid highlights + empty 9th → result has 8 highlights, not null
    const highlights = Array.from({ length: 8 }, (_, i) => `Valid ${i}`);
    highlights.push("");
    const result = sanitizeOutput(output({ highlights }), refs);
    expect(result?.highlights).toHaveLength(8);

    // Invalid priority at index 10 of issues → not null
    const issues: unknown[] = Array.from({ length: 10 }, (_, i) => ({ title: `t${i}`, explanation: `e${i}`, related_product_ids: [], priority: "sedang" as const }));
    issues.push({ title: "t10", explanation: "e10", related_product_ids: [], priority: "invalid" });
    const result2 = sanitizeOutput(output({ issues }), refs);
    expect(result2?.issues).toHaveLength(MAX_ITEMS);

    // Invalid priority at index 0 → still null
    const badIssues = [{ title: "t", explanation: "e", related_product_ids: [], priority: "invalid" } as unknown];
    const result3 = sanitizeOutput(output({ issues: badIssues }), refs);
    expect(result3).toBeNull();
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

  it("rounds material price pct to avoid scientific notation", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const simulation: any = { type: "change_material_price", material_id: M, pct: 1e-7 };
    const href = simulationHref("s1", simulation);
    expect(href).not.toContain("e-");
    expect(parseOverrides(Object.fromEntries(new URL(href, "https://x.test").searchParams))).toBeDefined();
  });

  it("drops change_sales_volume when multiplier rounds to 1", () => {
    const result = sanitizeOutput(output({ recommendations: [{ action: "Coba", reason: "Karena", simulation: { type: "change_sales_volume", multiplier: 1 } }] }), refs);
    expect(result?.recommendations).toEqual([{ action: "Coba", reason: "Karena" }]);
  });

  it("never throws on hostile inputs", () => {
    // 10,000 highlights
    expect(() => sanitizeOutput(output({ highlights: Array.from({ length: 10000 }, (_, i) => `h${i}`) }), refs)).not.toThrow();

    // Prototype pollution attempt
    const proto = JSON.parse('{"__proto__":{"x":1},"summary":"s","highlights":[],"issues":[],"recommendations":[]}');
    expect(() => sanitizeOutput(proto, refs)).not.toThrow();

    // new_price as a string
    expect(() => sanitizeOutput(output({ recommendations: [{ action: "a", reason: "r", simulation: { type: "change_price", product_id: P, channel_id: C, new_price: "6000" } }] }), refs)).not.toThrow();

    // Deeply nested object as simulation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nested: any = { type: "change_price", product_id: P, channel_id: C, new_price: 6000 };
    nested.deep = { very: { nested: { object: "here" } } };
    expect(() => sanitizeOutput(output({ recommendations: [{ action: "a", reason: "r", simulation: nested }] }), refs)).not.toThrow();
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

describe("refsFromSnapshot", () => {
  it("extracts productIds, materialIds and priceLines from a snapshot", () => {
    const snapshot: AnalysisSnapshot = {
      locale: "id",
      store: { name: "T", businessType: "food", targetMarket: null, targetMarginPct: 40, operatingDaysPerMonth: 26 },
      channels: [{ id: C, name: "Tunai", commissionPct: 0, fixedFee: 0 }],
      materials: [{ id: M, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 1, wastePct: 0 }],
      products: [
        {
          id: P,
          name: "Es teh",
          lines: [
            {
              channelId: C,
              price: 5000,
              competitorPrice: null,
              estMonthlySales: 1,
              materialCost: 1000,
              fullCost: 1000,
              netPrice: 5000,
              contribution: 4000,
              marginPct: 80,
              targetMarginPct: 40,
              status: "green",
            },
          ],
        },
      ],
      totals: {
        grossRevenue: 5000,
        netRevenue: 5000,
        materialCosts: 1000,
        netProfit: 4000,
        netMarginPct: 80,
        totalUnits: 1,
        fixedCosts: { byCategory: {}, depreciation: 0, total: 0 },
        bepUnitsMonthly: 1,
        bepUnitsDaily: 0.1,
        totalCapital: 0,
        paybackMonths: null,
      },
      warnings: [],
    };
    const known = refsFromSnapshot(snapshot);
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

  it("spells out the units of each money field", () => {
    const text = systemInstruction("id");
    expect(text).toContain("per unit sold");
    expect(text).toContain("per month");
    expect(text).not.toContain("per month unless a field says otherwise");
  });

  it("asks for Rupiah formatting and explains every unit", () => {
    const id = systemInstruction("id");
    expect(id).toContain("Rp80.000");
    expect(systemInstruction("en")).toContain("Rp80,000");
    for (const field of ["totalCapital", "fixedFee", "totalUnits"]) expect(id).toContain(field);
    expect(id).toMatch(/totalCapital[^.]*one-off/);
  });

  it("sends the snapshot as JSON", () => {
    const snapshot = { locale: "id", store: { name: "Toko" } } as unknown as AnalysisSnapshot;
    expect(userPrompt(snapshot)).toContain('"name":"Toko"');
  });
});
