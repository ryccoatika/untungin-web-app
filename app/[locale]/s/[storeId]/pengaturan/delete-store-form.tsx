"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/forms/field-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteStoreAction } from "./actions";

export function DeleteStoreForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const t = useTranslations("Settings");
  const [state, formAction] = useActionState(deleteStoreAction.bind(null, storeId), undefined);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t.rich("deleteWarning", {
          storeName,
          name: (chunks) => (
            <span className="font-medium text-foreground [overflow-wrap:anywhere]">{chunks}</span>
          ),
        })}
      </p>
      <div className="space-y-1">
        <Label htmlFor="confirmName">{t("confirmLabel")}</Label>
        <Input
          id="confirmName"
          name="confirmName"
          autoComplete="off"
          defaultValue={state?.values?.confirmName}
          required
        />
        <FieldError errors={state?.fieldErrors?.confirmName} />
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <SubmitButton variant="destructive" pendingText={t("deletePending")}>
        {t("deleteSubmit")}
      </SubmitButton>
    </form>
  );
}
