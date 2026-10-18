"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatNumber, formatRupiah } from "@/lib/format";
import { MAX_DAY_QTY } from "@/lib/records";
import { cn } from "@/lib/utils";
import { closeSalesDayAction, deleteSalesLineAction, saveSalesDayAction, type SalesSaveResult } from "./actions";

export type EntryRow = {
  productId: string;
  channelId: string;
  productName: string;
  /** Selling price, net price and HPP bahan per unit: the same values snapshotLines freezes. */
  price: number;
  netPrice: number;
  materialCost: number;
  qty: number;
  /** The saved line's snapshot: save_sales_day keeps it while the count stays the same. */
  saved: { qty: number; unitPrice: number; netUnit: number; hppUnit: number } | null;
};

export type EntryChannel = { id: string; name: string };

/** A saved line this screen cannot show as a stepper (deleted or inactive product, deleted channel, removed price). */
export type PreviousLine = {
  id: string;
  productName: string;
  channelName: string;
  qty: number;
  unitPrice: number;
  netUnit: number;
  hppUnit: number;
};

type Confirm = "empty" | "clear" | null;

const keyOf = (row: Pick<EntryRow, "productId" | "channelId">) => `${row.productId}|${row.channelId}`;

export function SalesEntry({
  storeId,
  date,
  channels,
  rows,
  previous,
  dayHasLines,
}: {
  storeId: string;
  date: string;
  channels: EntryChannel[];
  rows: EntryRow[];
  previous: PreviousLine[];
  /** The day has saved lines (shown or not): "Toko tutup hari ini" then needs a confirm. */
  dayHasLines: boolean;
}) {
  const t = useTranslations("Records.sales");
  const locale = useLocale() as AppLocale;
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [keyOf(row), String(row.qty)])));
  const [tab, setTab] = useState(channels[0]?.id ?? "");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [result, setResult] = useState<SalesSaveResult | null>(null);

  const qtyOf = (row: EntryRow) => Number(counts[keyOf(row)] || 0);
  const setQty = (row: EntryRow, value: number) => {
    setCounts((prev) => ({ ...prev, [keyOf(row)]: String(Math.min(MAX_DAY_QTY, Math.max(0, value))) }));
    setConfirm(null);
    setResult(null);
  };

  const total = rows.reduce((sum, row) => sum + qtyOf(row), 0);
  // An unchanged count keeps its saved snapshot; a changed one is saved with today's values.
  const unitValues = (row: EntryRow) =>
    row.saved && qtyOf(row) === row.saved.qty
      ? row.saved
      : { unitPrice: row.price, netUnit: row.netPrice, hppUnit: row.materialCost };
  const revenue = rows.reduce((sum, row) => sum + qtyOf(row) * unitValues(row).unitPrice, 0) + previous.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const grossProfit =
    rows.reduce((sum, row) => {
      const unit = unitValues(row);
      return sum + qtyOf(row) * (unit.netUnit - unit.hppUnit);
    }, 0) +
    previous.reduce((sum, l) => sum + l.qty * (l.netUnit - l.hppUnit), 0);
  const hasAnyLine = total > 0 || previous.length > 0 || dayHasLines;

  const run = (action: () => Promise<SalesSaveResult>, onOk?: () => void) =>
    startTransition(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.ok) onOk?.();
    });

  const resetCounts = () => setCounts(Object.fromEntries(rows.map((row) => [keyOf(row), "0"])));

  const save = () => {
    if (total === 0 && previous.length === 0) {
      setConfirm("empty");
      return;
    }
    run(() =>
      saveSalesDayAction(
        storeId,
        date,
        rows.map((row) => ({ productId: row.productId, channelId: row.channelId, qty: qtyOf(row) })),
      ),
    );
  };

  const close = () => {
    setConfirm(null);
    run(() => closeSalesDayAction(storeId, date), resetCounts);
  };
  // Closing a day that has lines clears them, so it asks first.
  const askClose = () => (hasAnyLine ? setConfirm("clear") : close());

  const noRows = (
    <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
      <p className="font-medium">{t("noPricesTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("noPricesBody")}</p>
      <Link href={`/s/${storeId}/produk`} className={buttonVariants({ variant: "outline" })}>
        {t("noPricesAction")}
      </Link>
    </div>
  );

  const soldIn = (channelId: string) => rows.filter((row) => row.channelId === channelId).reduce((sum, row) => sum + qtyOf(row), 0);

  return (
    <div className="space-y-4">
      {rows.length === 0 && noRows}
      <div role="tablist" aria-label={t("channels")} className="flex flex-wrap gap-2">
        {channels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            role="tab"
            id={`tab-${channel.id}`}
            aria-selected={tab === channel.id}
            aria-controls={`panel-${channel.id}`}
            onClick={() => setTab(channel.id)}
            className={cn(
              "flex min-h-12 min-w-0 flex-col items-start justify-center rounded-lg border px-3 py-1 text-left text-sm",
              tab === channel.id ? "border-primary bg-primary/10 font-medium" : "hover:bg-accent/60",
            )}
          >
            <span className="max-w-full truncate">{channel.name}</span>
            <span className="text-xs text-muted-foreground">{t("sold", { count: formatNumber(soldIn(channel.id), locale, 0) })}</span>
          </button>
        ))}
      </div>

      {channels.map((channel) => (
        <div
          key={channel.id}
          role="tabpanel"
          id={`panel-${channel.id}`}
          aria-labelledby={`tab-${channel.id}`}
          hidden={tab !== channel.id}
        >
          <ul className="divide-y rounded-lg border">
            {rows
              .filter((row) => row.channelId === channel.id)
              .map((row) => (
                <li key={keyOf(row)} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{row.productName}</span>
                    <span className="block text-sm text-muted-foreground">{formatRupiah(row.price, locale)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      className="size-11"
                      aria-label={t("decrease", { product: row.productName })}
                      disabled={qtyOf(row) <= 0}
                      onClick={() => setQty(row, qtyOf(row) - 1)}
                    >
                      <Minus aria-hidden />
                    </Button>
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={4}
                      aria-label={t("qty", { product: row.productName })}
                      className="h-11 w-16 text-center tabular-nums"
                      value={counts[keyOf(row)] ?? "0"}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                        setCounts((prev) => ({ ...prev, [keyOf(row)]: digits }));
                        setConfirm(null);
                        setResult(null);
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={() => setCounts((prev) => ({ ...prev, [keyOf(row)]: String(qtyOf(row)) }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      className="size-11"
                      aria-label={t("increase", { product: row.productName })}
                      disabled={qtyOf(row) >= MAX_DAY_QTY}
                      onClick={() => setQty(row, qtyOf(row) + 1)}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {previous.length > 0 && (
        <section aria-labelledby="previous-title" className="space-y-2">
          <div>
            <h2 id="previous-title" className="font-medium">{t("previous")}</h2>
            <p className="text-sm text-muted-foreground">{t("previousHint")}</p>
          </div>
          <ul className="divide-y rounded-lg border">
            {previous.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">{line.productName}</span>
                  <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {line.channelName} · {t("previousLine", { qty: formatNumber(line.qty, locale, 0), price: formatRupiah(line.unitPrice, locale) })}
                  </span>
                </span>
                <Button
                  type="button"
                  variant={removing === line.id ? "destructive" : "outline"}
                  className="shrink-0"
                  aria-label={t("removeLineLabel", { product: line.productName, channel: line.channelName })}
                  disabled={pending}
                  onClick={() => {
                    if (removing !== line.id) {
                      setRemoving(line.id);
                      return;
                    }
                    setRemoving(null);
                    run(() => deleteSalesLineAction(storeId, line.id));
                  }}
                >
                  {removing === line.id ? t("removeLineConfirm") : t("removeLine")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="day-summary">
        <div>
          <dt className="text-muted-foreground">{t("revenue")}</dt>
          <dd className="text-lg font-semibold tabular-nums" data-testid="day-revenue">
            {formatRupiah(revenue, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("grossProfit")}</dt>
          <dd className="text-lg font-semibold tabular-nums" data-testid="day-gross-profit">
            {formatRupiah(grossProfit, locale)}
          </dd>
        </div>
      </dl>

      {confirm && (
        <div role="alertdialog" aria-labelledby="close-title" className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <p id="close-title" className="font-medium">
            {t("confirmEmptyTitle")}
          </p>
          <p className="text-sm">{confirm === "empty" ? t("confirmEmptyBody") : t("confirmCloseBody")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" autoFocus disabled={pending} onClick={close}>
              {pending ? t("closing") : t("confirmYes")}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>
              {t("confirmNo")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {rows.length > 0 && (
          <Button type="button" className="min-w-32 flex-1 sm:flex-none" disabled={pending} onClick={save}>
            {pending ? t("saving") : t("save")}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={pending} onClick={askClose}>
          {t("closeToday")}
        </Button>
      </div>

      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("text-sm [overflow-wrap:anywhere]", result.ok ? "text-primary" : "text-destructive")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
