"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { acceptTermsAction } from "./actions";

export function AgreeForm({ next }: { next: string }) {
  const t = useTranslations("Terms");
  const [state, formAction] = useActionState(acceptTermsAction.bind(null, next), undefined);
  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton className="w-full" pendingText={t("agree.pending")}>
        {t("agree.submit")}
      </SubmitButton>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
