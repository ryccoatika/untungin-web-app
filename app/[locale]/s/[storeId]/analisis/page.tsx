import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { refsFromStoreData, sanitizeOutput } from "@/lib/ai/output";
import { remainingQuota, startOfJakartaDay } from "@/lib/ai/quota";
import { buildSnapshot, snapshotHash } from "@/lib/ai/snapshot";
import { requireUser } from "@/lib/auth/require-user";
import { tryAnalyzeStore } from "@/lib/calc";
import { PLAN_LIMITS, toPlan } from "@/lib/config/plans";
import { countUsageSince, listAnalyses } from "@/lib/data/analyses";
import { loadStoreData } from "@/lib/data/load-store-data";
import { getStore } from "@/lib/data/stores";
import { formatDateTime } from "@/lib/format";
import { AnalysisView } from "./analysis-view";
import { AnalyzeForm } from "./analyze-form";

/** The Server Action waits up to 30 s for Gemini (spec §6.1 step 5). */
export const maxDuration = 60;

const HISTORY_SIZE = 10;

type Props = { params: Promise<{ locale: string; storeId: string }> };

export default async function AnalysisPage({ params }: Props) {
  const { storeId } = await params;
  const [store, data] = await Promise.all([getStore(storeId), loadStoreData(storeId)]);
  if (!store || !data) notFound();
  const t = await getTranslations("Analysis");
  const locale = (await getLocale()) as AppLocale;
  const { supabase, userId } = await requireUser();

  const { analysis } = tryAnalyzeStore(data);
  const header = (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
    </div>
  );

  if (analysis && analysis.lines.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <Link href={`/s/${data.store.id}/produk`} className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const [analyses, used, profile] = await Promise.all([
    listAnalyses(supabase, data.store.id, HISTORY_SIZE + 1),
    countUsageSince(supabase, startOfJakartaDay(new Date())),
    supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
  ]);
  const limit = PLAN_LIMITS[toPlan(profile.data?.plan)].aiAnalysesPerDay;
  const remaining = remainingQuota(limit, used);
  // buildSnapshot throws on a non-finite number; the stale note is optional, so the page must survive it.
  let currentHash: string | null = null;
  if (analysis) {
    try {
      currentHash = snapshotHash(
        buildSnapshot(data, analysis, { businessType: store.business_type, targetMarket: store.target_market }, locale),
      );
    } catch (error) {
      console.error("analysis snapshot failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
  const refs = refsFromStoreData(data);
  const productName = (id: string) => data.products.find((product) => product.id === id)?.name ?? "?";
  const [latest, ...older] = analyses;

  const view = (stored: (typeof analyses)[number]) => {
    const output = sanitizeOutput(stored.output, refs);
    return output ? (
      <AnalysisView output={output} storeId={data.store.id} productName={productName} />
    ) : (
      <p className="text-sm text-muted-foreground">{t("unreadable")}</p>
    );
  };

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardContent className="space-y-3 pt-6">
          {analysis === null && (
            <p role="alert" className="text-sm text-destructive">
              {t("calcError")}
            </p>
          )}
          <p className="text-sm font-medium" data-testid="ai-quota">
            {t("quota", { remaining, limit })}
          </p>
          <AnalyzeForm storeId={data.store.id} disabled={remaining === 0 || analysis === null} />
          {remaining === 0 && <p className="text-sm text-muted-foreground">{t("quotaUsedUp")}</p>}
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        </CardContent>
      </Card>

      {latest ? (
        <Card>
          <CardHeader className="space-y-1">
            <h2 className="font-heading text-base leading-snug font-medium">{t("latest")}</h2>
            <p className="text-xs text-muted-foreground">{t("createdAt", { date: formatDateTime(latest.createdAt, locale) })}</p>
            {currentHash !== null && latest.snapshotHash !== currentHash && (
              <p className="text-sm text-amber-700 dark:text-amber-300">{t("stale")}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {view(latest)}
            <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      )}

      {older.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("history")}</h2>
          {older.map((stored) => (
            <details key={stored.id} className="rounded-lg border p-3">
              <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">
                {t("createdAt", { date: formatDateTime(stored.createdAt, locale) })}
              </summary>
              <div className="pt-3">{view(stored)}</div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
