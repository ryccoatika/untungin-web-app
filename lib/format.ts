import type { AppLocale } from "@/i18n/routing";

const INTL_LOCALE: Record<AppLocale, string> = { id: "id-ID", en: "en-US" };

export function formatPercent(value: number, locale: AppLocale): string {
  const formatter = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
  const v = Number(value.toFixed(1)) || 0; // avoids "-0%" for tiny negatives
  return `${formatter.format(v)}%`;
}

export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits }).format(value);
}

/** Rupiah with the locale's separators: "Rp15.000" (id), "Rp15,000" (en). No sign on values that round to 0. */
export function formatRupiah(value: number, locale: AppLocale, maximumFractionDigits = 0): string {
  const amount = formatNumber(Math.abs(value), locale, maximumFractionDigits);
  const negative = value < 0 && /[1-9]/.test(amount);
  return `${negative ? "-" : ""}Rp${amount}`;
}

/** Date and time of a saved event, always in Asia/Jakarta (the app's day boundary, spec §6.1). */
export function formatDateTime(iso: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}
