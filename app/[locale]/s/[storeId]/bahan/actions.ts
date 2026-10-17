"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { dimensionOf, isHouseholdUnit, isRecipeUnit, sameDimension } from "@/lib/calc";
import { revalidateStore } from "@/lib/data/revalidate";
import { type FormState } from "@/lib/forms";
import { parseForm } from "@/lib/forms-server";
import { getValidationTranslator } from "@/lib/i18n/server";
import { isUuid } from "@/lib/uuid";
import { MATERIAL_SPOON_WEIGHT_IN_USE_KEY, MATERIAL_UNIT_IN_USE_KEY, materialInputSchema, toMaterialColumns } from "@/lib/validation/material";

const FIELDS = ["name", "category", "purchaseQty", "purchaseUnit", "purchasePrice", "wastePct", "gramsPerSdm"] as const;

export async function createMaterialAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(materialInputSchema, formData, FIELDS);
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
  const parsed = await parseForm(materialInputSchema, formData, FIELDS);
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
  const units = rows.map((row) => row.unit).filter(isRecipeUnit);
  const newDimension = dimensionOf(parsed.input.purchaseUnit);
  // Household units (sdm, sdt, gelas) fit mass and volume only, and mass also needs the spoon weight.
  const householdRows = units.some(isHouseholdUnit);
  const dimensionBroken = units.some((unit) =>
    isHouseholdUnit(unit) ? newDimension === "count" : !sameDimension(unit, parsed.input.purchaseUnit),
  );
  if (dimensionBroken) {
    const tValidation = await getValidationTranslator();
    const householdOnly = !units.some((unit) => !isHouseholdUnit(unit) && !sameDimension(unit, parsed.input.purchaseUnit));
    return {
      fieldErrors: { purchaseUnit: [tValidation(householdOnly ? MATERIAL_SPOON_WEIGHT_IN_USE_KEY : MATERIAL_UNIT_IN_USE_KEY)] },
      values: parsed.values,
    };
  }
  if (householdRows && newDimension === "mass" && parsed.input.gramsPerSdm === null) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { gramsPerSdm: [tValidation(MATERIAL_SPOON_WEIGHT_IN_USE_KEY)] }, values: parsed.values };
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
