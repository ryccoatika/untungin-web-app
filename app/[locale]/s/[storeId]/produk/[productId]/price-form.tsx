"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useMemo, useRef, useState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { StatusBadge } from "@/components/store/status-badge";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/forms/money-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recommendForChannel,
  tryAnalyzeStore,
  type CalcChannel,
  type MetricsLine,
  type Recommendation,
  type StoreData,
} from "@/lib/calc";
import type { AppLocale } from "@/i18n/routing";
import { formatPercent, formatRupiah, groupDigits } from "@/lib/format";
import type { FormAction } from "@/lib/forms";
import { priceInputSchema } from "@/lib/validation/price";

export type PriceDefaults = { price: string; estMonthlySales: string; competitorPrice: string };

type Props = {
  id: string;
  action: FormAction;
  data: StoreData;
  productId: string;
  channel: CalcChannel;
  defaults: PriceDefaults;
  inactive?: boolean;
};

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
        defaults={{ ...defaults, ...(state?.values as Partial<PriceDefaults> | undefined) }}
        errors={state?.fieldErrors ?? {}}
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={tCommon("savePending")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}

type Preview = { line: MetricsLine | null; recommendation: Recommendation | null };

/**
 * Recomputes the whole store with the typed values, so full cost, margin and the recommendation match
 * the dashboard. The recommendation is shown even before a valid price is typed.
 */
function preview(data: StoreData, productId: string, channelId: string, values: Record<string, unknown>): Preview {
  const parsed = priceInputSchema.safeParse(values);
  const others = data.prices.filter((row) => !(row.productId === productId && row.channelId === channelId));
  let scenario: StoreData = data;
  if (parsed.success) {
    scenario = {
      ...data,
      prices: [
        ...others,
        {
          productId,
          channelId,
          price: parsed.data.price,
          estMonthlySales: parsed.data.estMonthlySales,
          competitorPrice: parsed.data.competitorPrice,
        },
      ],
    };
  } else {
    // No valid price yet: a typed sales estimate still sharpens the recommendation (no line is previewed).
    const sales = priceInputSchema.shape.estMonthlySales.safeParse(values.estMonthlySales);
    if (sales.success) {
      const existing = data.prices.find((row) => row.productId === productId && row.channelId === channelId);
      scenario = {
        ...data,
        prices: [
          ...others,
          { productId, channelId, price: 0, estMonthlySales: sales.data, competitorPrice: existing?.competitorPrice ?? null },
        ],
      };
    }
  }
  const { analysis } = tryAnalyzeStore(scenario);
  if (!analysis) return { line: null, recommendation: null };
  let recommendation: Recommendation | null = null;
  try {
    recommendation = recommendForChannel(scenario, analysis, productId, channelId);
  } catch {
    recommendation = null; // a CalcError in this product's composition; the page shows the alert
  }
  const line = parsed.success
    ? (analysis.lines.find((candidate) => candidate.productId === productId && candidate.channelId === channelId) ?? null)
    : null;
  return { line, recommendation };
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
  defaults: PriceDefaults;
  inactive?: boolean;
  errors: Record<string, string[] | undefined>;
}) {
  const t = useTranslations("Pricing");
  const locale = useLocale() as AppLocale;
  const priceRef = useRef<HTMLInputElement>(null);
  // The typed values live in state; the preview is derived, so it follows new `data` after other saves.
  const [values, setValues] = useState<Record<string, unknown>>(defaults);
  const { line, recommendation } = useMemo(
    () => preview(data, productId, channel.id, values),
    [data, productId, channel.id, values],
  );
  const field = (name: string) => `price-${channel.id}-${name}`;

  function applyRecommendation() {
    if (recommendation?.kind !== "price" || !priceRef.current) return;
    const grouped = groupDigits(recommendation.price, locale);
    priceRef.current.value = grouped;
    setValues((current) => ({ ...current, price: grouped }));
  }

  return (
    <fieldset
      className="space-y-3"
      onChange={(event) => {
        const form = event.currentTarget.form;
        if (form) setValues(Object.fromEntries(new FormData(form)));
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={field("price")}>{t("price")}</Label>
          <MoneyInput
            ref={priceRef}
            id={field("price")}
            name="price"
            defaultValue={defaults.price}
            placeholder={t("pricePlaceholder")}
          />
          <FieldError errors={errors.price} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("est")}>{t("estMonthlySales")}</Label>
          <Input id={field("est")} name="estMonthlySales" inputMode="numeric" defaultValue={defaults.estMonthlySales} placeholder="300" />
          <FieldError errors={errors.estMonthlySales} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={field("competitor")}>{t("competitorPrice")}</Label>
          <MoneyInput id={field("competitor")} name="competitorPrice" defaultValue={defaults.competitorPrice} />
          <p className="text-xs text-muted-foreground">{t("competitorHint")}</p>
          <FieldError errors={errors.competitorPrice} />
        </div>
      </div>

      <div aria-live="polite" className="space-y-3">
        {!inactive && recommendation && (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            {recommendation.kind === "impossible" ? (
              <p>{t("recommendationImpossible")}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t("recommendation", { price: formatRupiah(recommendation.price, locale) })}</span>
                  <Button type="button" variant="outline" onClick={applyRecommendation}>
                    {t("useRecommendation")}
                  </Button>
                </div>
                {!recommendation.includesOperatingCosts && (
                  <p className="text-xs text-muted-foreground">{t("recommendationNoOverhead")}</p>
                )}
              </>
            )}
          </div>
        )}
        {!inactive && line && (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={line.status} />
            {line.fullCost === null && <span className="text-xs text-muted-foreground">{t("fullCostUnknown")}</span>}
          </div>
        )}
      </div>

      {inactive ? (
        <p className="text-sm text-muted-foreground">{t("inactivePreview")}</p>
      ) : line ? (
        <div className="space-y-2">
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
            {line.competitorPrice !== null && (
              <>
                <dt className="text-muted-foreground">{t("competitor")}</dt>
                <dd className="text-right font-medium">{formatRupiah(line.competitorPrice, locale)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("margin")}</dt>
            <dd className="text-right font-medium">
              {line.marginPct === null ? "—" : formatPercent(line.marginPct, locale)}{" "}
              <span className="font-normal text-muted-foreground">({t("target", { pct: formatPercent(line.targetMarginPct, locale) })})</span>
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground">{t("marginHint")}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("previewEmpty")}</p>
      )}
    </fieldset>
  );
}
