import { z } from "zod";

/**
 * Parses quantities and percentages: "12,5" or "12.5" → 12.5, "1.000,5" → 1000.5, "0,125" → 0.125,
 * "-5" → -5 (the schema's min() reports negatives); a trailing "%" is ignored. Grouped thousands
 * without a decimal part ("1.000", "1,000") are ambiguous — one thousand or one? — so they become
 * NaN and the field asks the user to write 1000 or 1,5. Anything else unrecognised is NaN too.
 * Blank input becomes undefined so `inner` reports its required-field message.
 */
export function localeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    let s = value.trim().replace(/%$/, "").trim();
    if (s === "") return undefined;
    let sign = 1;
    if (s.startsWith("-")) {
      sign = -1;
      s = s.slice(1).trim();
    }
    const parsed = parseUnsigned(s);
    return Number.isNaN(parsed) ? parsed : sign * parsed;
  }, inner);
}

function parseUnsigned(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  // A zero integer part can't be a thousands group: "0.125" and "0,125" are decimals.
  if (/^0[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number.NaN;
  if (/^\d+[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number.NaN;
}

const THOUSANDS = [/^\d{1,3}(\.\d{3})+$/, /^\d{1,3}(,\d{3})+$/, /^\d{1,3}( \d{3})+$/];

/**
 * Parses whole numbers such as Rupiah amounts and counts: "15000", "15.000", "15,000",
 * "Rp 15.000" → 15000. Separators must group thousands (1–3 digits, then groups of 3), so
 * decimals ("15.5"), negatives, and mixed separators become NaN and `inner` reports its
 * number message. Blank input becomes undefined.
 */
export function wholeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const s = value.trim().replace(/^rp\.?\s*/i, "");
    if (s === "") return undefined;
    if (/^\d+$/.test(s)) return Number(s);
    if (THOUSANDS.some((pattern) => pattern.test(s))) return Number(s.replace(/[., ]/g, ""));
    return Number.NaN;
  }, inner);
}
