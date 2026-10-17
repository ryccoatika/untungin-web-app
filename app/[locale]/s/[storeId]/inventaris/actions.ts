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
import { assetInputSchema, toAssetColumns } from "@/lib/validation/asset";

const FIELDS = ["name", "category", "qty", "unitPrice", "usefulLifeMonths"] as const;

async function parseAsset(formData: FormData) {
  const values = rawValues(formData, FIELDS);
  const parsed = assetInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createAssetAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseAsset(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("assets").insert({ store_id: storeId, ...toAssetColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Assets"))("created") };
}

export async function updateAssetAction(
  storeId: string,
  assetId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseAsset(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(assetId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("assets")
    .update(toAssetColumns(parsed.input))
    .eq("id", assetId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteAssetAction(storeId: string, assetId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(assetId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("assets").delete().eq("id", assetId).eq("store_id", storeId).select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/inventaris`, locale: await getLocale() });
}
