import { describe, expect, it } from "vitest";
import { firstProfitKey, momentToShow } from "@/lib/dashboard/moments";

describe("momentToShow", () => {
  it.each([
    [{ welcome: true, profitPositive: false, profitCelebrated: false }, "welcome"],
    [{ welcome: true, profitPositive: true, profitCelebrated: false }, "welcome"],
    [{ welcome: false, profitPositive: true, profitCelebrated: false }, "firstProfit"],
    [{ welcome: false, profitPositive: true, profitCelebrated: true }, null],
    [{ welcome: false, profitPositive: false, profitCelebrated: false }, null],
  ] as const)("%o → %s", (input, expected) => {
    expect(momentToShow(input)).toBe(expected);
  });
});

describe("firstProfitKey", () => {
  it("is per store", () => {
    expect(firstProfitKey("abc")).toBe("untungin:first-profit:abc");
  });
});
