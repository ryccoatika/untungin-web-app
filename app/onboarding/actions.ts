"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { canCreateStore, PLAN_LIMITS, toPlan } from "@/lib/config/plans";
import type { FormState } from "@/lib/forms";
import { DUPLICATE_STORE_NAME_MESSAGE, storeInputSchema } from "@/lib/validation/store";

const STORE_FIELD_NAMES = [
  "name",
  "businessType",
  "targetMarket",
  "operatingDaysPerMonth",
  "targetMarginPct",
] as const;

function rawValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of STORE_FIELD_NAMES) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

export async function createStoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = rawValues(formData);
  const parsed = storeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { supabase, userId } = await requireUser();

  const [profile, stores] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).single(),
    supabase.from("stores").select("id", { count: "exact", head: true }),
  ]);
  const plan = toPlan(profile.data?.plan);
  if (!canCreateStore(plan, stores.count ?? 0)) {
    return {
      message: `Batas jumlah toko untuk paketmu sudah tercapai (maksimal ${PLAN_LIMITS[plan].maxStores} toko).`,
      values,
    };
  }

  const input = parsed.data;
  const { data: storeId, error } = await supabase.rpc("create_store", {
    p_name: input.name,
    p_business_type: input.businessType,
    p_operating_days: input.operatingDaysPerMonth,
    p_target_margin: input.targetMarginPct,
    p_target_market: input.targetMarket ?? undefined,
  });

  if (error?.code === "23505") {
    return { fieldErrors: { name: [DUPLICATE_STORE_NAME_MESSAGE] }, values };
  }
  if (error || !storeId) {
    return { message: "Gagal membuat toko. Coba lagi.", values };
  }

  redirect(`/s/${storeId}/dashboard`);
}
