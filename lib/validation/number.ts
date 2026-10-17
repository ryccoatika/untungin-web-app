import { z } from "zod";

/**
 * Parses numbers typed the Indonesian way: "12,5" → 12.5, "1.000,5" → 1000.5,
 * a trailing "%" is ignored. Without a comma, "." is the decimal point ("12.5").
 * Blank input becomes undefined so `inner` reports its required-field message.
 */
export function localeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    let s = value.trim().replace(/%$/, "").trim();
    if (s === "") return undefined;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return Number(s);
  }, inner);
}
