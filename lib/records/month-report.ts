import type { StoreAnalysis, StoreData } from "@/lib/calc";
import { addDays, daysInMonth, diffDays, type IsoDate, type IsoMonth } from "./dates";
import type { SalesDayRecord, SalesLineRecord } from "./snapshot";

export type DayState = "recorded" | "closed" | "missing" | "today" | "future" | "before";

export type MonthReport = {
  month: IsoMonth;
  window: { start: IsoDate; end: IsoDate; days: number } | null;
  daysInMonth: number;
  omzet: number;
  channelFees: number;
  materialCosts: number;
  grossProfit: number;
  fixedCosts: number;
  netProfit: number;
  plannedNetProfit: number | null;
  biggestGap: { productName: string; channelName: string; pct: number; rupiah: number } | null;
  calendar: { date: IsoDate; state: DayState }[];
  missing: IsoDate[];
};

const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);

/** Dates in [max(from, firstRecord), min(to, today − 1)] that are not in `filled`. */
export function missingDates(
  firstRecord: IsoDate | null,
  today: IsoDate,
  filled: Set<IsoDate>,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  if (firstRecord === null) return [];
  const start = max(from, firstRecord);
  const end = min(to, addDays(today, -1));
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) if (!filled.has(d)) out.push(d);
  return out;
}

export function monthReport(input: {
  month: IsoMonth;
  today: IsoDate;
  firstRecord: IsoDate | null;
  days: SalesDayRecord[];
  lines: SalesLineRecord[];
  analysis: StoreAnalysis;
  data: StoreData;
}): MonthReport {
  const { month, today, firstRecord, days, analysis } = input;
  const total = daysInMonth(month);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${String(total).padStart(2, "0")}`;
  const lines = input.lines.filter((l) => l.date.slice(0, 7) === month);

  let window: MonthReport["window"] = null;
  if (firstRecord !== null) {
    const start = max(monthStart, firstRecord);
    const end = min(monthEnd, today);
    if (start <= end) window = { start, end, days: diffDays(start, end) + 1 };
  }

  const rawOmzet = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const rawNet = lines.reduce((s, l) => s + l.qty * l.netUnit, 0);
  const rawMaterial = lines.reduce((s, l) => s + l.qty * l.hppUnit, 0);
  const omzet = Math.round(rawOmzet);
  const netRevenue = Math.round(rawNet);
  const materialCosts = Math.round(rawMaterial);
  const channelFees = omzet - netRevenue;
  const grossProfit = netRevenue - materialCosts;

  const share = window ? window.days / total : 0;
  const fixedCosts = window ? Math.round(analysis.fixedCosts.total * share) : 0;
  const netProfit = grossProfit - fixedCosts;
  const plannedNetProfit = window ? Math.round(analysis.netProfit * share) : null;

  let biggestGap: MonthReport["biggestGap"] = null;
  if (window) {
    let best = -1;
    for (const line of analysis.lines) {
      const actual = lines
        .filter((l) => l.productId === line.productId && l.channelId === line.channelId)
        .reduce((s, l) => s + l.qty, 0);
      if (!(line.estMonthlySales > 0) && !(actual > 0)) continue;
      const expected = line.estMonthlySales * share;
      if (expected === 0) continue;
      const rupiah = (actual - expected) * line.contribution;
      if (Math.abs(rupiah) > best) {
        best = Math.abs(rupiah);
        biggestGap = {
          productName: input.data.products.find((p) => p.id === line.productId)?.name ?? "",
          channelName: input.data.channels.find((c) => c.id === line.channelId)?.name ?? "",
          pct: Math.round(((actual - expected) / expected) * 100),
          rupiah: Math.round(rupiah),
        };
      }
    }
  }

  const withLines = new Set(lines.map((l) => l.date));
  const closed = new Set(days.filter((d) => d.closed).map((d) => d.date));
  // A day row that is not closed counts as recorded even when no line is in view (defensive).
  const recorded = new Set([...withLines, ...days.filter((d) => !d.closed).map((d) => d.date)]);
  const filled = new Set([...recorded, ...closed]);
  const missing = missingDates(firstRecord, today, filled, monthStart, monthEnd);
  const missingSet = new Set(missing);

  const calendar: MonthReport["calendar"] = [];
  for (let i = 1; i <= total; i++) {
    const date = `${month}-${String(i).padStart(2, "0")}`;
    let state: DayState;
    if (recorded.has(date)) state = "recorded";
    else if (closed.has(date)) state = "closed";
    else if (firstRecord === null || date < firstRecord) state = "before";
    else if (missingSet.has(date)) state = "missing";
    else if (date === today) state = "today";
    else state = "future";
    calendar.push({ date, state });
  }

  return { month, window, daysInMonth: total, omzet, channelFees, materialCosts, grossProfit, fixedCosts, netProfit, plannedNetProfit, biggestGap, calendar, missing };
}
