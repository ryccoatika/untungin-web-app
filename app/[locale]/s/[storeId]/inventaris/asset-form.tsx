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
import { ASSET_CATEGORIES } from "@/lib/calc";
import type { FormAction } from "@/lib/forms";

export type AssetFormDefaults = Partial<Record<"name" | "category" | "qty" | "unitPrice" | "usefulLifeMonths", string>>;


type Props = { action: FormAction; defaults?: AssetFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function AssetForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Assets");
  const tCategory = useTranslations("AssetCategory");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};
  const field = (name: string) => `${id ?? "asset"}-${name}`;

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={field("name")}>{t("name")}</Label>
          <Input id={field("name")} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={80} />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("category")}>{t("category")}</Label>
          <NativeSelect id={field("category")} name="category" defaultValue={current.category ?? "peralatan"}>
            {ASSET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.category} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
          <div className="space-y-1">
            <Label htmlFor={field("qty")}>{t("qty")}</Label>
            <Input id={field("qty")} name="qty" inputMode="numeric" defaultValue={current.qty ?? "1"} />
            <FieldError errors={errors.qty} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={field("unitPrice")}>{t("unitPrice")}</Label>
            <Input id={field("unitPrice")} name="unitPrice" inputMode="numeric" defaultValue={current.unitPrice} placeholder={t("unitPricePlaceholder")} />
            <FieldError errors={errors.unitPrice} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("life")}>{t("usefulLife")}</Label>
          <Input id={field("life")} name="usefulLifeMonths" inputMode="numeric" defaultValue={current.usefulLifeMonths} placeholder="24" />
          <p className="text-xs text-muted-foreground">{t("usefulLifeHint")}</p>
          <FieldError errors={errors.usefulLifeMonths} />
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
