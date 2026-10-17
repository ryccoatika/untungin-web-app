"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type FormEvent } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_UNIT, dimensionOf, MATERIAL_CATEGORIES, UNITS, unitCost } from "@/lib/calc";
import { formatRupiah } from "@/lib/format";
import type { FormAction } from "@/lib/forms";
import { materialInputSchema } from "@/lib/validation/material";

export type MaterialFormDefaults = Partial<
  Record<"name" | "category" | "purchaseQty" | "purchaseUnit" | "purchasePrice" | "wastePct", string>
>;


type Props = { action: FormAction; defaults?: MaterialFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function MaterialForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  return (
    <form id={id} action={formAction} className="space-y-4">
      <MaterialFields key={key} defaults={state?.values ?? defaults} errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

function MaterialFields({ defaults, errors }: { defaults: MaterialFormDefaults; errors: Record<string, string[] | undefined> }) {
  const t = useTranslations("Materials");
  const tUnits = useTranslations("Units");
  const tUnitShort = useTranslations("UnitShort");
  const tCategory = useTranslations("MaterialCategory");
  const locale = useLocale();

  function preview(values: Record<string, unknown>): string | null {
    const parsed = materialInputSchema.safeParse(values);
    if (!parsed.success) return null;
    const unit = tUnitShort(BASE_UNIT[dimensionOf(parsed.data.purchaseUnit)]);
    return t("costPreview", { cost: formatRupiah(unitCost(parsed.data), locale, 2), unit });
  }

  const [cost, setCost] = useState(() => preview(defaults));
  function onChange(event: FormEvent<HTMLFieldSetElement>) {
    const form = event.currentTarget.form;
    if (form) setCost(preview(Object.fromEntries(new FormData(form))));
  }

  return (
    <fieldset className="space-y-4" onChange={onChange}>
      <div className="space-y-1">
        <Label htmlFor="material-name">{t("name")}</Label>
        <Input id="material-name" name="name" defaultValue={defaults.name} placeholder={t("namePlaceholder")} maxLength={80} />
        <FieldError errors={errors.name} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="material-category">{t("category")}</Label>
        <NativeSelect id="material-category" name="category" defaultValue={defaults.category ?? "bahan"}>
          {MATERIAL_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {tCategory(category)}
            </option>
          ))}
        </NativeSelect>
        <FieldError errors={errors.category} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="space-y-1">
          <Label htmlFor="material-qty">{t("purchaseQty")}</Label>
          <Input id="material-qty" name="purchaseQty" inputMode="decimal" defaultValue={defaults.purchaseQty} />
          <FieldError errors={errors.purchaseQty} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="material-unit">{t("purchaseUnit")}</Label>
          <NativeSelect id="material-unit" name="purchaseUnit" defaultValue={defaults.purchaseUnit ?? "kg"}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {tUnits(unit)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.purchaseUnit} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="material-price">{t("purchasePrice")}</Label>
        <Input id="material-price" name="purchasePrice" inputMode="numeric" defaultValue={defaults.purchasePrice} placeholder={t("pricePlaceholder")} />
        <FieldError errors={errors.purchasePrice} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="material-waste">{t("wastePct")}</Label>
        <Input id="material-waste" name="wastePct" inputMode="decimal" defaultValue={defaults.wastePct} placeholder="0" />
        <p className="text-xs text-muted-foreground">{t("wasteHint")}</p>
        <FieldError errors={errors.wastePct} />
      </div>
      <p aria-live="polite" className="min-h-5 text-sm font-medium">
        {cost}
      </p>
    </fieldset>
  );
}
