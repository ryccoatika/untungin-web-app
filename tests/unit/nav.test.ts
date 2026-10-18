import { describe, expect, it } from "vitest";
import { bottomNavItems, isMoreActive, isNavActive, moreNavItems, storeNavItems } from "@/lib/nav";

const pairs = (items: { labelKey: string; href: string }[]) => items.map((i) => [i.labelKey, i.href]);

describe("store navigation", () => {
  it("lists every page in the sidebar", () => {
    expect(pairs(storeNavItems("abc"))).toEqual([
      ["dashboard", "/s/abc/dashboard"],
      ["products", "/s/abc/produk"],
      ["materials", "/s/abc/bahan"],
      ["channels", "/s/abc/kanal"],
      ["expenses", "/s/abc/biaya"],
      ["assets", "/s/abc/inventaris"],
      ["simulation", "/s/abc/simulasi"],
      ["analysis", "/s/abc/analisis"],
      ["report", "/s/abc/ringkasan"],
      ["settings", "/s/abc/pengaturan"],
    ]);
  });

  it("puts four items in the phone bar, the rest behind Lainnya", () => {
    expect(pairs(bottomNavItems("abc"))).toEqual([
      ["dashboard", "/s/abc/dashboard"],
      ["products", "/s/abc/produk"],
      ["materials", "/s/abc/bahan"],
      ["more", "/s/abc/lainnya"],
    ]);
    expect(pairs(moreNavItems("abc"))).toEqual([
      ["channels", "/s/abc/kanal"],
      ["expenses", "/s/abc/biaya"],
      ["assets", "/s/abc/inventaris"],
      ["simulation", "/s/abc/simulasi"],
      ["analysis", "/s/abc/analisis"],
      ["report", "/s/abc/ringkasan"],
      ["settings", "/s/abc/pengaturan"],
    ]);
  });

  it.each([
    ["/s/abc/lainnya", true],
    ["/s/abc/kanal/123", true],
    ["/s/abc/biaya", true],
    ["/s/abc/inventaris/123", true],
    ["/s/abc/simulasi", true],
    ["/s/abc/analisis", true],
    ["/s/abc/ringkasan", true],
    ["/s/abc/pengaturan", true],
    ["/s/abc/produk", false],
  ])("Lainnya is active on %s → %s", (pathname, expected) => {
    expect(isMoreActive(pathname, "abc")).toBe(expected);
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
