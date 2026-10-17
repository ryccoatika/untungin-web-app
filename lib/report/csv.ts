import type { LoanSummary } from "./loan-summary";

/** Flat record of translated titles, passed in by the caller so lib stays free of next-intl. */
export type CsvLabels = {
  sectionStore: string;
  sectionMonthly: string;
  sectionFixedCosts: string;
  sectionProducts: string;
  sectionAssets: string;
  sectionIndicators: string;
  sectionInstallment: string;
  storeName: string;
  businessType: string;
  targetMarket: string;
  ownerName: string;
  operatingDays: string;
  grossRevenue: string;
  materialCosts: string;
  grossProfit: string;
  depreciation: string;
  fixedCostsTotal: string;
  netProfit: string;
  netMarginPct: string;
  product: string;
  channel: string;
  price: string;
  fullCost: string;
  materialCost: string;
  marginPct: string;
  estMonthlySales: string;
  assetName: string;
  qty: string;
  value: string;
  usefulLifeMonths: string;
  totalCapital: string;
  breakEvenMonthly: string;
  breakEvenDaily: string;
  paybackMonths: string;
  principal: string;
  months: string;
  annualRatePct: string;
  monthlyInstallment: string;
  totalRepaid: string;
  shareOfNetProfitPct: string;
  /** Titles per expense category, keyed by ExpenseCategory. */
  categories: Record<string, string>;
};

/** One CSV field for a semicolon-separated file: quoted when it holds ; , " or a line break. */
export function csvEscape(value: string | number | null): string {
  if (value === null) return "";
  const text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : value;
  return /[;,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const rp = (value: number | null) => (value === null ? null : Math.round(value));
const dec = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

/** Excel-friendly CSV: UTF-8 BOM, `sep=;` hint, CRLF line breaks. Rupiah are plain integers. */
export function loanSummaryCsv(summary: LoanSummary, labels: CsvLabels): string {
  const lines: (string | number | null)[][] = [];
  const section = (title: string) => {
    if (lines.length > 0) lines.push([]);
    lines.push([title]);
  };
  const { store, monthly } = summary;

  section(labels.sectionStore);
  lines.push([labels.storeName, store.name], [labels.businessType, store.businessType], [labels.targetMarket, store.targetMarket]);
  lines.push([labels.ownerName, store.ownerName], [labels.operatingDays, store.operatingDaysPerMonth]);

  section(labels.sectionMonthly);
  lines.push([labels.grossRevenue, rp(monthly.grossRevenue)], [labels.materialCosts, rp(monthly.materialCosts)], [labels.grossProfit, rp(monthly.grossProfit)]);
  lines.push([labels.depreciation, rp(monthly.depreciation)], [labels.fixedCostsTotal, rp(monthly.fixedCostsTotal)]);
  lines.push([labels.netProfit, rp(monthly.netProfit)], [labels.netMarginPct, dec(monthly.netMarginPct)]);

  section(labels.sectionFixedCosts);
  for (const row of monthly.fixedCostsByCategory) lines.push([labels.categories[row.category] ?? row.category, rp(row.amount)]);

  section(labels.sectionProducts);
  lines.push([labels.product, labels.channel, labels.price, labels.fullCost, labels.materialCost, labels.marginPct, labels.estMonthlySales]);
  for (const p of summary.products) {
    lines.push([p.product, p.channel, rp(p.price), rp(p.fullCost), rp(p.materialCost), dec(p.marginPct), p.estMonthlySales]);
  }

  section(labels.sectionAssets);
  lines.push([labels.assetName, labels.qty, labels.value, labels.usefulLifeMonths]);
  for (const a of summary.assets) lines.push([a.name, a.qty, rp(a.value), a.usefulLifeMonths]);

  section(labels.sectionIndicators);
  lines.push([labels.totalCapital, rp(summary.totalCapital)], [labels.breakEvenMonthly, summary.breakEven.unitsMonthly], [labels.breakEvenDaily, summary.breakEven.unitsDaily]);
  lines.push([labels.paybackMonths, dec(summary.paybackMonths)]);

  if (summary.installment) {
    const i = summary.installment;
    section(labels.sectionInstallment);
    lines.push([labels.principal, rp(i.principal)], [labels.months, i.months], [labels.annualRatePct, i.annualRatePct]);
    lines.push([labels.monthlyInstallment, rp(i.monthly)], [labels.totalRepaid, rp(i.totalRepaid)], [labels.shareOfNetProfitPct, i.shareOfNetProfitPct]);
  }

  return "﻿sep=;\r\n" + lines.map((row) => row.map(csvEscape).join(";")).join("\r\n") + "\r\n";
}
