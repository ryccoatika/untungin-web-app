import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  storeInputSchema,
  toStoreColumns,
} from "@/lib/validation/store";

const valid = {
  name: "  Kopi Senja  ",
  businessType: "minuman",
  targetMarket: "",
  operatingDaysPerMonth: "26",
  targetMarginPct: "40",
};

function errorsFor(input: Record<string, unknown>) {
  const result = storeInputSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("storeInputSchema", () => {
  it("parses a valid form and trims the name", () => {
    expect(storeInputSchema.parse(valid)).toEqual({
      name: "Kopi Senja",
      businessType: "minuman",
      targetMarket: null,
      operatingDaysPerMonth: 26,
      targetMarginPct: 40,
    });
  });

  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["40%", 40],
    [" 35 % ", 35],
    ["0", 0],
  ])("accepts margin %j as %d", (raw, expected) => {
    expect(storeInputSchema.parse({ ...valid, targetMarginPct: raw }).targetMarginPct).toBe(expected);
  });

  it("accepts operating days with surrounding spaces", () => {
    expect(storeInputSchema.parse({ ...valid, operatingDaysPerMonth: " 30 " }).operatingDaysPerMonth).toBe(30);
  });

  it("accepts a target market", () => {
    expect(storeInputSchema.parse({ ...valid, targetMarket: "menengah" }).targetMarket).toBe("menengah");
  });

  it.each([
    [{ name: "   " }, "name", "Nama toko wajib diisi"],
    [{ name: "x".repeat(61) }, "name", "Nama toko maksimal 60 karakter"],
    [{ businessType: "jasa" }, "businessType", "Pilih jenis usaha"],
    [{ targetMarket: "kaya" }, "targetMarket", "Pilih target pasar yang tersedia"],
    [{ targetMarginPct: "" }, "targetMarginPct", "Isi target margin dengan angka"],
    [{ targetMarginPct: "abc" }, "targetMarginPct", "Isi target margin dengan angka"],
    [{ targetMarginPct: "100" }, "targetMarginPct", "Target margin harus kurang dari 100%"],
    [{ targetMarginPct: "-5" }, "targetMarginPct", "Target margin minimal 0%"],
    [{ operatingDaysPerMonth: "" }, "operatingDaysPerMonth", "Isi jumlah hari buka dengan angka"],
    [{ operatingDaysPerMonth: "0" }, "operatingDaysPerMonth", "Minimal 1 hari"],
    [{ operatingDaysPerMonth: "32" }, "operatingDaysPerMonth", "Maksimal 31 hari"],
    [{ operatingDaysPerMonth: "25,5" }, "operatingDaysPerMonth", "Jumlah hari harus bilangan bulat"],
  ])("rejects %j", (patch, field, message) => {
    expect(errorsFor({ ...valid, ...patch })[field]).toBe(message);
  });
});

describe("toStoreColumns", () => {
  it("maps form fields to database columns", () => {
    expect(
      toStoreColumns({
        name: "Kopi",
        businessType: "minuman",
        targetMarket: null,
        operatingDaysPerMonth: 26,
        targetMarginPct: 40,
      }),
    ).toEqual({
      name: "Kopi",
      business_type: "minuman",
      target_market: null,
      operating_days_per_month: 26,
      target_margin_pct: 40,
    });
  });
});

describe("confirmationMatches", () => {
  it.each([
    ["Kopi Senja", "Kopi Senja", true],
    ["  Kopi Senja ", "Kopi Senja", true],
    ["kopi senja", "Kopi Senja", false],
    ["", "Kopi Senja", false],
  ])("%j vs %j → %s", (input, name, expected) => {
    expect(confirmationMatches(input, name)).toBe(expected);
  });
});
