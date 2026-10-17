import { z } from "zod";

/**
 * Parses quantities and percentages typed the Indonesian way: "12,5" → 12.5, "12.5" → 12.5,
 * "1.000,5" → 1000.5; a trailing "%" is ignored. Only digits with at most one decimal
 * separator are accepted. Dot-grouped thousands without a comma ("1.000") are ambiguous
 * (one thousand or one?) so they become NaN; anything else unrecognised does too.
 * Blank input becomes undefined so `inner` reports its required-field message.
 */
export function localeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const s = value.trim().replace(/%$/, "").trim();
    if (s === "") return undefined;
    if (/^\d+$/.test(s)) return Number(s);
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number.NaN;
    if (/^\d+[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
    return Number.NaN;
  }, inner);
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
