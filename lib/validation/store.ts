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

export const TARGET_MARKETS = ["menengah_bawah", "menengah", "menengah_atas"] as const;
export type TargetMarket = (typeof TARGET_MARKETS)[number];

export const STORE_DEFAULTS = { operatingDaysPerMonth: 26, targetMarginPct: 40 } as const;

export const DUPLICATE_STORE_NAME_KEY = "store.duplicateName";
export const CONFIRM_MISMATCH_KEY = "store.confirmMismatch";

/** Every message key this module can return (checked against the catalogs in tests). */
export const STORE_VALIDATION_KEYS = [
  "store.nameRequired",
  "store.nameTooLong",
  "store.businessTypeInvalid",
  "store.targetMarketInvalid",
  "store.operatingDaysNumber",
  "store.operatingDaysInteger",
  "store.operatingDaysMin",
  "store.operatingDaysMax",
  "store.marginNumber",
  "store.marginMin",
  "store.marginMax",
  DUPLICATE_STORE_NAME_KEY,
  CONFIRM_MISMATCH_KEY,
] as const;

export const storeInputSchema = z.object({
  name: z
    .string({ error: "store.nameRequired" })
    .trim()
    .min(1, "store.nameRequired")
    .max(60, "store.nameTooLong"),
  businessType: z.enum(BUSINESS_TYPES, { error: "store.businessTypeInvalid" }),
  targetMarket: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(TARGET_MARKETS, { error: "store.targetMarketInvalid" }).nullable(),
  ),
  operatingDaysPerMonth: localeNumber(
    z
      .number({ error: "store.operatingDaysNumber" })
      .int("store.operatingDaysInteger")
      .min(1, "store.operatingDaysMin")
      .max(31, "store.operatingDaysMax"),
  ),
  targetMarginPct: localeNumber(
    z
      .number({ error: "store.marginNumber" })
      .min(0, "store.marginMin")
      .lt(100, "store.marginMax"),
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
