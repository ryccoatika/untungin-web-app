import { describe, expect, it } from "vitest";
import { isNavActive, storeNavItems } from "@/lib/nav";

describe("storeNavItems", () => {
  it("builds store-scoped links with label keys", () => {
    expect(storeNavItems("abc").map((i) => [i.labelKey, i.href])).toEqual([
      ["dashboard", "/s/abc/dashboard"],
      ["settings", "/s/abc/pengaturan"],
    ]);
  });
});

describe("isNavActive", () => {
  it.each([
    ["/s/abc/dashboard", "/s/abc/dashboard", true],
    ["/s/abc/produk/123", "/s/abc/produk", true],
    ["/s/abc/produkbaru", "/s/abc/produk", false],
    ["/s/abc/pengaturan", "/s/abc/dashboard", false],
  ])("%s with %s → %s", (pathname, href, expected) => {
    expect(isNavActive(pathname, href)).toBe(expected);
  });
});
