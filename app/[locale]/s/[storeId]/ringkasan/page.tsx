import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { EmptyIllustration } from "@/components/empty-illustration";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireUser } from "@/lib/auth/require-user";
import { expenseCategoryLabels, loadLoanSummary } from "@/lib/data/loan-summary";
import { getStore } from "@/lib/data/stores";
import { formatDateTime, formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { getBusinessTypeLabel } from "@/lib/i18n/server";
import { DEFAULT_KUR_RATE_PCT, firstParam, type Query } from "@/lib/report/installment";
import { InstallmentForm } from "./installment-form";
import { OwnerNameForm } from "./owner-name-form";
import { ReportToolbar } from "./report-toolbar";

type Props = { params: Promise<{ locale: string; storeId: string }>; searchParams: Promise<Query> };

/** The tab and the default PDF file name: "Ringkasan usaha – <store>". */
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { storeId } = await params;
  const store = await getStore(storeId);
  const t = await getTranslations("Report");
  return { title: store ? t("metaTitle", { store: store.name }) : t("title") };
}

/** A table that scrolls inside its own box on a phone and prints at full width. */
function TableBox({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-max text-sm print:min-w-0">{children}</table>
    </div>
  );
}

const th = "px-2 py-1.5 font-medium text-muted-foreground print:py-px";
const td = "px-2 py-1.5 print:py-px";
const num = "text-right tabular-nums";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section space-y-2 print:space-y-0.5">
      <h2 className="border-b pb-1 font-heading text-base font-semibold print:pb-0">{title}</h2>
      {children}
    </section>
  );
}

