"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormAction } from "@/lib/forms";

export type ChannelFormDefaults = Partial<Record<"name" | "commissionPct" | "fixedFee", string>>;

type Props = { action: FormAction; defaults?: ChannelFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function ChannelForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Channels");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};
  const field = (name: string) => `${id ?? "channel"}-${name}`;

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={field("name")}>{t("name")}</Label>
          <Input id={field("name")} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={60} />
          <FieldError errors={errors.name} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={field("commission")}>{t("commissionPct")}</Label>
            <Input id={field("commission")} name="commissionPct" inputMode="decimal" defaultValue={current.commissionPct ?? "0"} />
            <FieldError errors={errors.commissionPct} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={field("fee")}>{t("fixedFee")}</Label>
            <Input id={field("fee")} name="fixedFee" inputMode="numeric" defaultValue={current.fixedFee ?? "0"} />
            <FieldError errors={errors.fixedFee} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("feeHint")}</p>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
