import type { AppLocale } from "@/i18n/routing";

const INTL_LOCALE: Record<AppLocale, string> = { id: "id-ID", en: "en-US" };

export function formatPercent(value: number, locale: AppLocale): string {
  const formatter = new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 });
  return `${formatter.format(value)}%`;
}
