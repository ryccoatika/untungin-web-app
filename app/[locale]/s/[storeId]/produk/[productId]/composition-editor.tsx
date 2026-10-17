"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { BASE_UNIT, BASES, dimensionOf, unitsOf, type Basis, type MaterialCategory, type Unit } from "@/lib/calc";
import { formatRupiah } from "@/lib/format";
import type { FormAction } from "@/lib/forms";

export type EditorMaterial = { id: string; name: string; category: MaterialCategory; purchaseUnit: Unit };
export type EditorRow = {
  id: string;
  materialId: string;
  materialName: string;
  qty: number;
  unit: Unit;
  basis: Basis;
  channelName: string | null;
  /** Cost of this row per sold unit (batch rows already divided by the yield). */
  costPerUnit: number;
};
export type EditorChannel = { id: string; name: string };

type Props = {
  rows: EditorRow[];
  channels: EditorChannel[];
  materials: EditorMaterial[];
  addAction: FormAction;
  updateActions: Record<string, FormAction>;
  deleteActions: Record<string, FormAction>;
  materialsHref: string;
};

export function CompositionEditor({ rows, channels, materials, addAction, updateActions, deleteActions, materialsHref }: Props) {
  const t = useTranslations("Composition");
  const materialsById = new Map(materials.map((material) => [material.id, material]));

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <RowEditor
              key={row.id}
              row={row}
              material={materialsById.get(row.materialId)}
              updateAction={updateActions[row.id]}
              deleteAction={deleteActions[row.id]}
            />
          ))}
        </ul>
      )}
      {materials.length === 0 ? (
        <p className="text-sm">
          {t("noMaterials")}{" "}
          <Link href={materialsHref} className="font-medium underline underline-offset-4">
            {t("goToMaterials")}
          </Link>
        </p>
      ) : (
        <AddRowForm materials={materials} channels={channels} action={addAction} />
      )}
    </div>
  );
}

function RowEditor({
  row,
  material,
  updateAction,
  deleteAction,
}: {
  row: EditorRow;
  material: EditorMaterial | undefined;
  updateAction: FormAction;
  deleteAction: FormAction;
}) {
  const t = useTranslations("Composition");
  const tCommon = useTranslations("Common");
  const tUnits = useTranslations("Units");
  const tBasis = useTranslations("Basis");
  const locale = useLocale();
  const [state, formAction] = useActionState(updateAction, undefined);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? { qty: String(row.qty), unit: row.unit, basis: row.basis };
  const errors = state?.fieldErrors ?? {};
  const units = material ? unitsOf(dimensionOf(material.purchaseUnit)) : [row.unit];
  const id = (name: string) => `row-${row.id}-${name}`;

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium [overflow-wrap:anywhere]">{row.materialName}</p>
          {row.channelName && <p className="text-xs text-muted-foreground">{t("onlyChannel", { channel: row.channelName })}</p>}
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">{t("rowCost", { cost: formatRupiah(row.costPerUnit, locale) })}</p>
      </div>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="materialId" value={row.materialId} />
        <fieldset key={key} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-1">
            <Label htmlFor={id("qty")}>{t("qty")}</Label>
            <Input id={id("qty")} name="qty" inputMode="decimal" defaultValue={current.qty} />
            <FieldError errors={errors.qty} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("unit")}>{t("unit")}</Label>
            <NativeSelect id={id("unit")} name="unit" defaultValue={current.unit}>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {tUnits(unit)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.unit} />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label htmlFor={id("basis")}>{t("basis")}</Label>
            <NativeSelect id={id("basis")} name="basis" defaultValue={current.basis}>
              {BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {tBasis(basis)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.basis} />
          </div>
        </fieldset>
        <FormMessage state={state} />
        <SubmitButton variant="outline" aria-label={t("saveRow", { material: row.materialName })} pendingText={tCommon("savePending")}>
          {tCommon("save")}
        </SubmitButton>
      </form>
      <form action={deleteFormAction}>
        <SubmitButton
          variant="ghost"
          className="text-destructive"
          pendingText={tCommon("deletePending")}
          aria-label={t("deleteRow", { material: row.materialName })}
        >
          {tCommon("delete")}
        </SubmitButton>
        {deleteState && !deleteState.ok && <FormMessage state={deleteState} />}
      </form>
    </li>
  );
}

function AddRowForm({ materials, channels, action }: { materials: EditorMaterial[]; channels: EditorChannel[]; action: FormAction }) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Composition");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);

  return (
    <form id="add-composition" action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <AddRowFields key={key} materials={materials} channels={channels} defaults={state?.values ?? {}} errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={tCommon("addPending")}>
        {t("add")}
      </SubmitButton>
    </form>
  );
}

function AddRowFields({
  materials,
  channels,
  defaults,
  errors,
}: {
  materials: EditorMaterial[];
  channels: EditorChannel[];
  defaults: Record<string, string>;
  errors: Record<string, string[] | undefined>;
}) {
  const t = useTranslations("Composition");
  const tUnits = useTranslations("Units");
  const tBasis = useTranslations("Basis");
  const [materialId, setMaterialId] = useState(defaults.materialId ?? "");
  const material = materials.find((candidate) => candidate.id === materialId);
  const echoed = defaults.materialId === materialId;
  const defaultUnit = echoed && defaults.unit ? defaults.unit : material ? BASE_UNIT[dimensionOf(material.purchaseUnit)] : "";
  const defaultBasis = echoed && defaults.basis ? defaults.basis : material?.category === "kemasan" ? "unit" : "batch";

  return (
    <fieldset className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="composition-material">{t("material")}</Label>
        <NativeSelect
          id="composition-material"
          name="materialId"
          value={materialId}
          onChange={(event) => setMaterialId(event.target.value)}
        >
          {/* Not disabled: a form reset after the action selects the first enabled option, which must be this one. */}
          <option value="">
            {t("materialPlaceholder")}
          </option>
          {materials.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError errors={errors.materialId} />
      </div>
      {material && (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="space-y-1">
                <Label htmlFor="composition-qty">{t("qty")}</Label>
                <Input id="composition-qty" name="qty" inputMode="decimal" defaultValue={echoed ? defaults.qty : undefined} />
                <FieldError errors={errors.qty} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="composition-unit">{t("unit")}</Label>
                {/* Keyed by material so the default follows the chosen material. */}
                <NativeSelect key={`unit-${materialId}`} id="composition-unit" name="unit" defaultValue={defaultUnit}>
                  {unitsOf(dimensionOf(material.purchaseUnit)).map((unit) => (
                    <option key={unit} value={unit}>
                      {tUnits(unit)}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError errors={errors.unit} />
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor="composition-basis">{t("basis")}</Label>
                <NativeSelect key={`basis-${materialId}`} id="composition-basis" name="basis" defaultValue={defaultBasis}>
                  {BASES.map((basis) => (
                    <option key={basis} value={basis}>
                      {tBasis(basis)}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError errors={errors.basis} />
              </div>
            </div>
          {channels.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="composition-channel">{t("channel")}</Label>
              <NativeSelect id="composition-channel" name="channelId" defaultValue={echoed ? (defaults.channelId ?? "") : ""}>
                <option value="">{t("allChannels")}</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">{t("channelHint")}</p>
              <FieldError errors={errors.channelId} />
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
