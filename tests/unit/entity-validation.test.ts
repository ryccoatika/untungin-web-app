import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { assetInputSchema, toAssetColumns } from "@/lib/validation/asset";
import { channelInputSchema, toChannelColumns } from "@/lib/validation/channel";
import { compositionInputSchema, compositionUnitError } from "@/lib/validation/composition";
import { expenseInputSchema, toExpenseColumns } from "@/lib/validation/expense";
import { materialInputSchema, toMaterialColumns } from "@/lib/validation/material";
import { priceInputSchema, toPriceColumns } from "@/lib/validation/price";
import { productInputSchema, toProductColumns } from "@/lib/validation/product";

function errorsFor(schema: z.ZodType, input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

const material = { name: " Gula pasir ", category: "bahan", purchaseQty: "1", purchaseUnit: "kg", purchasePrice: "15.000", wastePct: "" };

describe("materialInputSchema", () => {
  it("parses a form with a thousand-separated price and blank waste", () => {
    const parsed = materialInputSchema.parse(material);
    expect(parsed).toEqual({ name: "Gula pasir", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 });
    expect(toMaterialColumns(parsed)).toEqual({
      name: "Gula pasir",
      category: "bahan",
      purchase_qty: 1,
      purchase_unit: "kg",
      purchase_price: 15000,
      waste_pct: 0,
    });
  });

  it("accepts decimal quantities and waste with a comma", () => {
    expect(materialInputSchema.parse({ ...material, purchaseQty: "2,5", wastePct: "12,5" })).toMatchObject({ purchaseQty: 2.5, wastePct: 12.5 });
  });

  it.each([
    [{ name: "" }, "name", "material.nameRequired"],
    [{ name: "x".repeat(81) }, "name", "material.nameTooLong"],
    [{ category: "bumbu" }, "category", "material.categoryInvalid"],
    [{ purchaseQty: "0" }, "purchaseQty", "material.qtyPositive"],
    [{ purchaseQty: "satu" }, "purchaseQty", "material.qtyNumber"],
    [{ purchaseUnit: "sdm" }, "purchaseUnit", "material.unitInvalid"],
    [{ purchasePrice: "15.5" }, "purchasePrice", "material.priceNumber"],
    [{ purchasePrice: "" }, "purchasePrice", "material.priceNumber"],
    [{ purchasePrice: "3.000.000.000" }, "purchasePrice", "common.amountTooLarge"],
    [{ wastePct: "100" }, "wastePct", "material.wasteMax"],
    [{ wastePct: "-1" }, "wastePct", "material.wasteMin"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(materialInputSchema, { ...material, ...patch })[field]).toBe(key);
  });
});

describe("productInputSchema", () => {
  const product = { name: "Es kopi susu", category: "", yieldQty: "10", targetMarginPct: "", isActive: "on" };

  it("parses optional fields as null and the checkbox as a boolean", () => {
    const parsed = productInputSchema.parse(product);
    expect(parsed).toEqual({ name: "Es kopi susu", category: null, yieldQty: 10, targetMarginPct: null, isActive: true });
    expect(toProductColumns(parsed)).toEqual({ name: "Es kopi susu", category: null, yield_qty: 10, target_margin_pct: null, is_active: true });
  });

  it("an unchecked checkbox (missing field) means inactive", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isActive: _ignored, ...rest } = product;
    expect(productInputSchema.parse(rest).isActive).toBe(false);
  });

  it("keeps an own target margin", () => {
    expect(productInputSchema.parse({ ...product, targetMarginPct: "25,5", category: " Minuman " })).toMatchObject({ targetMarginPct: 25.5, category: "Minuman" });
  });

  it.each([
    [{ yieldQty: "0" }, "yieldQty", "product.yieldPositive"],
    [{ yieldQty: "" }, "yieldQty", "product.yieldNumber"],
    [{ targetMarginPct: "100" }, "targetMarginPct", "product.marginMax"],
    [{ category: "x".repeat(41) }, "category", "product.categoryTooLong"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(productInputSchema, { ...product, ...patch })[field]).toBe(key);
  });
});

describe("compositionInputSchema", () => {
  const row = { materialId: "6f1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f60", qty: "200", unit: "g", basis: "batch" };

  it("parses a row", () => {
    expect(compositionInputSchema.parse(row)).toEqual({ ...row, qty: 200 });
  });

  it.each([
    [{ materialId: "" }, "materialId", "composition.materialRequired"],
    [{ materialId: "not-a-uuid" }, "materialId", "composition.materialRequired"],
    [{ qty: "0" }, "qty", "composition.qtyPositive"],
    [{ unit: "gelas" }, "unit", "composition.unitInvalid"],
    [{ basis: "resep" }, "basis", "composition.basisInvalid"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(compositionInputSchema, { ...row, ...patch })[field]).toBe(key);
  });

  it("rejects a unit from another dimension than the material", () => {
    expect(compositionUnitError("kg", "g")).toBeNull();
    expect(compositionUnitError("kg", "ml")).toBe("composition.unitDimension");
    expect(compositionUnitError("lusin", "pcs")).toBeNull();
  });
});

