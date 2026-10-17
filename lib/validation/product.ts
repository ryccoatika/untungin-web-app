import { z } from "zod";
import { blankAs, requiredName } from "./common";
import { localeNumber } from "./number";

export const PRODUCT_VALIDATION_KEYS = [
  "product.nameRequired",
  "product.nameTooLong",
  "product.categoryTooLong",
  "product.yieldNumber",
  "product.yieldPositive",
  "product.marginNumber",
  "product.marginMin",
  "product.marginMax",
] as const;

export const productInputSchema = z.object({
  name: requiredName("product", 80),
  category: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(40, "product.categoryTooLong").nullable(),
  ),
  yieldQty: localeNumber(z.number({ error: "product.yieldNumber" }).positive("product.yieldPositive")),
  targetMarginPct: blankAs(
    null,
    localeNumber(
      z.number({ error: "product.marginNumber" }).min(0, "product.marginMin").lt(100, "product.marginMax"),
    ).nullable(),
  ),
  // A checkbox sends "on" when checked and nothing when unchecked.
  isActive: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export function toProductColumns(input: ProductInput) {
  return {
    name: input.name,
    category: input.category,
    yield_qty: input.yieldQty,
    target_margin_pct: input.targetMarginPct,
    is_active: input.isActive,
  };
}
