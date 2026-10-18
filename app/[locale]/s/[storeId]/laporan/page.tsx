import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyIllustration } from "@/components/empty-illustration";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { tryAnalyzeStore } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { loadFirstRecordDate, loadPurchases, loadSalesRange } from "@/lib/data/records";
import { formatDay, formatMonth, formatNumber, formatRupiah } from "@/lib/format";
import { daysInMonth, earliestRecordable, isIsoMonth, jakartaToday, monthOf, monthReport } from "@/lib/records";
import { cn } from "@/lib/utils";
import { PurchaseList } from "../catat/belanja/purchase-list";
import { MonthCalendar } from "./month-calendar";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const MAX_MISSING_LINKS = 8;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Records.report"))("title") };
}

/** `YYYY-MM` shifted by `delta` months. */
function shiftMonth(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export default async function ReportPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const wanted = (await searchParams).bulan;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Records.report");
  const locale = (await getLocale()) as AppLocale;

  const today = jakartaToday(new Date());
  const currentMonth = monthOf(today);
  const month = typeof wanted === "string" && isIsoMonth(wanted) && wanted <= currentMonth ? wanted : currentMonth;
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const rp = (value: number) => formatRupiah(value, locale);

  const [firstRecord, range, purchases] = await Promise.all([
    loadFirstRecordDate(storeId),
    loadSalesRange(storeId, monthStart, monthEnd),
    loadPurchases(storeId, monthStart, monthEnd),
  ]);
  const { analysis, error } = tryAnalyzeStore(data);
  const report =
    analysis && firstRecord !== null && monthEnd >= firstRecord
      ? monthReport({ month, today, firstRecord, days: range.days, lines: range.lines, analysis, data })
      : null;

  const prevHref = `/s/${storeId}/laporan?bulan=${shiftMonth(month, -1)}`;
  const nextHref = `/s/${storeId}/laporan?bulan=${shiftMonth(month, 1)}`;
  const nav = "inline-flex size-10 items-center justify-center rounded-md border";
  const switcher = (
    <nav aria-label={t("monthNav")} className="flex items-center justify-between gap-2">
      <Link href={prevHref} aria-label={t("prevMonth")} className={cn(nav, "hover:bg-muted")}>
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Link>
      <p data-testid="month-label" aria-live="polite" className="font-medium">
        {formatMonth(month, locale)}
      </p>
      {month < currentMonth ? (
        <Link href={nextHref} aria-label={t("nextMonth")} className={cn(nav, "hover:bg-muted")}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      ) : (
        <span data-testid="next-month" aria-disabled="true" aria-label={t("nextMonth")} className={cn(nav, "text-muted-foreground/40")}>
          <ChevronRight aria-hidden="true" className="size-5" />
        </span>
      )}
    </nav>
  );

  const purchasesSection =
    purchases.length > 0 || report ? (
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("purchasesTitle", { month: formatMonth(month, locale) })}</h2>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("purchasesEmpty")}</p>
        ) : (
          <PurchaseList storeId={storeId} purchases={purchases} />
        )}
      </section>
    ) : null;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("heading")}</h1>
      {switcher}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm [overflow-wrap:anywhere]">
          {t("calcError", { product: data.products.find((p) => p.id === error.productId)?.name ?? "?" })}{" "}
          <Link href={`/s/${storeId}/produk/${error.productId}`} className="font-medium underline underline-offset-4">
            {t("calcErrorAction")}
          </Link>
        </p>
      )}

      {!report && !error && (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} illustration={<EmptyIllustration />}>
          <Link href={`/s/${storeId}/catat`} className={buttonVariants()}>
            {t("emptyAction")}
          </Link>
        </EmptyState>
      )}

      {report && report.window && (
        <>
          <Card>
            <CardContent className="space-y-1">
              <p data-testid="report-answer" className={cn("text-3xl font-semibold [overflow-wrap:anywhere]", report.netProfit < 0 && "text-destructive")}>
                {report.netProfit > 0
                  ? t("answerProfit", { amount: rp(report.netProfit) })
                  : report.netProfit < 0
                    ? t("answerLoss", { amount: rp(-report.netProfit) })
                    : t("answerEven")}
              </p>
              <p className="text-sm text-muted-foreground">
                {month === currentMonth
                  ? t("periodCurrent", { range: dayRange(report.window.start, report.window.end, locale) })
                  : t("periodPast", { range: dayRange(report.window.start, report.window.end, locale) })}
                {" · "}
                {t("basedOn")}
              </p>
            </CardContent>
          </Card>

          {report.missing.length > 0 && (
            <div data-testid="missing-days" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">{t("missingTitle", { count: report.missing.length })}</p>
              <ul className="space-y-1">
                {report.missing.slice(0, MAX_MISSING_LINKS).map((date) => (
                  <li key={date} className="flex flex-wrap items-center gap-x-3">
                    <span>{formatDay(date, locale)}</span>
                    {date >= earliestRecordable(today) ? (
                      <Link
                        href={`/s/${storeId}/catat?tanggal=${date}`}
                        aria-label={t("missingFillLabel", { date: formatDay(date, locale) })}
                        className="inline-flex min-h-10 items-center font-medium underline underline-offset-4"
                      >
                        {t("missingFill")}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{t("missingTooOld")}</span>
                    )}
                  </li>
                ))}
              </ul>
              {report.missing.length > MAX_MISSING_LINKS && (
                <p className="text-muted-foreground">+{report.missing.length - MAX_MISSING_LINKS}</p>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("linesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                <Line id="report-omzet" label={t("omzet")} value={rp(report.omzet)} />
                <Line id="report-fees" label={t("channelFees")} value={minus(rp(report.channelFees))} />
                <Line id="report-materials" label={t("materials")} value={minus(rp(report.materialCosts))} />
                <Line
                  id="report-fixed"
                  labelId="report-fixed-label"
                  label={t("fixed", { days: report.window.days, total: report.daysInMonth })}
                  note={t("fixedNote")}
                  value={minus(rp(report.fixedCosts))}
                />
                <Line id="report-net" label={t("netProfit")} value={rp(report.netProfit)} strong />
              </dl>
            </CardContent>
          </Card>

          {report.plannedNetProfit !== null && (
            <Card>
              <CardHeader>
                <CardTitle>{t("planTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PlanBars plan={report.plannedNetProfit} actual={report.netProfit} planLabel={t("plan")} actualLabel={t("actual")} rp={rp} />
                {report.biggestGap && report.biggestGap.rupiah !== 0 && (
                  <p data-testid="biggest-gap" className="[overflow-wrap:anywhere]">
                    {t(report.biggestGap.rupiah < 0 ? "gapBelow" : "gapAbove", {
                      product: report.biggestGap.productName,
                      channel: report.biggestGap.channelName,
                      pct: formatNumber(Math.abs(report.biggestGap.pct), locale, 0),
                      amount: rp(Math.abs(report.biggestGap.rupiah)),
                    })}
                  </p>
                )}
                <p className="text-muted-foreground">{t("planNote")}</p>
              </CardContent>
            </Card>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t("calendarTitle")}</h2>
            <MonthCalendar storeId={storeId} month={month} calendar={report.calendar} today={today} minDate={earliestRecordable(today)} />
          </section>
        </>
      )}

      {purchasesSection}
    </div>
  );
}

/** A deduction as shown in the lines: "− Rp…". */
const minus = (formatted: string) => `− ${formatted}`;

/** "1–17 Okt" within one month. */
function dayRange(start: string, end: string, locale: AppLocale): string {
  return start === end ? formatDay(end, locale) : `${Number(start.slice(8))}–${formatDay(end, locale)}`;
}

function Line({ id, labelId, label, note, value, strong }: { id: string; labelId?: string; label: string; note?: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2", strong && "font-semibold")}>
      <dt className="min-w-0">
        <span data-testid={labelId} className="[overflow-wrap:anywhere]">
          {label}
        </span>
        {note && <span className="block text-xs font-normal text-muted-foreground">{note}</span>}
      </dt>
      <dd data-testid={id} className="shrink-0 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function PlanBars({ plan, actual, planLabel, actualLabel, rp }: { plan: number; actual: number; planLabel: string; actualLabel: string; rp: (n: number) => string }) {
  const scale = Math.max(Math.abs(plan), Math.abs(actual), 1);
  const bars = [
    { id: "plan", label: planLabel, value: plan, color: "bg-muted-foreground/50" },
    { id: "actual", label: actualLabel, value: actual, color: actual >= 0 ? "bg-primary" : "bg-destructive" },
  ];
  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.id} data-testid={`plan-bar-${bar.id}`} className="space-y-1">
          <div className="flex justify-between gap-3">
            <span>{bar.label}</span>
            <span className="tabular-nums">{rp(bar.value)}</span>
          </div>
          <div className="h-3 rounded-full bg-muted" aria-hidden="true">
            <div className={cn("h-3 rounded-full", bar.color)} style={{ width: `${Math.max(2, (Math.abs(bar.value) / scale) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
