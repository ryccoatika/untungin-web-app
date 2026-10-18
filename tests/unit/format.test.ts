import { describe, expect, it } from "vitest";
import { formatPercent, formatNumber, formatRupiah, formatRupiahCompact, formatDateTime } from "@/lib/format";

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

describe("formatRupiahCompact", () => {
  const plain = (text: string) => text.replace(/\s/gu, " ");
  it("shortens large amounts in the locale", () => {
    expect(plain(formatRupiahCompact(1_820_000, "id"))).toBe("Rp1,8 jt");
    expect(plain(formatRupiahCompact(25_000, "id"))).toBe("Rp25 rb");
    expect(plain(formatRupiahCompact(1_234_567_890, "id"))).toBe("Rp1,2 M");
    expect(formatRupiahCompact(1_820_000, "en")).toBe("Rp1.8M");
    expect(formatRupiahCompact(950, "en")).toBe("Rp950");
  });

  it("puts the minus before Rp and never shows -0", () => {
    expect(plain(formatRupiahCompact(-180_000, "id"))).toBe("-Rp180 rb");
    expect(formatRupiahCompact(-0.2, "en")).toBe("Rp0");
  });
});

describe("formatDay", () => {
  it("formats a calendar day in both locales without shifting it", async () => {
    const { formatDay } = await import("@/lib/format");
    expect(formatDay("2026-10-08", "id")).toBe("8 Okt");
    expect(formatDay("2026-10-08", "en")).toBe("Oct 8");
    expect(formatDay("2026-01-01", "id", true)).toBe("1 Jan 2026");
  });
});
