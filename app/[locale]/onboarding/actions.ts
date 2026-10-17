"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { canCreateStore, PLAN_LIMITS, toPlan } from "@/lib/config/plans";
import { rawValues, type FormState } from "@/lib/forms";
import { buildDemoStore, seedDemoStore, STORE_LIMIT_ERROR_CODE } from "@/lib/seed/demo-store";
import type { AppLocale } from "@/i18n/routing";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { DUPLICATE_STORE_NAME_KEY, storeInputSchema } from "@/lib/validation/store";

const STORE_FIELD_NAMES = [
  "name",
  "businessType",
  "targetMarket",
  "operatingDaysPerMonth",
  "targetMarginPct",
] as const;

export async function createStoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = rawValues(formData, STORE_FIELD_NAMES);
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

  return redirect({ href: `/s/${storeId}/dashboard?welcome=1`, locale: await getLocale() });
}

const MAX_NAME_ATTEMPTS = 5;

export async function createDemoStoreAction(): Promise<FormState> {
  const tStore = await getTranslations("Store");
  const tOnboarding = await getTranslations("Onboarding");
  const { supabase, userId } = await requireUser();

  const [profile, stores] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).single(),
    supabase.from("stores").select("id", { count: "exact", head: true }),
  ]);
  if (profile.error || stores.error) return { message: tOnboarding("demoFailed") };
  const plan = toPlan(profile.data?.plan);
  const limitMessage = tStore("limitReached", { max: PLAN_LIMITS[plan].maxStores });
  if (!canCreateStore(plan, stores.count ?? 0)) return { message: limitMessage };

  const locale = (await getLocale()) as AppLocale;
  const demo = buildDemoStore(locale);
  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    const name = attempt === 1 ? demo.store.name : `${demo.store.name} ${attempt}`;
    const result = await seedDemoStore(supabase, demo, name);
    if ("storeId" in result) {
      return redirect({ href: `/s/${result.storeId}/dashboard?welcome=1`, locale });
    }
    if (result.error === "limit") return { message: limitMessage };
    if (result.error === "failed") return { message: tOnboarding("demoFailed") };
  }
  return { message: tOnboarding("demoFailed") };
}
