"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import type { FormState } from "@/lib/forms";
import { isUuid } from "@/lib/uuid";
import {
  confirmationMatches,
  DUPLICATE_STORE_NAME_MESSAGE,
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
  if (!isUuid(storeId)) return { message: "Toko tidak ditemukan.", values };

  const parsed = storeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("stores")
    .update(toStoreColumns(parsed.data))
    .eq("id", storeId)
    .select("id");

  if (error?.code === "23505") {
    return { fieldErrors: { name: [DUPLICATE_STORE_NAME_MESSAGE] }, values };
  }
  if (error || !data?.length) {
    return { message: "Gagal menyimpan. Coba lagi.", values };
  }

  revalidatePath(`/${await getLocale()}/s/${storeId}`, "layout");
  return { ok: true, message: "Perubahan tersimpan.", values };
}

export async function deleteStoreAction(
  storeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = rawValues(formData, ["confirmName"]);
  if (!isUuid(storeId)) return { message: "Toko tidak ditemukan.", values };

  const { supabase } = await requireUser();
  const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return { message: "Toko tidak ditemukan.", values };

  const confirmation = String(formData.get("confirmName") ?? "");
  if (!confirmationMatches(confirmation, store.name)) {
    return { fieldErrors: { confirmName: ["Nama toko tidak cocok."] }, values };
  }

  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) return { message: "Gagal menghapus toko. Coba lagi.", values };

  const locale = await getLocale();
  revalidatePath(`/${locale}`, "layout");
  return redirect({ href: "/mulai", locale });
}
