import { describe, expect, it } from "vitest";
import { WARNING_CODES } from "@/lib/calc";
import en from "@/messages/en.json";
import id from "@/messages/id.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("message catalogs", () => {
  it("id and en have exactly the same keys", () => {
    expect(keys(en).sort()).toEqual(keys(id).sort());
  });

  it("has no empty strings", () => {
    for (const catalog of [id, en]) {
      const flat = keys(catalog);
      expect(flat.length).toBeGreaterThan(0);
      for (const key of flat) {
        const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalog);
        expect(typeof value === "string" && value.trim() !== "", key).toBe(true);
      }
    }
  });
});

describe("app-generated data names", () => {
  it("names the default channel per locale", () => {
    expect(id.Store.defaultChannelName).toBe("Offline – Tunai");
    expect(en.Store.defaultChannelName).toBe("Offline – Cash");
  });

  it("has a validation message for every key the schemas can return", async () => {
    const lists = await Promise.all([
      import("@/lib/validation/store").then((m) => m.STORE_VALIDATION_KEYS),
      import("@/lib/validation/common").then((m) => m.COMMON_VALIDATION_KEYS),
      import("@/lib/validation/material").then((m) => m.MATERIAL_VALIDATION_KEYS),
      import("@/lib/validation/product").then((m) => m.PRODUCT_VALIDATION_KEYS),
      import("@/lib/validation/composition").then((m) => m.COMPOSITION_VALIDATION_KEYS),
      import("@/lib/validation/price").then((m) => m.PRICE_VALIDATION_KEYS),
      import("@/lib/validation/channel").then((m) => m.CHANNEL_VALIDATION_KEYS),
      import("@/lib/validation/expense").then((m) => m.EXPENSE_VALIDATION_KEYS),
      import("@/lib/validation/asset").then((m) => m.ASSET_VALIDATION_KEYS),
      import("@/lib/validation/purchase").then((m) => m.PURCHASE_VALIDATION_KEYS),
    ]);
    for (const key of lists.flat()) {
      const [group, name] = key.split(".");
      expect((id.Validation as Record<string, Record<string, string>>)[group]?.[name], key).toBeTruthy();
      expect((en.Validation as Record<string, Record<string, string>>)[group]?.[name], key).toBeTruthy();
    }
  });

  it("has a message for every warning code (sentence, or an intro for the listed ones)", () => {
    for (const [name, catalog] of [["id", id], ["en", en]] as const) {
      const warnings = catalog.Warnings as Record<string, string>;
      for (const code of WARNING_CODES) {
        expect(code in warnings || `${code}_intro` in warnings, `${name}: ${code}`).toBe(true);
      }
    }
  });
});
