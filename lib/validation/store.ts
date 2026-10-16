import { z } from "zod";
import { localeNumber } from "./number";

export const BUSINESS_TYPES = [
  "makanan",
  "minuman",
  "kue_roti",
  "katering",
  "produk_olahan",
  "lainnya",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  makanan: "Makanan",
  minuman: "Minuman",
  kue_roti: "Kue & roti",
  katering: "Katering",
  produk_olahan: "Produk olahan (sabun, lilin, kerajinan, dll.)",
  lainnya: "Lainnya",
};

export function businessTypeLabel(value: string): string {
  return (BUSINESS_TYPE_LABELS as Record<string, string>)[value] ?? value;
}

export const TARGET_MARKETS = ["menengah_bawah", "menengah", "menengah_atas"] as const;
export type TargetMarket = (typeof TARGET_MARKETS)[number];

export const TARGET_MARKET_LABELS: Record<TargetMarket, string> = {
  menengah_bawah: "Menengah ke bawah",
  menengah: "Menengah",
  menengah_atas: "Menengah ke atas",
};

export const STORE_DEFAULTS = { operatingDaysPerMonth: 26, targetMarginPct: 40 } as const;

export const DUPLICATE_STORE_NAME_MESSAGE = "Kamu sudah punya toko dengan nama ini.";

export const storeInputSchema = z.object({
  name: z
    .string({ error: "Nama toko wajib diisi" })
    .trim()
    .min(1, "Nama toko wajib diisi")
    .max(60, "Nama toko maksimal 60 karakter"),
  businessType: z.enum(BUSINESS_TYPES, { error: "Pilih jenis usaha" }),
  targetMarket: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(TARGET_MARKETS, { error: "Pilih target pasar yang tersedia" }).nullable(),
  ),
  operatingDaysPerMonth: localeNumber(
    z
      .number({ error: "Isi jumlah hari buka dengan angka" })
      .int("Jumlah hari harus bilangan bulat")
      .min(1, "Minimal 1 hari")
      .max(31, "Maksimal 31 hari"),
  ),
  targetMarginPct: localeNumber(
    z
      .number({ error: "Isi target margin dengan angka" })
      .min(0, "Target margin minimal 0%")
      .lt(100, "Target margin harus kurang dari 100%"),
  ),
});

export type StoreInput = z.infer<typeof storeInputSchema>;

export function toStoreColumns(input: StoreInput) {
  return {
    name: input.name,
    business_type: input.businessType,
    target_market: input.targetMarket,
    operating_days_per_month: input.operatingDaysPerMonth,
    target_margin_pct: input.targetMarginPct,
  };
}

/** Delete confirmation: surrounding spaces ignored, case-sensitive. */
export function confirmationMatches(input: string, storeName: string): boolean {
  return input.trim() !== "" && input.trim() === storeName.trim();
}
