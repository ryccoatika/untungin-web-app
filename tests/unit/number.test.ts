import { describe, expect, it } from "vitest";
import { z } from "zod";
import { localeNumber, wholeNumber } from "@/lib/validation/number";

const amount = wholeNumber(z.number({ error: "nan" }).int("int").min(0, "min"));

describe("wholeNumber", () => {
  it.each([
    ["15000", 15000],
    ["15.000", 15000],
    ["15,000", 15000],
    ["15 000", 15000],
    ["Rp 15.000", 15000],
    ["rp15.000", 15000],
    ["Rp. 1.000.000", 1000000],
    ["1.000.000", 1000000],
    [" 0 ", 0],
  ])("reads %j as %d", (input, expected) => {
    expect(amount.parse(input)).toBe(expected);
  });

  it.each(["15.5", "15,50", "1.5.000", "15.00", "-500", "abc", "1.000,5"])("rejects %j", (input) => {
    const result = amount.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("nan");
  });

  it("treats blank input as missing", () => {
    expect(amount.safeParse("  ").error?.issues[0].message).toBe("nan");
  });

  it("passes numbers through", () => {
    expect(amount.parse(42)).toBe(42);
  });
});

describe("localeNumber (unchanged behaviour)", () => {
  const qty = localeNumber(z.number());
  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1.000,5", 1000.5],
  ])("reads %j as %d", (input, expected) => {
    expect(qty.parse(input)).toBe(expected);
  });
});
