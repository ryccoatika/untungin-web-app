"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveOwnerNameAction } from "./actions";

/** The name printed on the summary for the bank. Saved to the user's profile. */
export function OwnerNameForm({ current }: { current: string }) {
  const t = useTranslations("Report");
  const [state, formAction] = useActionState(saveOwnerNameAction, undefined);
  const id = useId();
  const error = state?.fieldErrors?.ownerName;
  return (
    <Card className="print:hidden">
      <CardContent>
        <form action={formAction} className="space-y-2">
          <Label htmlFor={`${id}-owner`}>{t("ownerNameLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${id}-owner`}
              name="ownerName"
              maxLength={200}
              autoComplete="name"
              // Remount on every result so the saved value (not React's reset) fills the field.
              key={state?.values?.ownerName ?? current}
              defaultValue={state?.values?.ownerName ?? current}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-owner-hint`}
              className="min-w-0 flex-1 sm:max-w-sm"
            />
            <SubmitButton pendingText={t("ownerNameSaving")}>{t("ownerNameSave")}</SubmitButton>
          </div>
          <FieldError errors={error} />
          <FormMessage state={state} />
          <p id={`${id}-owner-hint`} className="text-xs text-muted-foreground">
            {t("ownerNameHint")}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
