"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { createDemoStoreAction } from "./actions";

export function DemoStoreButton() {
  const t = useTranslations("Onboarding");
  const [state, formAction] = useActionState(createDemoStoreAction, undefined);
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="font-medium">{t("demoTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("demoBody")}</p>
      <SubmitButton variant="outline" className="w-full" pendingText={t("demoPending")}>
        {t("demoButton")}
      </SubmitButton>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
