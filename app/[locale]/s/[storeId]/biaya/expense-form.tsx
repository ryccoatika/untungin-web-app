"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES, FREQUENCIES } from "@/lib/calc";
import type { FormAction } from "@/lib/forms";

export type ExpenseFormDefaults = Partial<Record<"name" | "category" | "amount" | "frequency", string>>;


type Props = { action: FormAction; defaults?: ExpenseFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function ExpenseForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Expenses");
  const tCategory = useTranslations("ExpenseCategory");
  const tFrequency = useTranslations("Frequency");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={`${id ?? "expense"}-name`}>{t("name")}</Label>
          <Input id={`${id ?? "expense"}-name`} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={80} />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id ?? "expense"}-category`}>{t("category")}</Label>
          <NativeSelect id={`${id ?? "expense"}-category`} name="category" defaultValue={current.category ?? "sewa"}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.category} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${id ?? "expense"}-amount`}>{t("amount")}</Label>
            <Input id={`${id ?? "expense"}-amount`} name="amount" inputMode="numeric" defaultValue={current.amount} placeholder={t("amountPlaceholder")} />
            <FieldError errors={errors.amount} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id ?? "expense"}-frequency`}>{t("frequency")}</Label>
            <NativeSelect id={`${id ?? "expense"}-frequency`} name="frequency" defaultValue={current.frequency ?? "bulanan"}>
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {tFrequency(frequency)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.frequency} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("oneTimeHint")}</p>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
