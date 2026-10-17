import { z } from "zod";
import { blankAs, MAX_AMOUNT } from "./common";
import { wholeNumber } from "./number";

export const PRICE_VALIDATION_KEYS = ["price.priceNumber", "price.priceMin", "price.salesNumber", "price.salesMin"] as const;

export const priceInputSchema = z.object({
  price: wholeNumber(
    z.number({ error: "price.priceNumber" }).int("price.priceNumber").min(0, "price.priceMin").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  estMonthlySales: blankAs(
    "0",
    wholeNumber(
      z.number({ error: "price.salesNumber" }).int("price.salesNumber").min(0, "price.salesMin").max(MAX_AMOUNT, "common.amountTooLarge"),
    ),
  ),
});

export type PriceInput = z.infer<typeof priceInputSchema>;

export function toPriceColumns(input: PriceInput) {
  return { price: input.price, est_monthly_sales: input.estMonthlySales };
}
