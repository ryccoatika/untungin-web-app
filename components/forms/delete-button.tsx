"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FormAction } from "@/lib/forms";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

/** Two-step delete: the first click asks for confirmation, the second runs `action`. */
export function DeleteButton({ action, label }: { action: FormAction; label: string }) {
  const t = useTranslations("Common");
  const [state, formAction] = useActionState(action, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
          {label}
        </Button>
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm">{t("deleteConfirm")}</p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="destructive" autoFocus pendingText={t("deletePending")}>
          {label}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          {t("cancel")}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
