import { describe, expect, it } from "vitest";
import { translateFieldErrors } from "@/lib/i18n/translate";

describe("translateFieldErrors", () => {
  const t = (key: string) => ({ "store.nameRequired": "Store name is required" })[key] ?? key;

  it("translates every message key and keeps fields without errors", () => {
    expect(
      translateFieldErrors({ name: ["store.nameRequired"], businessType: undefined }, t),
    ).toEqual({ name: ["Store name is required"], businessType: undefined });
  });

  it("falls back to the key for unknown messages", () => {
    expect(translateFieldErrors({ name: ["store.unknown"] }, t)).toEqual({ name: ["store.unknown"] });
  });
});
