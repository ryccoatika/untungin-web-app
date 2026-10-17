"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type FormEvent } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { StatusBadge } from "@/components/store/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tryAnalyzeStore, type CalcChannel, type MetricsLine, type StoreData } from "@/lib/calc";
import { formatPercent, formatRupiah } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { priceInputSchema } from "@/lib/validation/price";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Defaults = { price: string; estMonthlySales: string };

type Props = { id: string; action: Action; data: StoreData; productId: string; channel: CalcChannel; defaults: Defaults; inactive?: boolean };

export function PriceForm({ id, action, data, productId, channel, defaults, inactive }: Props) {
  const t = useTranslations("Pricing");
  const tCommon = useTranslations("Common");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);

  return (
    <form id={id} action={formAction} className="space-y-3">
      <PriceFields
        key={key}
        data={data}
        productId={productId}
        channel={channel}
        inactive={inactive}
        defaults={(state?.values as Defaults | undefined) ?? defaults}
        errors={state?.fieldErrors ?? {}}
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={tCommon("savePending")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}

/** Recomputes the whole store with the typed price, so full cost and margin match the dashboard. */
function previewLine(data: StoreData, productId: string, channelId: string, values: Record<string, unknown>): MetricsLine | null {
  const parsed = priceInputSchema.safeParse(values);
  if (!parsed.success) return null;
  const existing = data.prices.find((row) => row.productId === productId && row.channelId === channelId);
  const prices = [
    ...data.prices.filter((row) => row !== existing),
    {
      productId,
      channelId,
      price: parsed.data.price,
      estMonthlySales: parsed.data.estMonthlySales,
      competitorPrice: existing?.competitorPrice ?? null,
    },
  ];
  const { analysis } = tryAnalyzeStore({ ...data, prices });
  return analysis?.lines.find((line) => line.productId === productId && line.channelId === channelId) ?? null;
}

function PriceFields({
  data,
  productId,
  channel,
  defaults,
  inactive,
  errors,
}: {
  data: StoreData;
  productId: string;
  channel: CalcChannel;
  defaults: Defaults;
  inactive?: boolean;
  errors: Record<string, string[] | undefined>;
}) {
  const t = useTranslations("Pricing");
  const locale = useLocale();
  const [line, setLine] = useState(() => previewLine(data, productId, channel.id, defaults));
  const field = (name: string) => `price-${channel.id}-${name}`;

  function onChange(event: FormEvent<HTMLFieldSetElement>) {
    const form = event.currentTarget.form;
    if (form) setLine(previewLine(data, productId, channel.id, Object.fromEntries(new FormData(form))));
  }

  return (
    <fieldset className="space-y-3" onChange={onChange}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={field("price")}>{t("price")}</Label>
          <Input id={field("price")} name="price" inputMode="numeric" defaultValue={defaults.price} placeholder={t("pricePlaceholder")} />
          <FieldError errors={errors.price} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("est")}>{t("estMonthlySales")}</Label>
          <Input id={field("est")} name="estMonthlySales" inputMode="numeric" defaultValue={defaults.estMonthlySales} placeholder="300" />
          <FieldError errors={errors.estMonthlySales} />
        </div>
      </div>
      {inactive ? (
        <p className="text-sm text-muted-foreground">{t("inactivePreview")}</p>
      ) : line ? (
        <div aria-live="polite" className="space-y-2">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <dt className="text-muted-foreground">{t("materialCost")}</dt>
            <dd className="text-right font-medium">{formatRupiah(line.materialCost, locale)}</dd>
            <dt className="text-muted-foreground">{t("fullCost")}</dt>
            <dd className="text-right font-medium">{line.fullCost === null ? "—" : formatRupiah(line.fullCost, locale)}</dd>
            {(channel.commissionPct > 0 || channel.fixedFee > 0) && (
              <>
                <dt className="text-muted-foreground">{t("netPrice")}</dt>
                <dd className="text-right font-medium">{formatRupiah(line.netPrice, locale)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("margin")}</dt>
            <dd className="text-right font-medium">
              {line.marginPct === null ? "—" : formatPercent(line.marginPct, locale)}{" "}
              <span className="font-normal text-muted-foreground">({t("target", { pct: formatPercent(line.targetMarginPct, locale) })})</span>
            </dd>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={line.status} />
            {line.fullCost === null && <span className="text-xs text-muted-foreground">{t("fullCostUnknown")}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{t("marginHint")}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("previewEmpty")}</p>
      )}
    </fieldset>
  );
}
