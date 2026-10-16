import { describe, expect, it } from "vitest";
import { splitLocale, withLocale } from "@/lib/i18n/paths";

describe("splitLocale", () => {
  it.each([
    ["/id", { locale: "id", rest: "/" }],
    ["/id/", { locale: "id", rest: "/" }],
    ["/en/s/abc/dashboard", { locale: "en", rest: "/s/abc/dashboard" }],
    ["/id/toko", { locale: "id", rest: "/toko" }],
    ["/toko", { locale: null, rest: "/toko" }],
    ["/", { locale: null, rest: "/" }],
    ["/idx/toko", { locale: null, rest: "/idx/toko" }],
    ["/ID/toko", { locale: null, rest: "/ID/toko" }],
    ["/fr/toko", { locale: null, rest: "/fr/toko" }],
  ])("%s", (pathname, expected) => {
    expect(splitLocale(pathname)).toEqual(expected);
  });
});

describe("withLocale", () => {
  it.each([
    ["/mulai", "en", "/en/mulai"],
    ["/id/toko?x=1#a", "en", "/en/toko?x=1#a"],
    ["/en/s/abc/dashboard", "id", "/id/s/abc/dashboard"],
    ["/", "id", "/id"],
    ["/en", "id", "/id"],
    ["/toko?next=/en/x", "id", "/id/toko?next=/en/x"],
  ] as const)("%s → %s", (path, locale, expected) => {
    expect(withLocale(path, locale)).toBe(expected);
  });

  it.each(["/en//evil.com", "//evil.com", "/id/..//evil.com"])(
    "never produces a protocol-relative URL for %j",
    (path) => {
      const result = withLocale(path, "id");
      expect(result.startsWith("/id")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
    },
  );
});
