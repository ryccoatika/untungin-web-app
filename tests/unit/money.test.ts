import { describe, expect, it } from "vitest";
import { groupDigits } from "@/lib/format";
import { parseWholeNumber } from "@/lib/validation/number";

describe("parseWholeNumber", () => {
  it.each([
    ["18000", 18000],
    ["18.000", 18000],
    ["18,000", 18000],
    ["Rp 18.000", 18000],
    ["rp18.000", 18000],
    ["1.250.000", 1250000],
    ["0", 0],
  ])("%j → %d", (input, expected) => {
    expect(parseWholeNumber(input)).toBe(expected);
  });

  it("returns undefined for blank and NaN for anything else", () => {
    expect(parseWholeNumber("  ")).toBeUndefined();
    for (const bad of ["15.5", "-1", "1.2.3", "abc", "18.00", "1,000.5"]) expect(parseWholeNumber(bad)).toBeNaN();
  });
});

describe("groupDigits", () => {
  it("groups whole Rupiah in the locale", () => {
    expect(groupDigits("18000", "id")).toBe("18.000");
    expect(groupDigits("18000", "en")).toBe("18,000");
    expect(groupDigits(1250000, "id")).toBe("1.250.000");
    expect(groupDigits("Rp 18.000", "en")).toBe("18,000");
    expect(groupDigits("950", "id")).toBe("950");
  });

  it("leaves blank and unreadable input exactly as typed", () => {
    expect(groupDigits("", "id")).toBe("");
    expect(groupDigits(undefined, "id")).toBe("");
    expect(groupDigits("15.5", "id")).toBe("15.5");
    expect(groupDigits("abc", "en")).toBe("abc");
  });
});
