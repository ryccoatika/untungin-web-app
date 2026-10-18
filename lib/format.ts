import type { AppLocale } from "@/i18n/routing";
import { parseWholeNumber } from "@/lib/validation/number";

const INTL_LOCALE: Record<AppLocale, string> = { id: "id-ID", en: "en-US" };

export function formatPercent(value: number, locale: AppLocale): string {
  const formatter = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
  const v = Number(value.toFixed(1)) || 0; // avoids "-0%" for tiny negatives
  return `${formatter.format(v)}%`;
}

export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits }).format(value);
}

/** A Rupiah field's value with the locale's thousands separator ("18.000" id, "18,000" en); unreadable input is returned unchanged. */
export function groupDigits(raw: string | number | undefined | null, locale: AppLocale): string {
  if (raw === undefined || raw === null) return "";
  const text = String(raw);
  const value = typeof raw === "number" ? raw : parseWholeNumber(text);
  if (value === undefined || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return text;
  return formatNumber(value, locale, 0);
}

/** Rupiah with the locale's separators: "Rp15.000" (id), "Rp15,000" (en). No sign on values that round to 0. */
export function formatRupiah(value: number, locale: AppLocale, maximumFractionDigits = 0): string {
  const amount = formatNumber(Math.abs(value), locale, maximumFractionDigits);
  const negative = value < 0 && /[1-9]/.test(amount);
  return `${negative ? "-" : ""}Rp${amount}`;
}

/** Short Rupiah for chart labels: "Rp1,8 jt" (id), "Rp1.8M" (en). Same sign rules as formatRupiah. */
export function formatRupiahCompact(value: number, locale: AppLocale): string {
  const whole = Math.round(Math.abs(value));
  const amount = new Intl.NumberFormat(INTL_LOCALE[locale], { notation: "compact", maximumFractionDigits: 1 }).format(whole);
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

/** Splits a formatted number after each "." or "," so a line can only wrap between digit groups. */
export function splitAfterSeparators(text: string): string[] {
  return text.match(/[^.,]*[.,]|[^.,]+$/g) ?? [];
}

/** A calendar day like "8 Okt" / "Oct 8"; `date` is `YYYY-MM-DD` and the day never shifts with the viewer's time zone. */
export function formatDay(date: string, locale: AppLocale, withYear = false): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
