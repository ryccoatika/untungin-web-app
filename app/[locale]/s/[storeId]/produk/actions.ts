"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUnit } from "@/lib/calc";
import { isUuid } from "@/lib/uuid";
import { compositionInputSchema, compositionUnitError, toCompositionColumns } from "@/lib/validation/composition";
import { priceInputSchema, toPriceColumns } from "@/lib/validation/price";
import { productInputSchema, toProductColumns } from "@/lib/validation/product";

const PRODUCT_FIELDS = ["name", "category", "yieldQty", "targetMarginPct", "isActive"] as const;

async function parseProduct(formData: FormData) {
  const values = rawValues(formData, PRODUCT_FIELDS);
  const parsed = productInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createProductAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseProduct(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("products")
    .insert({ store_id: storeId, ...toProductColumns(parsed.input) })
    .select("id")
    .single();
  if (error || !data) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  // Straight to the new product so the seller can fill in its composition.
  return redirect({ href: `/s/${storeId}/produk/${data.id}`, locale: await getLocale() });
}

export async function updateProductAction(
  storeId: string,
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseProduct(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(productId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("products")
    .update(toProductColumns(parsed.input))
    .eq("id", productId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteProductAction(storeId: string, productId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(productId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  // Composition rows and prices cascade with the product.
  const { data, error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", storeId).select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/produk`, locale: await getLocale() });
}

const ROW_FIELDS = ["materialId", "qty", "unit", "basis"] as const;

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function parseRow(formData: FormData) {
  const values = rawValues(formData, ROW_FIELDS);
  const parsed = compositionInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

/** The material must belong to the store and the row's unit must match its dimension. */
async function rowErrors(supabase: Supabase, storeId: string, materialId: string, unit: Parameters<typeof compositionUnitError>[1]) {
  const tValidation = await getValidationTranslator();
  const { data: material } = await supabase
    .from("materials")
    .select("purchase_unit")
    .eq("id", materialId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!material || !isUnit(material.purchase_unit)) return { materialId: [tValidation("composition.materialRequired")] };
  const key = compositionUnitError(material.purchase_unit, unit);
  return key ? { unit: [tValidation(key)] } : null;
}

export async function addCompositionRowAction(
  storeId: string,
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseRow(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(productId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const fieldErrors = await rowErrors(supabase, storeId, parsed.input.materialId, parsed.input.unit);
  if (fieldErrors) return { fieldErrors, values: parsed.values };

  const { error } = await supabase.from("product_materials").insert({
    store_id: storeId,
    product_id: productId,
    channel_id: null,
    ...toCompositionColumns(parsed.input),
  });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Composition"))("added") };
}

export async function updateCompositionRowAction(
  storeId: string,
  productId: string,
  rowId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseRow(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(productId) || !isUuid(rowId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  // Validate against the row's stored material, never the posted (client-controlled) materialId.
  const { data: existing } = await supabase
    .from("product_materials")
    .select("material_id")
    .eq("id", rowId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!existing) return { message: tCommon("saveFailed"), values: parsed.values };
  const fieldErrors = await rowErrors(supabase, storeId, existing.material_id, parsed.input.unit);
  if (fieldErrors) return { fieldErrors, values: parsed.values };

  // The material of an existing row never changes; only amount, unit and basis.
  const { data, error } = await supabase
    .from("product_materials")
    .update({ qty: parsed.input.qty, unit: parsed.input.unit, basis: parsed.input.basis })
    .eq("id", rowId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteCompositionRowAction(storeId: string, productId: string, rowId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(productId) || !isUuid(rowId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("product_materials")
    .delete()
    .eq("id", rowId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return { ok: true };
}

const PRICE_FIELDS = ["price", "estMonthlySales"] as const;

export async function savePriceAction(
  storeId: string,
  productId: string,
  channelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const values = rawValues(formData, PRICE_FIELDS);
  const parsed = priceInputSchema.safeParse(values);
  if (!parsed.success) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation), values };
  }
  if (!isUuid(storeId) || !isUuid(productId) || !isUuid(channelId)) return { message: tCommon("notFound"), values };

  const { supabase } = await requireUser();
  // competitor_price is not in the payload, so an update leaves it as it is (it is edited in Phase 3).
  const { error } = await supabase
    .from("product_channel_prices")
    .upsert(
      { store_id: storeId, product_id: productId, channel_id: channelId, ...toPriceColumns(parsed.data) },
      { onConflict: "product_id,channel_id" },
    );
  if (error) return { message: tCommon("saveFailed"), values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Pricing"))("saved"), values };
}
