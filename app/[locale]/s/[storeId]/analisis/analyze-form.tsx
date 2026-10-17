"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { analyzeStoreAction, type AnalyzeState } from "./actions";

export function AnalyzeForm({ storeId, disabled }: { storeId: string; disabled: boolean }) {
  const t = useTranslations("Analysis");
  const [state, formAction] = useActionState<AnalyzeState, FormData>(
    (prev) => analyzeStoreAction(storeId, prev),
    undefined,
  );
  const ok = state?.status === "created" || state?.status === "cached";

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton pendingText={t("analyzing")} disabled={disabled} className="w-full sm:w-auto">
        {t("analyze")}
      </SubmitButton>
      {/* Both regions stay mounted so screen readers announce the text when it appears. */}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {ok ? state.message : ""}
      </p>
      <p role="alert" className="text-sm text-destructive">
        {state && !ok ? state.message : ""}
      </p>
    </form>
  );
}
