import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { formatDay, formatWeekdayShort } from "@/lib/format";
import type { DayState, IsoDate, MonthReport } from "@/lib/records";
import { cn } from "@/lib/utils";

const STATE_STYLE: Record<DayState, string> = {
  recorded: "border-emerald-600/40 bg-emerald-600/15 text-emerald-900 dark:text-emerald-100",
  closed: "border-border bg-muted text-muted-foreground",
  missing: "border-amber-500/60 bg-amber-500/20 text-amber-950 dark:text-amber-100",
  today: "border-primary bg-background font-semibold ring-2 ring-primary",
  future: "border-transparent text-muted-foreground/50",
  before: "border-transparent text-muted-foreground/60",
};

/** The month as a Monday-first grid. A day from `minDate` up to today opens Catat for that date. */
export async function MonthCalendar({
  storeId,
  month,
  calendar,
  today,
  minDate,
}: {
  storeId: string;
  month: string;
  calendar: MonthReport["calendar"];
  today: IsoDate;
  minDate: IsoDate;
}) {
  const t = await getTranslations("Records.report");
  const locale = (await getLocale()) as AppLocale;
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const labels: Record<DayState, string> = {
    recorded: t("stateRecorded"),
    closed: t("stateClosed"),
    missing: t("stateMissing"),
    today: t("stateToday"),
    future: t("stateFuture"),
    before: t("stateBefore"),
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{formatWeekdayShort(i, locale)}</span>
        ))}
      </div>
      <ul data-testid="month-calendar" className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden="true" />
        ))}
        {calendar.map(({ date, state }) => {
          const label = `${formatDay(date, locale)}: ${labels[state]}`;
          const cell = cn(
            "relative flex min-h-10 w-full items-center justify-center rounded-md border text-sm tabular-nums",
            STATE_STYLE[state],
          );
          const content = (
            <>
              {Number(date.slice(8))}
              {state === "closed" && (
                <span aria-hidden="true" className="absolute right-1 top-0.5 text-[10px] leading-none">
                  ✕
                </span>
              )}
            </>
          );
          return (
            <li key={date}>
              {date >= minDate && date <= today ? (
                <Link
                  href={`/s/${storeId}/catat?tanggal=${date}`}
                  data-testid={`calendar-${date}`}
                  data-state={state}
                  aria-label={label}
                  className={cn(cell, "hover:opacity-80")}
                >
                  {content}
                </Link>
              ) : (
                <span data-testid={`calendar-${date}`} data-state={state} role="img" aria-label={label} className={cell}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["recorded", "closed", "missing", "today"] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("inline-block size-3 rounded-sm border", STATE_STYLE[state])} />
            {labels[state]}
          </li>
        ))}
      </ul>
    </div>
  );
}
