import { describe, expect, it } from "vitest";
import { formatPercent } from "@/lib/format";

describe("formatPercent", () => {
  it.each([
    [40, "id", "40%"],
    [12.5, "id", "12,5%"],
    [33.333, "id", "33,3%"],
    [0, "id", "0%"],
    [40, "en", "40%"],
    [12.5, "en", "12.5%"],
    [33.333, "en", "33.3%"],
  ] as const)("%d (%s) → %s", (value, locale, expected) => {
    expect(formatPercent(value, locale)).toBe(expected);
  });
});
