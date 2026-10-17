import { describe, expect, it } from "vitest";
import { formatPercent, formatNumber, formatRupiah, formatDateTime } from "@/lib/format";

describe("formatPercent", () => {
  it.each([
    [40, "id", "40%"],
    [12.5, "id", "12,5%"],
    [33.333, "id", "33,3%"],
    [0, "id", "0%"],
    [40, "en", "40%"],
    [12.5, "en", "12.5%"],
    [33.333, "en", "33.3%"],
    [-0.02, "id", "0%"],
    [-0.04, "en", "0%"],
    [-0.06, "id", "-0,1%"],
  ] as const)("%d (%s) → %s", (value, locale, expected) => {
    expect(formatPercent(value, locale)).toBe(expected);
  });
});

describe("formatNumber", () => {
  it("uses the locale's separators", () => {
    expect(formatNumber(1234.5, "id")).toBe("1.234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
  });

  it("limits fraction digits", () => {
    expect(formatNumber(1.98019, "id", 1)).toBe("2");
    expect(formatNumber(22.2222, "en", 2)).toBe("22.22");
  });
});

describe("formatRupiah", () => {
  it.each([
    [15000, "id", "Rp15.000"],
    [15000, "en", "Rp15,000"],
    [1000000000, "id", "Rp1.000.000.000"],
    [-500, "id", "-Rp500"],
    [-0.4, "id", "Rp0"],
    [5499.6, "id", "Rp5.500"],
  ] as const)("formats %d in %s as %s", (value, locale, expected) => {
    expect(formatRupiah(value, locale)).toBe(expected);
  });

  it("shows decimals when asked (cost per gram)", () => {
    expect(formatRupiah(22.2222, "id", 2)).toBe("Rp22,22");
  });
});


describe("formatDateTime", () => {
  it("shows Jakarta time in the locale", () => {
    // 2026-10-17 01:05 UTC = 08:05 WIB
    expect(formatDateTime("2026-10-17T01:05:00.000Z", "id")).toBe("17 Okt 2026, 08.05");
    expect(formatDateTime("2026-10-17T01:05:00.000Z", "en")).toBe("Oct 17, 2026, 8:05 AM");
  });
});
