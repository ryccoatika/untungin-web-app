"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/store/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALL_MATERIALS, applyOverrides, priceKey, tryAnalyzeStore, type LineRef, type Overrides, type StoreData } from "@/lib/calc";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { compareMetrics, type ComparedMetric, type MetricComparison } from "@/lib/simulation/compare";
import { overridesToSearchParams, parseOverrides, SIMULATION_LIMITS, type SearchParams } from "@/lib/simulation/query";
import { cn } from "@/lib/utils";
import { priceInputSchema } from "@/lib/validation/price";

const SLIDER = { min: -50, max: 100, step: 5 } as const;

const TONE: Record<MetricComparison["tone"], string> = {
  better: "text-emerald-700 dark:text-emerald-400",
  worse: "text-destructive",
  same: "text-muted-foreground",
};

/** Every value per key, so parseOverrides sees what the address bar holds. */
function paramsToQuery(params: { forEach: (fn: (value: string, key: string) => void) => void }): SearchParams {
  const query: Record<string, string[]> = {};
  params.forEach((value, key) => (query[key] ??= []).push(value));
  return query;
}

export function SimulationPanel({ data }: { data: StoreData }) {
  const t = useTranslations("Simulation");
  const tWarnings = useTranslations("Warnings");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [overrides, setOverrides] = useState<Overrides>(() => parseOverrides(paramsToQuery(searchParams)));
  const [resetKey, setResetKey] = useState(0);
  // Links with per-material changes open the collapsed section so those fields are not hidden.
  const [hasPerMaterial] = useState(() => Object.keys(overrides.materialPricePct ?? {}).some((key) => key !== ALL_MATERIALS));

  const now = useMemo(() => tryAnalyzeStore(data).analysis, [data]);
  const sim = useMemo(() => tryAnalyzeStore(applyOverrides(data, overrides)).analysis, [data, overrides]);

  // The address bar carries the scenario so it can be reloaded or shared (spec §4.4).
  useEffect(() => {
    const query = overridesToSearchParams(overrides).toString();
    window.history.replaceState(window.history.state, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, [overrides]);

  // Back/forward and sidebar links change the address bar without remounting; follow it. Our own replaceState
  // above has already made the live URL match `overrides`, so this only fires for navigation from outside.
  useEffect(() => {
    const live = parseOverrides(paramsToQuery(new URLSearchParams(window.location.search)));
    if (overridesToSearchParams(live).toString() === overridesToSearchParams(overrides).toString()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the address bar, an external system
    setOverrides(live);
    setResetKey((key) => key + 1);
  }, [searchParams, overrides]);

  if (!now || !sim) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        {t("calcError")}
      </p>
    );
  }

  const signed = (text: string, value: number) => (value > 0 ? `+${text}` : text);
  const pctLabel = (value: number) => signed(formatPercent(value, locale), value);
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const lineLabel = (ref: LineRef) => `${productName(ref.productId)} (${channelName(ref.channelId)})`;

  function setMaterialPct(id: string, value: number | undefined) {
    setOverrides((current) => {
      const next = { ...current.materialPricePct };
      if (value === undefined || (id === ALL_MATERIALS && value === 0)) delete next[id];
      else next[id] = value;
      return { ...current, materialPricePct: next };
    });
  }

  function setSalesPct(value: number) {
    setOverrides((current) => ({
      ...current,
      salesMultiplier: value === 0 ? undefined : 1 + value / 100,
    }));
  }

  function setPrice(key: string, raw: string) {
    const parsed = priceInputSchema.shape.price.safeParse(raw);
    setOverrides((current) => {
      const next = { ...current.prices };
      if (parsed.success) next[key] = parsed.data;
      else delete next[key];
      return { ...current, prices: next };
    });
  }

  function reset() {
    setOverrides({});
    setResetKey((key) => key + 1);
  }

  // With estimates in the real data, a simulation that sells nothing is not "missing estimates".
  const warnings = sim.warnings.filter((warning) => !(warning.code === "NO_SALES_ESTIMATE" && now.totalUnits > 0));
  const materialAll = overrides.materialPricePct?.[ALL_MATERIALS] ?? 0;
  const salesPct = Math.round(((overrides.salesMultiplier ?? 1) - 1) * 100);

  const formatValue = (key: ComparedMetric, value: number | null) => {
    if (value === null) return "—";
    if (key === "netProfit" || key === "grossRevenue") return formatRupiah(value, locale);
    if (key === "netMarginPct") return formatPercent(value, locale);
    if (key === "bepUnitsDaily") return t("perDay", { units: value });
    return t("months", { months: formatNumber(value, locale, 1) });
  };
  const formatDiff = (key: ComparedMetric, diff: number | null) => {
    if (diff === null) return "—";
    if (key === "netProfit" || key === "grossRevenue") return signed(formatRupiah(diff, locale), diff);
    if (key === "netMarginPct") return signed(t("points", { value: formatNumber(diff, locale, 1) }), diff);
    return signed(formatNumber(diff, locale, key === "paybackMonths" ? 1 : 0), diff);
  };

  const rows = compareMetrics(now, sim, { simHasEstimates: now.totalUnits > 0 });
  const profit = rows.find((row) => row.key === "netProfit");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("resultsTitle")}</CardTitle>
          <CardDescription>{t("shareHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul aria-live="polite" className="divide-y">
            {rows.map((row) => (
              <li key={row.key} className="space-y-2 py-3">
                <p className="text-sm text-muted-foreground">{t(`metrics.${row.key}`)}</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{t("now")}</dt>
                    <dd className="text-sm [overflow-wrap:anywhere]" data-testid={`sim-now-${row.key}`}>
                      {formatValue(row.key, row.now)}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{t("sim")}</dt>
                    <dd className="font-semibold [overflow-wrap:anywhere]" data-testid={`sim-sim-${row.key}`}>
                      {formatValue(row.key, row.sim)}
                    </dd>
                  </div>
                  <div className={cn("col-span-2 text-sm font-medium", TONE[row.tone])}>
                    <span className="sr-only">{t("diff")}: </span>
                    <span data-testid={`sim-diff-${row.key}`}>{formatDiff(row.key, row.diff)}</span>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {profit && (
        // Phones and tablets: net profit stays visible under the sticky header while the controls below are used.
        // The results card above already announces changes, so this copy is hidden from assistive technology.
        <div
          aria-hidden
          data-testid="sim-bar"
          className="sticky top-[65px] z-[5] -mx-4 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b bg-background/95 px-4 py-2 text-sm backdrop-blur md:-mx-8 md:px-8 lg:hidden"
        >
          <span className="text-xs text-muted-foreground">{t(`metrics.${profit.key}`)}</span>
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span data-testid="sim-bar-now">{formatValue(profit.key, profit.now)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold" data-testid="sim-bar-sim">
              {formatValue(profit.key, profit.sim)}
            </span>
          </span>
          <span className={cn("font-medium", TONE[profit.tone])} data-testid="sim-bar-diff">
            {formatDiff(profit.key, profit.diff)}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("controlsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div key={resetKey} className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="sim-materials">{t("materialAll")}</Label>
                <span className="text-sm font-medium">{pctLabel(materialAll)}</span>
              </div>
              <input
                id="sim-materials"
                type="range"
                min={Math.min(SLIDER.min, materialAll)}
                max={Math.max(SLIDER.max, materialAll)}
                step={SLIDER.step}
                value={materialAll}
                aria-valuetext={pctLabel(materialAll)}
                onChange={(event) => setMaterialPct(ALL_MATERIALS, Number(event.target.value))}
                className="h-10 w-full scroll-mt-32 scroll-mb-24 accent-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="sim-sales">{t("sales")}</Label>
                <span className="text-sm font-medium">{pctLabel(salesPct)}</span>
              </div>
              <input
                id="sim-sales"
                type="range"
                min={Math.min(SLIDER.min, salesPct)}
                max={Math.max(SLIDER.max, salesPct)}
                step={SLIDER.step}
                value={salesPct}
                aria-valuetext={pctLabel(salesPct)}
                onChange={(event) => setSalesPct(Number(event.target.value))}
                className="h-10 w-full scroll-mt-32 scroll-mb-24 accent-primary"
              />
              {now.totalUnits === 0 && <p className="text-xs text-muted-foreground">{t("salesNeedsEstimates")}</p>}
            </div>

            <details open={hasPerMaterial} className="space-y-3">
              <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">{t("perMaterial")}</summary>
              <p className="text-xs text-muted-foreground">{t("perMaterialHint")}</p>
              {data.materials.map((material) => (
                <div key={material.id} className="space-y-1">
                  <Label htmlFor={`sim-material-${material.id}`}>{t("materialPct", { material: material.name })}</Label>
                  <Input
                    id={`sim-material-${material.id}`}
                    className="scroll-mt-32 scroll-mb-24"
                    inputMode="decimal"
                    defaultValue={overrides.materialPricePct?.[material.id]?.toString() ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value.trim().replace(",", ".");
                      const value = raw === "" ? undefined : Number(raw);
                      const ok =
                        value === undefined ||
                        (Number.isFinite(value) && value >= SIMULATION_LIMITS.minPct && value <= SIMULATION_LIMITS.maxPct);
                      if (ok) setMaterialPct(material.id, value);
                    }}
                  />
                </div>
              ))}
            </details>

            <div className="space-y-3">
              <p className="text-sm font-medium">{t("prices")}</p>
              {now.lines.map((line) => {
                const key = priceKey(line.productId, line.channelId);
                const label = t("priceFor", {
                  product: productName(line.productId),
                  channel: channelName(line.channelId),
                });
                return (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`sim-price-${key}`} className="[overflow-wrap:anywhere]">
                      {label}
                    </Label>
                    <Input
                      id={`sim-price-${key}`}
                      className="scroll-mt-32 scroll-mb-24"
                      inputMode="numeric"
                      defaultValue={String(overrides.prices?.[key] ?? line.price)}
                      onChange={(event) => setPrice(key, event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <Button type="button" variant="outline" onClick={reset}>
            {t("reset")}
          </Button>
        </CardContent>
      </Card>

      {sim.lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("linesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sim.lines.map((line) => {
                const before = now.lines.find((l) => l.productId === line.productId && l.channelId === line.channelId);
                const margin = (value: number | null | undefined) =>
                  value === null || value === undefined ? "—" : formatPercent(value, locale);
                return (
                  <li key={`${line.productId}:${line.channelId}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0 text-sm [overflow-wrap:anywhere]">{lineLabel(line)}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {t("lineMargin", {
                        now: margin(before?.marginPct),
                        sim: margin(line.marginPct),
                      })}
                      <StatusBadge status={line.status} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("warningsTitle")}</h2>
          <ul className="space-y-2">
            {warnings.map((warning) => (
              <li key={warning.code} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm [overflow-wrap:anywhere]">
                {tWarnings(warning.code, {
                  products: warning.lines.map(lineLabel).join(", "),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
