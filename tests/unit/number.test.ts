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

describe("localeNumber", () => {
  const qty = localeNumber(z.number({ error: "nan" }));
  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1.5", 1.5],
    ["1.000,5", 1000.5],
    ["1.000.000,25", 1000000.25],
    ["40", 40],
    ["1000", 1000],
    ["40%", 40],
    ["12,5 %", 12.5],
  ])("reads %j as %d", (input, expected) => {
    expect(qty.parse(input)).toBe(expected);
  });

  it.each([
    ["0.125", 0.125],
    ["0,125", 0.125],
    ["0,5", 0.5],
    ["-5", -5],
    ["-1,5", -1.5],
    ["- 2", -2],
    ["-0", 0],
  ])("reads %j as %d", (input, expected) => {
    expect(localeNumber(z.number()).parse(input)).toBe(expected);
  });

  it.each(["1,000", "12,500", "1,000,000", "-1.000", "--5", "1e3", "0x10"])("rejects the ambiguous or invalid %j", (input) => {
    expect(localeNumber(z.number({ error: "nan" })).safeParse(input).error?.issues[0].message).toBe("nan");
  });

  it.each(["1.000", "1.500", "1.000.000", "1e308", "0x10", "Infinity", "1,2,3", "1.2.3", "abc", "1.000,5,1"])(
    "rejects %j",
    (input) => {
      const result = qty.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("nan");
    },
  );

  it("treats blank input as missing", () => {
    expect(qty.safeParse("  ").success).toBe(false);
  });
});
