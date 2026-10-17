"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/components/forms/field-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccountAction } from "@/lib/account/actions";

export function DeleteAccountForm({ email }: { email: string }) {
  const t = useTranslations("Account");
  const [state, formAction] = useActionState(deleteAccountAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t.rich("deleteWarning", {
          email,
          addr: (chunks) => <span className="font-medium text-foreground [overflow-wrap:anywhere]">{chunks}</span>,
        })}
      </p>
      <div className="space-y-1">
        <Label htmlFor="confirmEmail">{t("confirmLabel")}</Label>
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="email"
          autoComplete="off"
          defaultValue={state?.values?.confirmEmail}
          required
        />
        <FieldError errors={state?.fieldErrors?.confirmEmail} />
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
