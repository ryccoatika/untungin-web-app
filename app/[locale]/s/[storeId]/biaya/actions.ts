"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateStore } from "@/lib/data/revalidate";
import { type FormState } from "@/lib/forms";
import { parseForm } from "@/lib/forms-server";
import { isUuid } from "@/lib/uuid";
import { expenseInputSchema, toExpenseColumns } from "@/lib/validation/expense";

const FIELDS = ["name", "category", "amount", "frequency"] as const;

export async function createExpenseAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(expenseInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("operating_expenses").insert({ store_id: storeId, ...toExpenseColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Expenses"))("created") };
}

export async function updateExpenseAction(
  storeId: string,
  expenseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(expenseInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(expenseId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("operating_expenses")
    .update(toExpenseColumns(parsed.input))
    .eq("id", expenseId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteExpenseAction(storeId: string, expenseId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(expenseId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("operating_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/biaya`, locale: await getLocale() });
}
