"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import type { FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
import {
  CONFIRM_MISMATCH_KEY,
  confirmationMatches,
  DUPLICATE_STORE_NAME_KEY,
  storeInputSchema,
  toStoreColumns,
} from "@/lib/validation/store";

const STORE_FIELD_NAMES = [
  "name",
  "businessType",
  "targetMarket",
  "operatingDaysPerMonth",
  "targetMarginPct",
] as const;

function rawValues(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of names) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

export async function updateStoreAction(
  storeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = rawValues(formData, STORE_FIELD_NAMES);
  const tValidation = await getValidationTranslator();
  const tStore = await getTranslations("Store");
  if (!isUuid(storeId)) return { message: tStore("notFound"), values };

  const parsed = storeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation), values };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("stores")
    .update(toStoreColumns(parsed.data))
    .eq("id", storeId)
    .select("id");

  if (error?.code === "23505") {
    return { fieldErrors: { name: [tValidation(DUPLICATE_STORE_NAME_KEY)] }, values };
  }
  if (error || !data?.length) {
    return { message: tStore("saveFailed"), values };
  }

  revalidatePath("/[locale]/s/[storeId]", "layout");
  return { ok: true, message: tStore("saved"), values };
}

export async function deleteStoreAction(
  storeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = rawValues(formData, ["confirmName"]);
  const tValidation = await getValidationTranslator();
  const tStore = await getTranslations("Store");
  if (!isUuid(storeId)) return { message: tStore("notFound"), values };

  const { supabase } = await requireUser();
  const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return { message: tStore("notFound"), values };

  const confirmation = String(formData.get("confirmName") ?? "");
  if (!confirmationMatches(confirmation, store.name)) {
    return { fieldErrors: { confirmName: [tValidation(CONFIRM_MISMATCH_KEY)] }, values };
  }

  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) return { message: tStore("deleteFailed"), values };

  revalidatePath("/", "layout");
  return redirect({ href: "/mulai", locale: await getLocale() });
}
