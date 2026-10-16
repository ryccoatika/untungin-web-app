import { describe, expect, it } from "vitest";
import { formatPercent } from "@/lib/format";

describe("formatPercent", () => {
  it.each([
    [40, "40%"],
    [12.5, "12,5%"],
    [33.333, "33,3%"],
    [0, "0%"],
  ])("%d → %s", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});
