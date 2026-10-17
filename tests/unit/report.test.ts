import { describe, expect, it } from "vitest";
import { analyzeStore, type StoreData } from "@/lib/calc";
import { buildDemoStore, demoAsStoreData } from "@/lib/seed/demo-store";
import { csvEscape, loanSummaryCsv, type CsvLabels } from "@/lib/report/csv";
import { monthlyInstallment, parseInstallmentParams } from "@/lib/report/installment";
import { buildLoanSummary } from "@/lib/report/loan-summary";

const info = { businessType: "Kafe", targetMarket: "Mahasiswa", ownerName: "Sari" };

function sample(installment: { principal: number; months: number; annualRatePct: number } | null = null, name?: string) {
  const data = demoAsStoreData(buildDemoStore("id"));
  if (name) data.store.name = name;
  const analysis = analyzeStore(data);
  return { data, analysis, summary: buildLoanSummary(data, analysis, info, installment) };
}

function allNumbersValid(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allNumbersValid);
  if (value && typeof value === "object") return Object.values(value).every(allNumbersValid);
  return true;
}

describe("monthlyInstallment", () => {
  it("computes the annuity in whole Rupiah", () => {
    expect(monthlyInstallment(10_000_000, 6, 12)).toBe(860_664);
    expect(monthlyInstallment(12_000_000, 0, 12)).toBe(1_000_000);
    expect(monthlyInstallment(1_000_000, 6, 1)).toBe(1_005_000);
    expect(monthlyInstallment(2_000_000_000, 6, 60)).toBe(38_665_603);
  });
});

describe("parseInstallmentParams", () => {
  it("returns null input without params", () => {
    expect(parseInstallmentParams({})).toEqual({ input: null, errors: [] });
  });
  it("defaults the rate to 6", () => {
    expect(parseInstallmentParams({ pinjaman: "10.000.000", tenor: "12" })).toEqual({
      input: { principal: 10_000_000, months: 12, annualRatePct: 6 },
      errors: [],
    });
  });
  it("reads a decimal comma", () => {
    expect(parseInstallmentParams({ pinjaman: "5000000", tenor: "6", bunga: "6,5" }).input?.annualRatePct).toBe(6.5);
  });
  it("rejects a principal above the cap", () => {
    expect(parseInstallmentParams({ pinjaman: "2000000000", tenor: "12" }).errors).toEqual([]);
    expect(parseInstallmentParams({ pinjaman: "2000000001", tenor: "12" }).errors).toEqual(["principal"]);
  });
  it("flags bad tenor, principal and rate", () => {
    expect(parseInstallmentParams({ pinjaman: "1000000", tenor: "0" }).errors).toEqual(["months"]);
    expect(parseInstallmentParams({ pinjaman: "1000000", tenor: "61" }).errors).toEqual(["months"]);
    expect(parseInstallmentParams({ pinjaman: "abc", tenor: "12" }).errors).toEqual(["principal"]);
    expect(parseInstallmentParams({ pinjaman: "1000000", tenor: "12", bunga: "31" }).errors).toEqual(["rate"]);
  });
  it("takes the first value of arrays", () => {
    expect(parseInstallmentParams({ pinjaman: ["1000000", "9"], tenor: ["12"] }).input?.principal).toBe(1_000_000);
  });
});

