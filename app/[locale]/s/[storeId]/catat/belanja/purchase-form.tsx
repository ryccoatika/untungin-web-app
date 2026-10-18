"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type FormEvent } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { MoneyInput } from "@/components/forms/money-input";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { dimensionOf, unitsOf, type Unit } from "@/lib/calc";
import { formatDay, formatNumber, formatRupiah } from "@/lib/format";
import type { FormAction } from "@/lib/forms";
import { newPurchasePrice } from "@/lib/records";
import { purchaseInputSchema } from "@/lib/validation/purchase";

export type PurchaseMaterial = { id: string; name: string; purchaseQty: number; purchaseUnit: Unit; purchasePrice: number };
export type PurchaseDefaults = Partial<Record<"materialId" | "qty" | "unit" | "totalPaid" | "date", string>>;

type Props = {
  action: FormAction;
  materials: PurchaseMaterial[];
  /** Latest purchase date per material id, leaving out the purchase being edited. */
  latestDates: Record<string, string>;
  defaults: PurchaseDefaults;
  today: string;
  min: string;
  /** Edit mode: the material is fixed and a link leaves the edit. */
  editing?: { cancelHref: string };
};

export function PurchaseForm({ action, materials, latestDates, defaults, today, min, editing }: Props) {
  const t = useTranslations("Records.purchases");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  return (
    <form id="purchase-form" action={formAction} className="space-y-4">
      <PurchaseFields
        key={key}
        materials={materials}
        latestDates={latestDates}
        defaults={state?.values ?? defaults}
        errors={state?.fieldErrors ?? {}}
        today={today}
        min={min}
        fixedMaterial={editing !== undefined}
      />
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="w-full sm:w-auto" pendingText={t("saving")}>
          {editing ? t("saveEdit") : t("save")}
        </SubmitButton>
        {editing && (
          <Link href={editing.cancelHref} className="inline-flex min-h-10 items-center text-sm underline underline-offset-4">
            {t("cancelEdit")}
          </Link>
        )}
      </div>
    </form>
  );
}

type FieldsProps = Pick<Props, "materials" | "latestDates" | "today" | "min"> & {
  defaults: PurchaseDefaults;
  errors: Record<string, string[] | undefined>;
  fixedMaterial: boolean;
};

function PurchaseFields({ materials, latestDates, defaults, errors, today, min, fixedMaterial }: FieldsProps) {
  const t = useTranslations("Records.purchases");
  const tUnits = useTranslations("Units");
  const tUnitShort = useTranslations("UnitShort");
  const locale = useLocale() as AppLocale;

  const [materialId, setMaterialId] = useState(defaults.materialId ?? "");
  const [unit, setUnit] = useState(defaults.unit ?? "");
  const material = materials.find((m) => m.id === materialId);
  // Only units of the material's dimension; household units are never offered for a purchase.
  const units = material ? unitsOf(dimensionOf(material.purchaseUnit)) : [];

  function previewFor(values: Record<string, unknown>): string | null {
    const parsed = purchaseInputSchema.safeParse(values);
    if (!parsed.success) return null;
    const found = materials.find((m) => m.id === parsed.data.materialId);
    if (!found || dimensionOf(parsed.data.unit) !== dimensionOf(found.purchaseUnit)) return null;
    if (parsed.data.date < min || parsed.data.date > today) return null;
    const pack = { qty: formatNumber(found.purchaseQty, locale), unit: tUnitShort(found.purchaseUnit) };
    const newer = latestDates[found.id];
    if (newer && newer > parsed.data.date) {
      return t("previewKept", { price: formatRupiah(found.purchasePrice, locale), date: formatDay(newer, locale), ...pack });
    }
    const next = newPurchasePrice(found, parsed.data.qty, parsed.data.unit, parsed.data.totalPaid);
    return t("previewChange", {
      material: found.name,
      from: formatRupiah(found.purchasePrice, locale),
      to: formatRupiah(next, locale),
      ...pack,
    });
  }

  const [preview, setPreview] = useState(() => previewFor(defaults));
  function onChange(event: FormEvent<HTMLFieldSetElement>) {
    const form = event.currentTarget.form;
    if (form) setPreview(previewFor(Object.fromEntries(new FormData(form))));
  }

  function chooseMaterial(id: string) {
    setMaterialId(id);
    const chosen = materials.find((m) => m.id === id);
    // Start from the unit the material is bought in.
    setUnit(chosen ? chosen.purchaseUnit : "");
  }

  return (
    <fieldset className="space-y-4" onChange={onChange}>
      <div className="space-y-1">
        <Label htmlFor="purchase-material">{t("material")}</Label>
        {fixedMaterial ? (
          <>
            <input type="hidden" name="materialId" value={materialId} />
            <Input id="purchase-material" value={material?.name ?? ""} readOnly />
            <p className="text-xs text-muted-foreground">{t("materialFixed")}</p>
          </>
        ) : (
          <NativeSelect id="purchase-material" name="materialId" value={materialId} onChange={(event) => chooseMaterial(event.target.value)}>
            <option value="">{t("materialPlaceholder")}</option>
            {materials.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
        )}
        <FieldError errors={errors.materialId} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="space-y-1">
          <Label htmlFor="purchase-qty">{t("qty")}</Label>
          <Input id="purchase-qty" name="qty" inputMode="decimal" defaultValue={defaults.qty} autoComplete="off" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="purchase-unit">{t("unit")}</Label>
          <NativeSelect id="purchase-unit" name="unit" value={unit} disabled={!material} onChange={(event) => setUnit(event.target.value)}>
            {units.map((option) => (
              <option key={option} value={option}>
                {tUnits(option)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="col-span-2 space-y-1 empty:hidden">
          <FieldError errors={errors.qty} />
          <FieldError errors={errors.unit} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="purchase-total">{t("total")}</Label>
        <MoneyInput id="purchase-total" name="totalPaid" defaultValue={defaults.totalPaid} placeholder={t("totalPlaceholder")} />
        <FieldError errors={errors.totalPaid} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="purchase-date">{t("date")}</Label>
        <Input id="purchase-date" type="date" name="date" defaultValue={defaults.date ?? today} min={min} max={today} className="h-11 w-auto min-w-40" />
        <FieldError errors={errors.date} />
      </div>
      <p aria-live="polite" data-testid="price-preview" className="min-h-5 text-sm font-medium [overflow-wrap:anywhere]">
        {preview}
      </p>
    </fieldset>
  );
}
