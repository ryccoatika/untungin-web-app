import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { analyzeStoreSkipping } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { loadFirstRecordDate, loadSalesDay, loadSalesDays } from "@/lib/data/records";
import { formatDay } from "@/lib/format";
import { addDays, earliestRecordable, isIsoDate, jakartaToday, MISSING_BANNER_DAYS, missingDates } from "@/lib/records";
import { DatePicker } from "./date-picker";
import { RecordTabs } from "./record-tabs";
import { SalesEntry, type EntryChannel, type EntryRow, type PreviousLine } from "./sales-entry";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const MAX_BANNER_LINKS = 5;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("Records"))("title") };
}

export default async function RecordSalesPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const wanted = (await searchParams).tanggal;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Records.sales");
  const locale = (await getLocale()) as AppLocale;

  const today = jakartaToday(new Date());
  const min = earliestRecordable(today);
  const requested = typeof wanted === "string" ? wanted : undefined;
  const requestedOk = requested !== undefined && isIsoDate(requested) && requested >= min && requested <= today;
  const date = requestedOk ? requested : today;
  const rejectedDate = requested !== undefined && !requestedOk;

  // A product whose recipe needs fixing is left off the screen; its saved lines show under "Tercatat sebelumnya".
  const { analysis, skipped } = analyzeStoreSkipping(data);
  const [day, firstRecord, recent] = await Promise.all([
    loadSalesDay(storeId, date),
    loadFirstRecordDate(storeId),
    loadSalesDays(storeId, addDays(today, -MISSING_BANNER_DAYS), today),
  ]);

  const missing = missingDates(
    firstRecord,
    today,
    new Set(recent.map((d) => d.date)),
    addDays(today, -MISSING_BANNER_DAYS),
    addDays(today, -1),
  );

  const productOrder = new Map(data.products.map((p, index) => [p.id, index]));
  const channelOrder = new Map(data.channels.map((c, index) => [c.id, index]));
  const savedLines = new Map<string, EntryRow["saved"]>();
  for (const line of day?.lines ?? []) {
    savedLines.set(`${line.productId}|${line.channelId}`, { qty: line.qty, unitPrice: line.unitPrice, netUnit: line.netUnit, hppUnit: line.hppUnit });
  }

  const rows: EntryRow[] = analysis.lines
    .map((line) => ({
      productId: line.productId,
      channelId: line.channelId,
      productName: data.products.find((p) => p.id === line.productId)?.name ?? "?",
      price: line.price,
      netPrice: line.netPrice,
      materialCost: line.materialCost,
      qty: savedLines.get(`${line.productId}|${line.channelId}`)?.qty ?? 0,
      saved: savedLines.get(`${line.productId}|${line.channelId}`) ?? null,
    }))
    .sort(
      (a, b) =>
        (productOrder.get(a.productId) ?? 0) - (productOrder.get(b.productId) ?? 0) ||
        (channelOrder.get(a.channelId) ?? 0) - (channelOrder.get(b.channelId) ?? 0),
    );
  const shown = new Set(rows.map((row) => `${row.productId}|${row.channelId}`));
  const channels: EntryChannel[] = data.channels
    .filter((channel) => rows.some((row) => row.channelId === channel.id))
    .map((channel) => ({ id: channel.id, name: channel.name }));
  const previous: PreviousLine[] = (day?.lines ?? [])
    .filter((line) => !shown.has(`${line.productId}|${line.channelId}`))
    .map((line) => ({
      id: line.id,
      productName: line.productName,
      channelName: line.channelName,
      qty: line.qty,
      unitPrice: line.unitPrice,
      netUnit: line.netUnit,
      hppUnit: line.hppUnit,
    }));

  return (
    <div className="max-w-2xl space-y-4">
      <RecordTabs storeId={storeId} active="sales" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t("heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <DatePicker storeId={storeId} date={date} min={min} max={today} />
      </div>

      {rejectedDate && (
        <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {t("dateNotice", { min: formatDay(min, locale, true) })}
        </p>
      )}

      {missing.length > 0 && (
        <div data-testid="missing-days" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">{t("missingTitle", { count: missing.length })}</p>
          <ul className="flex flex-wrap items-center gap-2">
            {missing.slice(0, MAX_BANNER_LINKS).map((missingDate) => (
              <li key={missingDate}>
                <Link
                  href={`/s/${storeId}/catat?tanggal=${missingDate}`}
                  className="inline-flex min-h-10 items-center rounded-md border border-amber-500/50 px-3 font-medium underline underline-offset-4"
                >
                  {formatDay(missingDate, locale)}
                </Link>
              </li>
            ))}
            {missing.length > MAX_BANNER_LINKS && <li>{t("missingMore", { count: missing.length - MAX_BANNER_LINKS })}</li>}
          </ul>
        </div>
      )}

      {skipped.map((error) => (
        <p key={error.productId} role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm [overflow-wrap:anywhere]">
          {t("calcSkipped", { product: data.products.find((p) => p.id === error.productId)?.name ?? "?" })}{" "}
          <Link href={`/s/${storeId}/produk/${error.productId}`} className="font-medium underline underline-offset-4">
            {t("calcErrorAction")}
          </Link>
        </p>
      ))}

      {day?.closed && (
        <p data-testid="closed-note" className="rounded-lg border bg-muted p-3 text-sm">
          {t("closedNote")}
        </p>
      )}
      {date < today && day && <p className="text-sm text-muted-foreground">{t("pastNote")}</p>}

      <SalesEntry
        key={date}
        storeId={storeId}
        date={date}
        channels={channels}
        rows={rows}
        previous={previous}
        dayHasLines={(day?.lines.length ?? 0) > 0}
        dayClosed={day?.closed ?? false}
        isToday={date === today}
      />
    </div>
  );
}
