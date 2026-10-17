"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import type { FormState } from "@/lib/forms";

const MAX_NAME_LENGTH = 80;

/** Saves the owner's name shown on the summary: profiles.full_name of the signed-in user only. */
export async function saveOwnerNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations("Report");
  const raw = formData.get("ownerName");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return { fieldErrors: { ownerName: [t("ownerNameError")] }, values: { ownerName: typeof raw === "string" ? raw : "" } };
  }
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.from("profiles").update({ full_name: name }).eq("id", userId).select("id");
  if (error || !data?.length) return { message: t("ownerNameSaveFailed"), values: { ownerName: name } };
  revalidatePath("/[locale]/s/[storeId]/ringkasan", "page");
  return { ok: true, message: t("ownerNameSaved"), values: { ownerName: name } };
}
