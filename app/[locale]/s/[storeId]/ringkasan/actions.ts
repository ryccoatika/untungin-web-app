"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import type { FormState } from "@/lib/forms";
import { MAX_OWNER_NAME_LENGTH } from "@/lib/report/installment";

/** Saves the owner's name shown on the summary (empty clears it): profiles.full_name of the signed-in user only. */
export async function saveOwnerNameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Session first: an unauthenticated call redirects instead of getting a field error.
  const { supabase, userId } = await requireUser();
  const t = await getTranslations("Report");
  const raw = formData.get("ownerName");
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length > MAX_OWNER_NAME_LENGTH) {
    return { fieldErrors: { ownerName: [t("ownerNameError", { max: MAX_OWNER_NAME_LENGTH })] }, values: { ownerName: typeof raw === "string" ? raw : "" } };
  }
  const { data, error } = await supabase.from("profiles").update({ full_name: name === "" ? null : name }).eq("id", userId).select("id");
  if (error || !data?.length) return { message: t("ownerNameSaveFailed"), values: { ownerName: name } };
  revalidatePath("/[locale]/s/[storeId]/ringkasan", "page");
  return { ok: true, message: t("ownerNameSaved"), values: { ownerName: name } };
}
