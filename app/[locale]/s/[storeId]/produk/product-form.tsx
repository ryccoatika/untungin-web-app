"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/forms";

export type ProductFormDefaults = Partial<Record<"name" | "category" | "yieldQty" | "targetMarginPct" | "isActive", string>>;

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  mode: "create" | "edit";
  /** The store's target margin, already formatted (e.g. "40%"). */
  storeTargetMargin: string;
  defaults?: ProductFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  id?: string;
};

export function ProductForm({ action, mode, storeTargetMargin, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Products");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};
  const field = (name: string) => `${id ?? "product"}-${name}`;

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={field("name")}>{t("name")}</Label>
          <Input id={field("name")} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={80} />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("yield")}>{t("yieldQty")}</Label>
          <Input id={field("yield")} name="yieldQty" inputMode="decimal" defaultValue={current.yieldQty ?? "1"} />
          <p className="text-xs text-muted-foreground">{t("yieldHint")}</p>
          <FieldError errors={errors.yieldQty} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("category")}>{t("category")}</Label>
          <Input
            id={field("category")}
            name="category"
            defaultValue={current.category}
            placeholder={t("categoryPlaceholder")}
            maxLength={40}
          />
          <FieldError errors={errors.category} />
        </div>
        {mode === "create" ? (
          <input type="hidden" name="isActive" value="true" />
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor={field("margin")}>{t("targetMargin")}</Label>
              <Input id={field("margin")} name="targetMarginPct" inputMode="decimal" defaultValue={current.targetMarginPct} />
              <p className="text-xs text-muted-foreground">{t("targetMarginHint", { pct: storeTargetMargin })}</p>
              <FieldError errors={errors.targetMarginPct} />
            </div>
            <label className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={current.isActive === "on" || current.isActive === "true"}
                className="size-5 accent-primary"
              />
              {t("isActive")}
            </label>
          </>
        )}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
