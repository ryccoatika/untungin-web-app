import { describe, expect, it } from "vitest";
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

  it("has a validation message for every key the store schema can return", async () => {
    const { STORE_VALIDATION_KEYS } = await import("@/lib/validation/store");
    for (const key of STORE_VALIDATION_KEYS) {
      const [group, name] = key.split(".");
      expect((id.Validation as Record<string, Record<string, string>>)[group]?.[name], key).toBeTruthy();
      expect((en.Validation as Record<string, Record<string, string>>)[group]?.[name], key).toBeTruthy();
    }
  });
});
