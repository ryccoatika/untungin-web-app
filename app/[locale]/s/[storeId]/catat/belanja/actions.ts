"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { isUnit, sameDimension } from "@/lib/calc";
import { revalidateStore } from "@/lib/data/revalidate";
import type { AppLocale } from "@/i18n/routing";
import { formatDay, formatNumber, formatRupiah } from "@/lib/format";
import { type FormState } from "@/lib/forms";
import { parseForm } from "@/lib/forms-server";
import { getValidationTranslator } from "@/lib/i18n/server";
import { earliestRecordable, jakartaToday, newPurchasePrice } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { PURCHASE_UNIT_DIMENSION_KEY, purchaseInputSchema } from "@/lib/validation/purchase";

const FIELDS = ["materialId", "qty", "unit", "totalPaid", "date"] as const;

export async function savePurchaseAction(
  storeId: string,
  purchaseId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requireUser();
  const t = await getTranslations("Records.purchases");
  const tCommon = await getTranslations("Common");
  const locale = (await getLocale()) as AppLocale;

  const parsed = await parseForm(purchaseInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  const { values } = parsed;
  if (!isUuid(storeId) || (purchaseId !== null && !isUuid(purchaseId))) return { message: tCommon("notFound"), values };

  const input = parsed.input;
  const today = jakartaToday(new Date());
  const min = earliestRecordable(today);
  if (input.date < min || input.date > today) {
    return { fieldErrors: { date: [t("errorDate", { min: formatDay(min, locale, true) })] }, values };
  }

  // An edit keeps the purchase's own material; the form's material field is not trusted.
  let materialId = input.materialId;
  if (purchaseId !== null) {
    const { data: existing, error: findError } = await supabase
      .from("purchases")
      .select("material_id")
      .eq("id", purchaseId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (findError) return { message: tCommon("saveFailed"), values };
    if (!existing) return { message: tCommon("notFound"), values };
    if (!existing.material_id) return { message: t("errorMaterialGone"), values };
    materialId = existing.material_id;
  }

  const { data: material, error: materialError } = await supabase
    .from("materials")
    .select("name, purchase_qty, purchase_unit")
    .eq("id", materialId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (materialError) return { message: tCommon("saveFailed"), values };
  if (!material || !isUnit(material.purchase_unit)) return { message: t("errorMaterial"), values };

  // The unit must fit the material's dimension (a household unit never gets here: the schema refuses it).
  if (!sameDimension(input.unit, material.purchase_unit)) {
    return { fieldErrors: { unit: [(await getValidationTranslator())(PURCHASE_UNIT_DIMENSION_KEY)] }, values };
  }

  const newPrice = newPurchasePrice(
    { purchaseQty: Number(material.purchase_qty), purchaseUnit: material.purchase_unit },
    input.qty,
    input.unit,
    input.totalPaid,
  );
  const { data: changed, error } = await supabase.rpc("save_purchase", {
    p_store_id: storeId,
    // The function takes null to insert; the generated type cannot express a nullable argument.
    p_purchase_id: purchaseId as string,
    p_material_id: materialId,
    p_date: input.date,
    p_qty: input.qty,
    p_unit: input.unit,
    p_total_paid: input.totalPaid,
    p_new_price: newPrice,
  });
  if (error) {
    if (error.code === "UT002") {
      return { fieldErrors: { date: [t("errorDate", { min: formatDay(min, locale, true) })] }, values };
    }
    // P0002: the material or purchase is not in this store (or was just deleted).
    if (error.code === "P0002") return { message: t("errorMaterial"), values };
    return { message: tCommon("saveFailed"), values };
  }

  revalidateStore();
  const pack = { qty: formatNumber(Number(material.purchase_qty), locale), unit: material.purchase_unit };
  if (changed) {
    return {
      ok: true,
      message: t("savedChanged", { material: material.name, price: formatRupiah(newPrice, locale), ...pack }),
      // An edit keeps what was typed; a new purchase clears the form for the next one.
      ...(purchaseId !== null ? { values } : {}),
    };
  }

  // The price did not move: name the newer purchase that holds it.
  let newer = input.date;
  const { data: later } = await supabase
    .from("purchases")
    .select("date")
    .eq("material_id", materialId)
    .eq("store_id", storeId)
    .gt("date", input.date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (later) newer = later.date;
  return {
    ok: true,
    message: t("savedKept", { date: formatDay(newer, locale) }),
    ...(purchaseId !== null ? { values } : {}),
  };
}

export async function deletePurchaseAction(storeId: string, purchaseId: string): Promise<FormState> {
  const { supabase } = await requireUser();
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(purchaseId)) return { message: tCommon("notFound") };

  // Deleting never moves the material price (spec §3).
  const { data, error } = await supabase.from("purchases").delete().eq("id", purchaseId).eq("store_id", storeId).select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Records.purchases"))("deleted") };
}
