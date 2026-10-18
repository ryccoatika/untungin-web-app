import {
  EXPENSE_CATEGORIES,
  assetValue,
  monthlyAmount,
  type ExpenseCategory,
  type StoreAnalysis,
  type StoreData,
} from "@/lib/calc";
import { monthlyInstallment, type InstallmentInput } from "./installment";

export type LoanSummary = {
  store: { name: string; businessType: string; targetMarket: string | null; ownerName: string | null; operatingDaysPerMonth: number };
  monthly: {
    grossRevenue: number;
    /** Commission and per-order fees the channels keep: grossRevenue − netRevenue. */
    channelFees: number;
    materialCosts: number;
    grossProfit: number;
    fixedCostsByCategory: { category: ExpenseCategory; amount: number }[];
    depreciation: number;
    fixedCostsTotal: number;
    netProfit: number;
    netMarginPct: number | null;
  };
  products: {
    product: string;
    channel: string;
    price: number;
    fullCost: number | null;
    materialCost: number;
    marginPct: number | null;
    estMonthlySales: number;
  }[];
  assets: { name: string; qty: number; value: number; usefulLifeMonths: number }[];
  totalCapital: number;
  breakEven: { unitsMonthly: number | null; unitsDaily: number | null };
  paybackMonths: number | null;
  installment: {
    principal: number;
    months: number;
    annualRatePct: number;
    monthly: number;
    totalRepaid: number;
    shareOfNetProfitPct: number | null;
  } | null;
  missing: ("products" | "salesEstimate" | "assets")[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildLoanSummary(
  data: StoreData,
  analysis: StoreAnalysis,
  info: { businessType: string; targetMarket: string | null; ownerName: string | null },
  installment: InstallmentInput | null,
): LoanSummary {
  const days = data.store.operatingDaysPerMonth;
  const fixedCostsByCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    amount: data.expenses.filter((e) => e.category === category).reduce((sum, e) => sum + monthlyAmount(e, days), 0),
  })).filter((row) => row.amount !== 0);

  const productNames = new Map(data.products.map((p) => [p.id, p.name]));
  const channelNames = new Map(data.channels.map((c) => [c.id, c.name]));

  const missing: LoanSummary["missing"] = [];
  if (analysis.lines.length === 0) missing.push("products");
  else if (analysis.totalUnits <= 0) missing.push("salesEstimate");
  if (data.assets.length === 0) missing.push("assets");

  let installmentSummary: LoanSummary["installment"] = null;
  if (installment) {
    const monthly = monthlyInstallment(installment.principal, installment.annualRatePct, installment.months);
    installmentSummary = {
      principal: installment.principal,
      months: installment.months,
      annualRatePct: installment.annualRatePct,
      monthly,
      totalRepaid: monthly * installment.months,
      shareOfNetProfitPct: analysis.netProfit > 0 ? round1((monthly / analysis.netProfit) * 100) : null,
    };
  }

  return {
    store: { name: data.store.name, businessType: info.businessType, targetMarket: info.targetMarket, ownerName: info.ownerName, operatingDaysPerMonth: days },
    monthly: {
      grossRevenue: analysis.grossRevenue,
      channelFees: analysis.grossRevenue - analysis.netRevenue,
      materialCosts: analysis.materialCosts,
      grossProfit: analysis.grossProfit,
      fixedCostsByCategory,
      depreciation: analysis.fixedCosts.depreciation,
      fixedCostsTotal: analysis.fixedCosts.total,
      netProfit: analysis.netProfit,
      netMarginPct: analysis.netMarginPct,
    },
    products: analysis.lines.map((line) => ({
      product: productNames.get(line.productId) ?? "",
      channel: channelNames.get(line.channelId) ?? "",
      price: line.price,
      fullCost: line.fullCost,
      materialCost: line.materialCost,
      marginPct: line.marginPct,
      estMonthlySales: line.estMonthlySales,
    })),
    assets: data.assets.map((a) => ({ name: a.name, qty: a.qty, value: assetValue(a), usefulLifeMonths: a.usefulLifeMonths })),
    totalCapital: analysis.totalCapital,
    breakEven: { unitsMonthly: analysis.bepUnitsMonthly, unitsDaily: analysis.bepUnitsDaily },
    paybackMonths: analysis.totalCapital > 0 ? analysis.paybackMonths : null,
    installment: installmentSummary,
    missing,
  };
}
