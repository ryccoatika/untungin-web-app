import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "@/lib/auth/paths";

describe("isProtectedPath", () => {
  it.each([
    ["/s/abc/dashboard", true],
    ["/s", true],
    ["/onboarding", true],
    ["/toko", true],
    ["/mulai", true],
    ["/", false],
    ["/login", false],
    ["/auth/callback", false],
    ["/sabun", false],
    ["/tokoh", false],
    ["/privasi", false],
  ])("%s → %s", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/s/abc/dashboard", "/s/abc/dashboard"],
    ["/toko?x=1#a", "/toko?x=1#a"],
    [null, null],
    [undefined, null],
    ["", null],
    ["toko", null],
    ["https://evil.example", null],
    ["//evil.example", null],
    ["/\\evil.example", null],
    ["/\t/evil.example", null],
    ["javascript:alert(1)", null],
    ["/.//evil.example", null],
    ["/a/..//evil.example", null],
    ["/..//evil.example", null],
    ["/%2e//evil.example", null],
    ["/./\\evil.example", null],
    ["/.\t//evil.example", null],
  ])("%j → %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
