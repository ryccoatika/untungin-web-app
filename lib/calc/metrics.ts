import { monthlyDepreciation, totalCapital } from "./assets";
import { monthlyExpenses } from "./expenses";
import { mapById, materialCostPerUnit } from "./products";
import type { StoreData } from "./types";

export type LineStatus = "red" | "yellow" | "green";

/** One product sold through one channel (spec §4.2 items 2, 4, 5 and §4.3). */
export type MetricsLine = {
  productId: string;
  channelId: string;
  price: number;
  estMonthlySales: number;
  competitorPrice: number | null;
  /** hppBahan */
  materialCost: number;
  /** hppPenuh: materialCost + overhead; null when there are no sales estimates. */
  fullCost: number | null;
  /** net: price after commission and fixed fee. */
  netPrice: number;
  /** kontribusi: netPrice − materialCost. */
  contribution: number;
  /** (netPrice − (fullCost ?? materialCost)) / price × 100; null when the price is 0. */
  marginPct: number | null;
  targetMarginPct: number;
  status: LineStatus;
};

export type StoreMetrics = {
  lines: MetricsLine[];
  /** Active products that have no price in any channel yet. */
  productsWithoutPrice: string[];
  fixedCosts: { expenses: number; depreciation: number; total: number };
  totalUnits: number;
  overheadPerUnit: number | null;
  grossRevenue: number;
  netRevenue: number;
  materialCosts: number;
  grossProfit: number;
  netProfit: number;
  netMarginPct: number | null;
  avgContribution: number | null;
  bepUnitsMonthly: number | null;
  bepUnitsDaily: number | null;
  totalCapital: number;
  paybackMonths: number | null;
};

/** Rounds up, ignoring floating-point noise just above a whole number (141.0000000001 → 141). */
function ceilUnits(value: number): number {
  return Math.ceil(value - 1e-9) || 0;
}

export function lineStatus(contribution: number, marginPct: number | null, targetMarginPct: number): LineStatus {
  if (contribution < 0) return "red";
  if (marginPct === null || marginPct < targetMarginPct) return "yellow";
  return "green";
}

export function computeMetrics(data: StoreData): StoreMetrics {
  const days = data.store.operatingDaysPerMonth;
  const materials = mapById(data.materials);
  const channels = mapById(data.channels);
  const activeProducts = data.products.filter((product) => product.isActive);
  const products = mapById(activeProducts);
  const priceRows = data.prices.filter((row) => products.has(row.productId) && channels.has(row.channelId));

  const expenses = monthlyExpenses(data.expenses, days);
  const depreciation = monthlyDepreciation(data.assets);
  const fixedTotal = expenses + depreciation;
  const totalUnits = priceRows.reduce((sum, row) => sum + row.estMonthlySales, 0);
  const overheadPerUnit = totalUnits > 0 ? fixedTotal / totalUnits : null;

  const lines: MetricsLine[] = priceRows.map((row) => {
    const product = products.get(row.productId)!;
    const channel = channels.get(row.channelId)!;
    const materialCost = materialCostPerUnit(product, data.composition, materials, channel.id);
    const fullCost = overheadPerUnit === null ? null : materialCost + overheadPerUnit;
    const netPrice = row.price * (1 - channel.commissionPct / 100) - channel.fixedFee;
    const contribution = netPrice - materialCost;
    const marginPct = row.price > 0 ? ((netPrice - (fullCost ?? materialCost)) / row.price) * 100 : null;
    const targetMarginPct = product.targetMarginPct ?? data.store.targetMarginPct;
    return {
      productId: row.productId,
      channelId: row.channelId,
      price: row.price,
      estMonthlySales: row.estMonthlySales,
      competitorPrice: row.competitorPrice,
      materialCost,
      fullCost,
      netPrice,
      contribution,
      marginPct,
      targetMarginPct,
      status: lineStatus(contribution, marginPct, targetMarginPct),
    };
  });

  const sum = (pick: (line: MetricsLine) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const grossRevenue = sum((l) => l.price * l.estMonthlySales);
  const netRevenue = sum((l) => l.netPrice * l.estMonthlySales);
  const materialCosts = sum((l) => l.materialCost * l.estMonthlySales);
  const grossProfit = netRevenue - materialCosts;
  const netProfit = grossProfit - fixedTotal;
  const avgContribution = totalUnits > 0 ? sum((l) => l.contribution * l.estMonthlySales) / totalUnits : null;
  const bepUnitsMonthly = avgContribution !== null && avgContribution > 0 ? ceilUnits(fixedTotal / avgContribution) : null;
  const capital = totalCapital(data.assets);

  return {
    lines,
    productsWithoutPrice: activeProducts
      .filter((product) => !lines.some((line) => line.productId === product.id))
      .map((product) => product.id),
    fixedCosts: { expenses, depreciation, total: fixedTotal },
    totalUnits,
    overheadPerUnit,
    grossRevenue,
    netRevenue,
    materialCosts,
    grossProfit,
    netProfit,
    netMarginPct: grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : null,
    avgContribution,
    bepUnitsMonthly,
    bepUnitsDaily: bepUnitsMonthly === null ? null : ceilUnits(bepUnitsMonthly / days),
    totalCapital: capital,
    paybackMonths: netProfit > 0 ? capital / netProfit : null,
  };
}