describe("channelInputSchema", () => {
  it("parses a channel; blank commission and fee mean 0", () => {
    const parsed = channelInputSchema.parse({ name: " GoFood ", commissionPct: "20", fixedFee: "1.000" });
    expect(parsed).toEqual({ name: "GoFood", commissionPct: 20, fixedFee: 1000 });
    expect(toChannelColumns(parsed)).toEqual({ name: "GoFood", commission_pct: 20, fixed_fee: 1000 });
    expect(channelInputSchema.parse({ name: "Titip toko", commissionPct: "", fixedFee: "" })).toMatchObject({ commissionPct: 0, fixedFee: 0 });
  });

  it.each([
    [{ name: "" }, "name", "channel.nameRequired"],
    [{ name: "x".repeat(61) }, "name", "channel.nameTooLong"],
    [{ commissionPct: "100" }, "commissionPct", "channel.commissionMax"],
    [{ commissionPct: "-1" }, "commissionPct", "channel.commissionMin"],
    [{ commissionPct: "dua puluh" }, "commissionPct", "channel.commissionNumber"],
    [{ fixedFee: "1,5" }, "fixedFee", "channel.feeNumber"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(channelInputSchema, { name: "GoFood", commissionPct: "20", fixedFee: "0", ...patch })[field]).toBe(key);
  });
});

describe("priceInputSchema", () => {
  it.each([
    [{ price: "18.000", estMonthlySales: "1.200" }, { price: 18000, estMonthlySales: 1200, competitorPrice: null }],
    [{ price: "Rp 18.000", estMonthlySales: "" }, { price: 18000, estMonthlySales: 0, competitorPrice: null }],
    [{ price: "0", estMonthlySales: "0" }, { price: 0, estMonthlySales: 0, competitorPrice: null }],
  ])("parses %j", (input, expected) => {
    expect(priceInputSchema.parse(input)).toEqual(expected);
  });

  it.each([
    [{ price: "18.5", estMonthlySales: "1" }, "price", "price.priceNumber"],
    [{ price: "", estMonthlySales: "1" }, "price", "price.priceNumber"],
    [{ price: "1000", estMonthlySales: "2,5" }, "estMonthlySales", "price.salesNumber"],
  ])("%j → %s: %s", (input, field, key) => {
    expect(errorsFor(priceInputSchema, input)[field]).toBe(key);
  });
});

describe("priceInputSchema competitor price", () => {
  it.each([
    [{ price: "18.000", estMonthlySales: "100", competitorPrice: "Rp 17.000" }, 17000],
    [{ price: "18.000", estMonthlySales: "100", competitorPrice: "" }, null],
    [{ price: "18.000", estMonthlySales: "100" }, null],
  ])("reads %j", (input, expected) => {
    const parsed = priceInputSchema.parse(input);
    expect(parsed.competitorPrice).toBe(expected);
    expect(toPriceColumns(parsed).competitor_price).toBe(expected);
  });

  it("rejects a competitor price with decimals", () => {
    expect(errorsFor(priceInputSchema, { price: "1000", estMonthlySales: "1", competitorPrice: "17.5" }).competitorPrice).toBe(
      "price.competitorNumber",
    );
  });
});

describe("expenseInputSchema", () => {
  const expense = { name: "Sewa kios", category: "sewa", amount: "1.500.000", frequency: "bulanan" };

  it("parses an expense", () => {
    const parsed = expenseInputSchema.parse(expense);
    expect(parsed).toEqual({ ...expense, amount: 1500000 });
    expect(toExpenseColumns(parsed)).toEqual({ name: "Sewa kios", category: "sewa", amount: 1500000, frequency: "bulanan" });
  });

  it.each([
    [{ category: "pajak" }, "category", "expense.categoryInvalid"],
    [{ amount: "1,5" }, "amount", "expense.amountNumber"],
    [{ frequency: "sekali" }, "frequency", "expense.frequencyInvalid"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(expenseInputSchema, { ...expense, ...patch })[field]).toBe(key);
  });
});

describe("assetInputSchema", () => {
  const asset = { name: "Meja kayu", category: "furnitur", qty: "2", unitPrice: "350.000", usefulLifeMonths: "60" };

  it("parses an asset", () => {
    const parsed = assetInputSchema.parse(asset);
    expect(parsed).toEqual({ name: "Meja kayu", category: "furnitur", qty: 2, unitPrice: 350000, usefulLifeMonths: 60 });
    expect(toAssetColumns(parsed)).toEqual({ name: "Meja kayu", category: "furnitur", qty: 2, unit_price: 350000, useful_life_months: 60 });
  });

  it.each([
    [{ qty: "0" }, "qty", "asset.qtyMin"],
    [{ qty: "1,5" }, "qty", "asset.qtyNumber"],
    [{ usefulLifeMonths: "0" }, "usefulLifeMonths", "asset.lifeMin"],
    [{ usefulLifeMonths: "601" }, "usefulLifeMonths", "asset.lifeMax"],
    [{ unitPrice: "abc" }, "unitPrice", "asset.priceNumber"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(assetInputSchema, { ...asset, ...patch })[field]).toBe(key);
  });
});
