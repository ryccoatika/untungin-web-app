import { z } from "zod";
import { ASSET_CATEGORIES } from "@/lib/calc/types";
import { MAX_AMOUNT, requiredName } from "./common";
import { wholeNumber } from "./number";

export const ASSET_VALIDATION_KEYS = [
  "asset.nameRequired",
  "asset.nameTooLong",
  "asset.categoryInvalid",
  "asset.qtyNumber",
  "asset.qtyMin",
  "asset.priceNumber",
  "asset.priceMin",
  "asset.lifeNumber",
  "asset.lifeMin",
  "asset.lifeMax",
] as const;

export const assetInputSchema = z.object({
  name: requiredName("asset", 80),
  category: z.enum(ASSET_CATEGORIES, { error: "asset.categoryInvalid" }),
  qty: wholeNumber(z.number({ error: "asset.qtyNumber" }).int("asset.qtyNumber").min(1, "asset.qtyMin").max(MAX_AMOUNT, "common.amountTooLarge")),
  unitPrice: wholeNumber(
    z.number({ error: "asset.priceNumber" }).int("asset.priceNumber").min(0, "asset.priceMin").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  usefulLifeMonths: wholeNumber(
    z.number({ error: "asset.lifeNumber" }).int("asset.lifeNumber").min(1, "asset.lifeMin").max(600, "asset.lifeMax"),
  ),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

export function toAssetColumns(input: AssetInput) {
  return {
    name: input.name,
    category: input.category,
    qty: input.qty,
    unit_price: input.unitPrice,
    useful_life_months: input.usefulLifeMonths,
  };
}
