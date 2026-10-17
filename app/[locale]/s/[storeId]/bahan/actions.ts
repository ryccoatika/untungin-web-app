"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isUnit, sameDimension } from "@/lib/calc";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
import { MATERIAL_UNIT_IN_USE_KEY, materialInputSchema, toMaterialColumns } from "@/lib/validation/material";

const FIELDS = ["name", "category", "purchaseQty", "purchaseUnit", "purchasePrice", "wastePct"] as const;

async function parseMaterial(formData: FormData) {
  const values = rawValues(formData, FIELDS);
  const parsed = materialInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createMaterialAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseMaterial(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("materials").insert({ store_id: storeId, ...toMaterialColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  // No values: the add form clears for the next material.
  return { ok: true, message: (await getTranslations("Materials"))("created") };
}

export async function updateMaterialAction(
  storeId: string,
  materialId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseMaterial(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(materialId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  // A composition row must stay in the same dimension as its material (spec §3.3).
  const { data: rows, error: rowsError } = await supabase
    .from("product_materials")
    .select("unit")
    .eq("store_id", storeId)
    .eq("material_id", materialId);
  if (rowsError) return { message: tCommon("saveFailed"), values: parsed.values };
  if (rows.some((row) => isUnit(row.unit) && !sameDimension(row.unit, parsed.input.purchaseUnit))) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { purchaseUnit: [tValidation(MATERIAL_UNIT_IN_USE_KEY)] }, values: parsed.values };
  }

  const { data, error } = await supabase
    .from("materials")
    .update(toMaterialColumns(parsed.input))
    .eq("id", materialId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteMaterialAction(storeId: string, materialId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(materialId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("materials").delete().eq("id", materialId).eq("store_id", storeId).select("id");
  if (error?.code === "23503") {
    // The composition FK refuses to delete a material that a product uses.
    const { data: uses } = await supabase.from("product_materials").select("product_id").eq("material_id", materialId);
    const productIds = [...new Set((uses ?? []).map((use) => use.product_id))];
    const { data: products } = await supabase.from("products").select("name").in("id", productIds).order("name");
    const t = await getTranslations("Materials");
    return { message: t("deleteInUse", { products: (products ?? []).map((p) => p.name).join(", ") }) };
  }
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/bahan`, locale: await getLocale() });
}
