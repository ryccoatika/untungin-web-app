import { z } from "zod";
import { UNITS } from "@/lib/calc/units";
import { isIsoDate } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { MAX_AMOUNT } from "./common";
import { localeNumber, wholeNumber } from "./number";

export const PURCHASE_UNIT_DIMENSION_KEY = "purchase.unitDimension";

export const PURCHASE_VALIDATION_KEYS = [
  "purchase.materialInvalid",
  "purchase.qtyNumber",
  "purchase.qtyPositive",
  "purchase.unitInvalid",
  PURCHASE_UNIT_DIMENSION_KEY,
  "purchase.totalNumber",
  "purchase.totalMin",
  "purchase.dateInvalid",
  "common.amountTooLarge",
] as const;

/** One purchase as typed in the form. Household units (sdm, sdt, gelas) are not in `UNITS`, so they are refused. */
export const purchaseInputSchema = z.object({
  materialId: z.string({ error: "purchase.materialInvalid" }).refine(isUuid, "purchase.materialInvalid"),
  qty: localeNumber(
    z.number({ error: "purchase.qtyNumber" }).positive("purchase.qtyPositive").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  unit: z.enum(UNITS, { error: "purchase.unitInvalid" }),
  totalPaid: wholeNumber(
    z
      .number({ error: "purchase.totalNumber" })
      .int("purchase.totalNumber")
      .min(0, "purchase.totalMin")
      .max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  date: z.string({ error: "purchase.dateInvalid" }).refine(isIsoDate, "purchase.dateInvalid"),
});

export type PurchaseInput = z.infer<typeof purchaseInputSchema>;
