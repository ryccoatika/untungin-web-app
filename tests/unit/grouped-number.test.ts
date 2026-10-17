import { describe, expect, it } from "vitest";
import { splitAfterSeparators } from "@/lib/format";

describe("splitAfterSeparators", () => {
  it.each([
    ["Rp32.850.000", ["Rp32.", "850.", "000"]],
    ["Rp1,234,567", ["Rp1,", "234,", "567"]],
    ["-Rp500", ["-Rp500"]],
    ["1,5 bulan", ["1,", "5 bulan"]],
    ["—", ["—"]],
    ["", []],
  ])("%s", (input, expected) => {
    expect(splitAfterSeparators(input)).toEqual(expected);
  });

  it("joins back to the original text", () => {
    expect(splitAfterSeparators("Rp1.000.000.000").join("")).toBe("Rp1.000.000.000");
  });
});
