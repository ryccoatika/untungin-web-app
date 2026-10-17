"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
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
