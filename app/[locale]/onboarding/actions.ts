"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { canCreateStore, PLAN_LIMITS, toPlan } from "@/lib/config/plans";
import type { FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { DUPLICATE_STORE_NAME_KEY, storeInputSchema } from "@/lib/validation/store";

// SQLSTATE raised by the stores_enforce_limit trigger (20261016000003_store_limit.sql).
const STORE_LIMIT_ERROR_CODE = "UT001";

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
  const tValidation = await getValidationTranslator();
  const tStore = await getTranslations("Store");
  const parsed = storeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation), values };
  }

  const { supabase, userId } = await requireUser();

  const [profile, stores] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).single(),
    supabase.from("stores").select("id", { count: "exact", head: true }),
  ]);
  if (profile.error || stores.error) {
    return { message: tStore("createFailed"), values };
  }
  const plan = toPlan(profile.data?.plan);
  const limitMessage = tStore("limitReached", { max: PLAN_LIMITS[plan].maxStores });
  if (!canCreateStore(plan, stores.count ?? 0)) {
    return { message: limitMessage, values };
  }

  const input = parsed.data;
  const { data: storeId, error } = await supabase.rpc("create_store", {
    p_name: input.name,
    p_business_type: input.businessType,
    p_operating_days: input.operatingDaysPerMonth,
    p_target_margin: input.targetMarginPct,
    p_target_market: input.targetMarket ?? undefined,
    p_default_channel_name: tStore("defaultChannelName"),
  });

  if (error?.code === "23505") {
    return { fieldErrors: { name: [tValidation(DUPLICATE_STORE_NAME_KEY)] }, values };
  }
  if (error?.code === STORE_LIMIT_ERROR_CODE) {
    return { message: limitMessage, values };
  }
  if (error || !storeId) {
    return { message: tStore("createFailed"), values };
  }

  return redirect({ href: `/s/${storeId}/dashboard`, locale: await getLocale() });
}
