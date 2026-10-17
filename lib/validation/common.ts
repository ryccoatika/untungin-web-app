import { z } from "zod";

/** Ceiling for Rupiah amounts and counts; keeps values inside Postgres `integer`. */
export const MAX_AMOUNT = 2_000_000_000;

export const COMMON_VALIDATION_KEYS = ["common.amountTooLarge"] as const;

/** Trimmed, required name with `<group>.nameRequired` / `<group>.nameTooLong` messages. */
export function requiredName(group: string, max: number) {
  return z
    .string({ error: `${group}.nameRequired` })
    .trim()
    .min(1, `${group}.nameRequired`)
    .max(max, `${group}.nameTooLong`);
}

/** Blank form input becomes `fallback` before parsing. */
export function blankAs<T extends z.ZodType>(fallback: unknown, inner: T) {
  return z.preprocess((value) => (value === "" || value == null ? fallback : value), inner);
}
