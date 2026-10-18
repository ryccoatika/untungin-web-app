"use server";

import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { runAnalysis, type AnalyzeStatus } from "@/lib/ai/analyze";
import { createGeminiGenerate, geminiModel } from "@/lib/ai/gemini";
import { startOfJakartaDay } from "@/lib/ai/quota";
import { buildSnapshot } from "@/lib/ai/snapshot";
import { requireUser } from "@/lib/auth/require-user";
import { tryAnalyzeStore } from "@/lib/calc";
import { PLAN_LIMITS, toPlan } from "@/lib/config/plans";
import { listAnalyses } from "@/lib/data/analyses";
import { loadConsents, recordConsent } from "@/lib/data/consents";
import { loadStoreData } from "@/lib/data/load-store-data";
import { revalidateStore } from "@/lib/data/revalidate";
import { getStore } from "@/lib/data/stores";
import { hasAgreed } from "@/lib/legal/consent";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { isUuid } from "@/lib/uuid";

export type AnalyzeState =
  | { status: AnalyzeStatus | "notConfigured" | "unavailable" | "needsConsent"; message: string }
  | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state and the form
export async function analyzeStoreAction(storeId: string, _prev: AnalyzeState, _formData?: FormData): Promise<AnalyzeState> {
  const t = await getTranslations("Analysis.result");
  const unavailable = { status: "unavailable", message: t("unavailable") } as const;
  if (!isUuid(storeId)) return unavailable;

  // Outside the try: a missing session redirects to the login page.
  const { supabase, userId } = await requireUser();
  try {
    // No data leaves for Gemini without agreement to the current AI terms, whatever the client did (spec "My calls"
    // 5). Checked first: before the store is loaded, any quota is claimed or the cached-result path runs.
    if (!hasAgreed(await loadConsents(), "ai")) return { status: "needsConsent", message: t("needsConsent") };

    // Loading with the user's client proves ownership (RLS) before any secret-key call.
    const [store, data] = await Promise.all([getStore(storeId), loadStoreData(storeId)]);
    if (!store || !data) return unavailable;
    const { analysis } = tryAnalyzeStore(data);
    if (!analysis || analysis.lines.length === 0) return unavailable;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || !process.env.SUPABASE_SECRET_KEY) return { status: "notConfigured", message: t("notConfigured") };

    const locale = (await getLocale()) as AppLocale;
    const snapshot = buildSnapshot(data, analysis, { businessType: store.business_type, targetMarket: store.target_market }, locale);
    const { data: profile, error: profileError } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    const limit = PLAN_LIMITS[toPlan(profile?.plan)].aiAnalysesPerDay;
    const admin = createAdminClient();
    const model = geminiModel();

    const status = await runAnalysis(
      {
        latestHash: async () => (await listAnalyses(supabase, storeId, 1))[0]?.snapshotHash ?? null,
        claimUsage: async () => {
          const { data: usageId, error } = await admin.rpc("claim_ai_usage", {
            p_user_id: userId,
            p_since: startOfJakartaDay(new Date()).toISOString(),
            p_limit: limit,
          });
          if (error) throw error;
          return usageId;
        },
        refundUsage: async (usageId) => {
          const { error } = await admin.from("ai_usage").delete().eq("id", usageId).eq("user_id", userId);
          if (error) throw error;
        },
        generate: createGeminiGenerate(apiKey, model),
        save: async ({ snapshotHash, snapshot: input, output }) => {
          const { error } = await admin.from("ai_analyses").insert({
            store_id: storeId,
            user_id: userId,
            model,
            snapshot_hash: snapshotHash,
            input_snapshot: input as unknown as NonNullable<Json>,
            output: output as unknown as NonNullable<Json>,
          });
          if (error) throw error;
        },
      },
      snapshot,
    );

    if (status === "created" || status === "quota") revalidateStore();
    return { status, message: t(status) };
  } catch (error) {
    // Only the message: the snapshot holds the seller's data.
    console.error(`AI analysis failed before the AI call: ${error instanceof Error ? error.message : String(error)}`);
    return { status: "failed", message: t("failed") };
  }
}

/**
 * Records agreement to the current AI terms (the consent dialog); the form then runs the analysis. An agreement
 * already on record (another tab, a double tap) isn't stored twice.
 */
export async function acceptAiTermsAction(): Promise<{ ok: boolean; message?: string }> {
  const { supabase, userId } = await requireUser();
  try {
    if (!hasAgreed(await loadConsents(), "ai")) await recordConsent(supabase, userId, "ai");
    return { ok: true };
  } catch (error) {
    console.error(`Recording AI consent failed: ${error instanceof Error ? error.message : String(error)}`);
    const t = await getTranslations("Analysis.consent");
    return { ok: false, message: t("failed") };
  }
}