describe("buildLoanSummary", () => {
  it("matches the analysis for the sample store", () => {
    const { analysis, summary } = sample();
    expect(summary.monthly.netProfit).toBe(analysis.netProfit);
    expect(summary.products.length).toBeGreaterThan(0);
    expect(summary.assets.length).toBeGreaterThan(0);
    expect(summary.missing).toEqual([]);
    expect(allNumbersValid(summary)).toBe(true);
  });
  it("splits fixed costs by category", () => {
    const { summary } = sample();
    const sum = summary.monthly.fixedCostsByCategory.reduce((s, r) => s + r.amount, 0);
    expect(Math.abs(sum - (summary.monthly.fixedCostsTotal - summary.monthly.depreciation))).toBeLessThan(1);
  });
  it("computes the instalment share of net profit", () => {
    const { analysis, summary } = sample({ principal: 10_000_000, months: 12, annualRatePct: 6 });
    const i = summary.installment!;
    expect(i.monthly).toBe(860_664);
    expect(i.totalRepaid).toBe(860_664 * 12);
    expect(i.shareOfNetProfitPct).toBe(Math.round((860_664 / analysis.netProfit) * 1000) / 10);
  });
  it("copes with a store without prices", () => {
    const data: StoreData = { ...demoAsStoreData(buildDemoStore("id")), prices: [] };
    const summary = buildLoanSummary(data, analyzeStore(data), info, { principal: 1_000_000, months: 6, annualRatePct: 6 });
    expect(summary.missing).toContain("products");
    expect(allNumbersValid(summary)).toBe(true);
    expect(summary.installment?.shareOfNetProfitPct).toBeNull();
  });
  it("reports missing assets and missing sales estimates", () => {
    const noAssets: StoreData = { ...demoAsStoreData(buildDemoStore("id")), assets: [] };
    expect(buildLoanSummary(noAssets, analyzeStore(noAssets), info, null).missing).toContain("assets");
    const base = demoAsStoreData(buildDemoStore("id"));
    const noSales: StoreData = { ...base, prices: base.prices.map((p) => ({ ...p, estMonthlySales: 0 })) };
    const summary = buildLoanSummary(noSales, analyzeStore(noSales), info, null);
    expect(summary.missing).toContain("salesEstimate");
    expect(allNumbersValid(summary)).toBe(true);
  });
  it("gives a null share when net profit is not positive", () => {
    const data = demoAsStoreData(buildDemoStore("id"));
    data.expenses.push({ id: "big", name: "Big", category: "lainnya", amount: 1_000_000_000, frequency: "bulanan" });
    const analysis = analyzeStore(data);
    expect(analysis.netProfit).toBeLessThanOrEqual(0);
    const summary = buildLoanSummary(data, analysis, info, { principal: 1_000_000, months: 6, annualRatePct: 6 });
    expect(summary.installment?.shareOfNetProfitPct).toBeNull();
  });
});

const labels: CsvLabels = {
  ...Object.fromEntries(
    [
      "sectionStore", "sectionMonthly", "sectionFixedCosts", "sectionProducts", "sectionAssets", "sectionIndicators", "sectionInstallment",
      "storeName", "businessType", "targetMarket", "ownerName", "operatingDays", "grossRevenue", "materialCosts", "grossProfit",
      "depreciation", "fixedCostsTotal", "netProfit", "netMarginPct", "product", "channel", "price", "fullCost", "materialCost",
      "marginPct", "estMonthlySales", "assetName", "qty", "value", "usefulLifeMonths", "totalCapital", "breakEvenMonthly",
      "breakEvenDaily", "paybackMonths", "principal", "months", "annualRatePct", "monthlyInstallment", "totalRepaid", "shareOfNetProfitPct",
    ].map((key) => [key, `L_${key}`]),
  ),
  categories: {},
} as CsvLabels;

describe("csv", () => {
  it("escapes fields", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(5)).toBe("5");
    expect(csvEscape("a b")).toBe("a b");
    expect(csvEscape('Kopi "Senja"; susu, gula\nbaru')).toBe('"Kopi ""Senja""; susu, gula\nbaru"');
  });
  it("neutralises spreadsheet formulas in strings only", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvEscape("+1")).toBe("'+1");
    expect(csvEscape("-1")).toBe("'-1");
    expect(csvEscape(-5)).toBe("-5");
    const { data, analysis } = sample();
    data.products[0].name = '=HYPERLINK("x")';
    const csv = loanSummaryCsv(buildLoanSummary(data, analysis, info, null), labels);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).not.toContain(";=HYPERLINK");
  });
  it("builds an Excel-friendly file", () => {
    const { summary } = sample({ principal: 10_000_000, months: 12, annualRatePct: 6 }, 'Kopi "Senja"; susu, gula\nbaru');
    const csv = loanSummaryCsv(summary, labels);
    expect(csv.startsWith("\uFEFFsep=;\r\n")).toBe(true);
    expect(csv).toContain('"Kopi ""Senja""; susu, gula\nbaru"');
    expect(csv).toContain(`L_netProfit;${summary.monthly.netProfit}\r\n`);
    const netLine = csv.split("\r\n").find((line) => line.startsWith("L_netProfit;"));
    expect(netLine).toBe(`L_netProfit;${Math.round(summary.monthly.netProfit)}`);
    for (const key of ["sectionStore", "sectionMonthly", "sectionFixedCosts", "sectionProducts", "sectionAssets", "sectionIndicators", "sectionInstallment"]) {
      expect(csv.split(`L_${key}\r\n`).length - 1).toBe(1);
    }
  });
});