export default async function LoanSummaryPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const query = await searchParams;
  const { supabase, userId } = await requireUser();
  const t = await getTranslations("Report");
  const tCategory = await getTranslations("ExpenseCategory");
  const tMarket = await getTranslations("TargetMarket");
  const businessTypeLabel = await getBusinessTypeLabel();
  const locale = (await getLocale()) as AppLocale;

  const result = await loadLoanSummary(supabase, userId, storeId, query, businessTypeLabel, (value) =>
    tMarket.has(value as never) ? tMarket(value as never) : value,
  );
  if (result.kind === "not-found") notFound();

  if (result.kind === "calc-error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm [overflow-wrap:anywhere]">
          {t("calcError", { product: result.productName })}{" "}
          <Link href={`/s/${storeId}/produk/${result.error.productId}`} className="font-medium underline underline-offset-4">
            {t("calcErrorAction")}
          </Link>
        </p>
      </div>
    );
  }

  const { summary, errors } = result;
  if (summary.missing.includes("products")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} illustration={<EmptyIllustration />}>
          <Link href={`/s/${storeId}/produk`} className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const categoryLabels = expenseCategoryLabels(t, tCategory);
  const rp = (value: number) => formatRupiah(value, locale);
  const pct = (value: number | null) => (value === null ? t("noValue") : formatPercent(value, locale));
  const { store, monthly, installment } = summary;

  // The CSV link keeps the instalment values the page is showing (only when they are valid).
  const csvParams = new URLSearchParams();
  if (installment) {
    for (const key of ["pinjaman", "tenor", "bunga"] as const) {
      const value = firstParam(query, key);
      if (value !== "") csvParams.set(key, value);
    }
  }

  const details: [string, string][] = [
    [t("businessType"), store.businessType],
    ...(store.targetMarket ? ([[t("targetMarket"), store.targetMarket]] as [string, string][]) : []),
    ...(store.ownerName ? ([[t("ownerName"), store.ownerName]] as [string, string][]) : []),
    [t("operatingDays"), t("operatingDaysValue", { days: store.operatingDaysPerMonth })],
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3 print:hidden">
        <ReportToolbar query={csvParams.toString()} />
        <OwnerNameForm current={store.ownerName ?? ""} />
        <InstallmentForm
          initial={{ pinjaman: firstParam(query, "pinjaman"), tenor: firstParam(query, "tenor"), bunga: firstParam(query, "bunga") || String(DEFAULT_KUR_RATE_PCT) }}
          errors={errors}
        />
      </div>

      <article
        data-testid="loan-summary"
        className="report-sheet mx-auto max-w-[210mm] space-y-5 rounded-lg border bg-card p-4 text-card-foreground sm:p-8 print:space-y-1.5"
      >
        <header className="space-y-3 print:space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-xl font-semibold print:text-lg">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("subtitle")} · {t("madeOn", { date: formatDateTime(new Date().toISOString(), locale) })}
            </p>
          </div>
          <p className="text-2xl font-semibold [overflow-wrap:anywhere] print:text-xl">{store.name}</p>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="text-muted-foreground">{label}:</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <Section title={t("monthlyTitle")}>
          {summary.missing.includes("salesEstimate") && <p className="text-sm text-muted-foreground">{t("missingSalesEstimate")}</p>}
          <TableBox>
            <tbody className="divide-y">
              <tr>
                <td className={td}>{t("grossRevenue")}</td>
                <td className={`${td} ${num}`} data-testid="report-gross-revenue">
                  {rp(monthly.grossRevenue)}
                </td>
              </tr>
              <tr>
                <td className={td}>{t("channelFees")}</td>
                <td className={`${td} ${num}`} data-testid="report-channel-fees">
                  {rp(monthly.channelFees)}
                </td>
              </tr>
              <tr>
                <td className={td}>{t("materialCosts")}</td>
                <td className={`${td} ${num}`} data-testid="report-material-costs">
                  {rp(monthly.materialCosts)}
                </td>
              </tr>
              <tr className="font-medium">
                <td className={td}>{t("grossProfit")}</td>
                <td className={`${td} ${num}`} data-testid="report-gross-profit">
                  {rp(monthly.grossProfit)}
                </td>
              </tr>
              <tr>
                <td className={`${td} pt-2 font-medium`} colSpan={2}>
                  {t("fixedCostsTitle")}
                </td>
              </tr>
              {monthly.fixedCostsByCategory.map((row) => (
                <tr key={row.category}>
                  <td className={`${td} pl-5`}>{categoryLabels[row.category]}</td>
                  <td className={`${td} ${num}`}>{rp(row.amount)}</td>
                </tr>
              ))}
              <tr>
                <td className={`${td} pl-5`}>{t("depreciation")}</td>
                <td className={`${td} ${num}`}>{rp(monthly.depreciation)}</td>
              </tr>
              <tr className="font-medium">
                <td className={td}>{t("fixedCostsTotal")}</td>
                <td className={`${td} ${num}`}>{rp(monthly.fixedCostsTotal)}</td>
              </tr>
              <tr className="text-base font-semibold">
                <td className={td}>{t("netProfit")}</td>
                <td className={`${td} ${num}`} data-testid="report-net-profit">
                  {rp(monthly.netProfit)}
                </td>
              </tr>
              <tr>
                <td className={td}>{t("netMargin")}</td>
                <td className={`${td} ${num}`}>{pct(monthly.netMarginPct)}</td>
              </tr>
            </tbody>
          </TableBox>
        </Section>

        <Section title={t("productsTitle")}>
          <TableBox>
            <thead>
              <tr className="border-b text-left">
                <th className={th}>{t("product")}</th>
                <th className={th}>{t("channel")}</th>
                <th className={`${th} ${num}`}>{t("price")}</th>
                <th className={`${th} ${num}`}>{t("fullCost")}</th>
                <th className={`${th} ${num}`}>{t("margin")}</th>
                <th className={`${th} ${num}`}>{t("estSales")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.products.map((p, index) => (
                <tr key={index}>
                  <td className={td}>{p.product}</td>
                  <td className={td}>{p.channel}</td>
                  <td className={`${td} ${num}`}>{rp(p.price)}</td>
                  <td className={`${td} ${num}`}>{p.fullCost === null ? t("noValue") : rp(p.fullCost)}</td>
                  <td className={`${td} ${num}`}>{pct(p.marginPct)}</td>
                  <td className={`${td} ${num}`}>{formatNumber(p.estMonthlySales, locale, 0)}</td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        </Section>

        <Section title={t("assetsTitle")}>
          {summary.assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("missingAssets")}</p>
          ) : (
            <TableBox>
              <thead>
                <tr className="border-b text-left">
                  <th className={th}>{t("asset")}</th>
                  <th className={`${th} ${num}`}>{t("qty")}</th>
                  <th className={`${th} ${num}`}>{t("value")}</th>
                  <th className={`${th} ${num}`}>{t("usefulLife")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.assets.map((a, index) => (
                  <tr key={index}>
                    <td className={td}>{a.name}</td>
                    <td className={`${td} ${num}`}>{formatNumber(a.qty, locale)}</td>
                    <td className={`${td} ${num}`}>{rp(a.value)}</td>
                    <td className={`${td} ${num}`}>{formatNumber(a.usefulLifeMonths, locale, 0)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className={td} colSpan={2}>
                    {t("totalCapital")}
                  </td>
                  <td className={`${td} ${num}`}>{rp(summary.totalCapital)}</td>
                  <td />
                </tr>
              </tbody>
            </TableBox>
          )}
        </Section>

        <Section title={t("indicatorsTitle")}>
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t("bepMonthly")}</dt>
              <dd className="font-medium tabular-nums">
                {summary.breakEven.unitsMonthly === null ? t("noValue") : t("bepUnits", { units: summary.breakEven.unitsMonthly })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("bepDaily")}</dt>
              <dd className="font-medium tabular-nums">
                {summary.breakEven.unitsDaily === null ? t("noValue") : t("bepUnits", { units: summary.breakEven.unitsDaily })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("payback")}</dt>
              <dd className="font-medium tabular-nums">
                {summary.paybackMonths === null ? t("noValue") : t("paybackValue", { months: formatNumber(summary.paybackMonths, locale, 1) })}
              </dd>
            </div>
          </dl>
          {monthly.netProfit <= 0 && !summary.missing.includes("salesEstimate") && (
            <p className="text-sm text-muted-foreground">{t("noProfitNote")}</p>
          )}
        </Section>

        {installment && (
          <Section title={t("installmentTitle")}>
            <p className="text-sm text-muted-foreground">
              {t("installmentSummary", {
                principal: rp(installment.principal),
                months: installment.months,
                rate: formatPercent(installment.annualRatePct, locale),
              })}
            </p>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("monthlyInstallment")}</dt>
                <dd className="text-base font-semibold tabular-nums" data-testid="installment-monthly">
                  {rp(installment.monthly)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("totalRepaid")}</dt>
                <dd className="text-base font-semibold tabular-nums">{rp(installment.totalRepaid)}</dd>
              </div>
            </dl>
            <p className="text-sm" data-testid="installment-share">
              {installment.shareOfNetProfitPct === null
                ? t("profitNotPositive")
                : t("shareOfProfit", { pct: formatPercent(installment.shareOfNetProfitPct, locale) })}
            </p>
          </Section>
        )}

        <footer className="border-t pt-3 text-xs print:pt-1.5 text-muted-foreground">{t("footnote")}</footer>
      </article>
    </div>
  );
}
