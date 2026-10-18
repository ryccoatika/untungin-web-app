export const MAX_BACKFILL_DAYS = 92;
export const MISSING_BANNER_DAYS = 31;
export const MAX_DAY_QTY = 9999;

/** `YYYY-MM-DD` */
export type IsoDate = string;
/** `YYYY-MM` */
export type IsoMonth = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const DAY_MS = 86_400_000;

function utcMs(date: IsoDate): number {
  const [, y, m, d] = DATE_RE.exec(date)!;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

function fromMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The calendar day in Asia/Jakarta at the given instant. */
export function jakartaToday(now: Date): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

export function addDays(date: IsoDate, n: number): IsoDate {
  return fromMs(utcMs(date) + n * DAY_MS);
}

/** Whole days from `a` to `b` (b − a). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((utcMs(b) - utcMs(a)) / DAY_MS);
}

export function daysInMonth(month: IsoMonth): number {
  const [, y, m] = MONTH_RE.exec(month)!;
  return new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function isIsoDate(v: unknown): v is IsoDate {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  return fromMs(utcMs(v)) === v;
}

export function isIsoMonth(v: unknown): v is IsoMonth {
  if (typeof v !== "string") return false;
  const m = MONTH_RE.exec(v);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function earliestRecordable(today: IsoDate): IsoDate {
  return addDays(today, -MAX_BACKFILL_DAYS);
}
