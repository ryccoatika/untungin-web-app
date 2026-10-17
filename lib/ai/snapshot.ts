import { createHash } from "node:crypto";
import type { AppLocale } from "@/i18n/routing";
import {
  monthlyAmount,
  type ExpenseCategory,
  type LineStatus,
  type StoreAnalysis,
  type StoreData,
  type WarningCode,
} from "@/lib/calc";

export type SnapshotStoreInfo = { businessType: string; targetMarket: string | null };

export type SnapshotLine = {
  channelId: string;
  price: number;
  competitorPrice: number | null;
  estMonthlySales: number;
  materialCost: number;
  fullCost: number | null;
  netPrice: number;
  contribution: number;
  marginPct: number | null;
  targetMarginPct: number;
  status: LineStatus;
};

/** What the AI sees (spec §6.1 step 3). Plain JSON; numbers rounded so float noise never changes the hash. */
export type AnalysisSnapshot = {
  locale: AppLocale;
  store: {
    name: string;
    businessType: string;
    targetMarket: string | null;
    targetMarginPct: number;
    operatingDaysPerMonth: number;
  };
  channels: { id: string; name: string; commissionPct: number; fixedFee: number }[];
  materials: {
    id: string;
    name: string;
    category: string;
    purchaseQty: number;
    purchaseUnit: string;
    purchasePrice: number;
    wastePct: number;
  }[];
  products: { id: string; name: string; lines: SnapshotLine[] }[];
  totals: {
    grossRevenue: number;
    netRevenue: number;
    materialCosts: number;
    netProfit: number;
    netMarginPct: number | null;
    totalUnits: number;
    fixedCosts: { byCategory: Partial<Record<ExpenseCategory, number>>; depreciation: number; total: number };
    bepUnitsMonthly: number | null;
    bepUnitsDaily: number | null;
    totalCapital: number;
    paybackMonths: number | null;
  };
  warnings: { code: WarningCode; lines: { productId: string; channelId: string }[] }[];
};

/** Whole Rupiah; `|| 0` turns -0 into 0. Throws on NaN or Infinity. */
const rupiah = (value: number) => {
  if (!isFinite(value)) throw new Error("Non-finite number in AI snapshot");
  return Math.round(value) || 0;
};
/** One decimal, for percentages, months and quantities. Throws on NaN or Infinity. */
const oneDecimal = (value: number) => {
  if (!isFinite(value)) throw new Error("Non-finite number in AI snapshot");
  return Math.round(value * 10) / 10 || 0;
};
const maybe = <T>(value: T | null, round: (v: T) => number) => (value === null ? null : round(value));

export function buildSnapshot(
  data: StoreData,
  analysis: StoreAnalysis,
  info: SnapshotStoreInfo,
  locale: AppLocale,
): AnalysisSnapshot {
  const byCategory: Partial<Record<ExpenseCategory, number>> = {};
  for (const expense of data.expenses) {
    byCategory[expense.category] = (byCategory[expense.category] ?? 0) + monthlyAmount(expense, data.store.operatingDaysPerMonth);
  }
  for (const category of Object.keys(byCategory) as ExpenseCategory[]) {
    byCategory[category] = rupiah(byCategory[category]!);
  }

  return {
    locale,
    store: {
      name: data.store.name,
      businessType: info.businessType,
      targetMarket: info.targetMarket,
      targetMarginPct: oneDecimal(data.store.targetMarginPct),
      operatingDaysPerMonth: data.store.operatingDaysPerMonth,
    },
    channels: data.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      commissionPct: oneDecimal(channel.commissionPct),
      fixedFee: rupiah(channel.fixedFee),
    })),
    materials: data.materials.map((material) => ({
      id: material.id,
      name: material.name,
      category: material.category,
      purchaseQty: oneDecimal(material.purchaseQty),
      purchaseUnit: material.purchaseUnit,
      purchasePrice: rupiah(material.purchasePrice),
      wastePct: oneDecimal(material.wastePct),
    })),
    products: data.products
      .filter((product) => product.isActive)
      .map((product) => ({
        id: product.id,
        name: product.name,
        lines: analysis.lines
          .filter((line) => line.productId === product.id)
          .map((line) => ({
            channelId: line.channelId,
            price: rupiah(line.price),
            competitorPrice: maybe(line.competitorPrice, rupiah),
            estMonthlySales: oneDecimal(line.estMonthlySales),
            materialCost: rupiah(line.materialCost),
            fullCost: maybe(line.fullCost, rupiah),
            netPrice: rupiah(line.netPrice),
            contribution: rupiah(line.contribution),
            marginPct: maybe(line.marginPct, oneDecimal),
            targetMarginPct: oneDecimal(line.targetMarginPct),
            status: line.status,
          })),
      })),
    totals: {
      grossRevenue: rupiah(analysis.grossRevenue),
      netRevenue: rupiah(analysis.netRevenue),
      materialCosts: rupiah(analysis.materialCosts),
      netProfit: rupiah(analysis.netProfit),
      netMarginPct: maybe(analysis.netMarginPct, oneDecimal),
      totalUnits: oneDecimal(analysis.totalUnits),
      fixedCosts: {
        byCategory,
        depreciation: rupiah(analysis.fixedCosts.depreciation),
        total: rupiah(analysis.fixedCosts.total),
      },
      bepUnitsMonthly: analysis.bepUnitsMonthly,
      bepUnitsDaily: analysis.bepUnitsDaily,
      totalCapital: rupiah(analysis.totalCapital),
      // Without assets there is nothing to pay back (the dashboard shows "—" too).
      paybackMonths: analysis.totalCapital > 0 ? maybe(analysis.paybackMonths, oneDecimal) : null,
    },
    warnings: analysis.warnings.map((warning) => ({
      code: warning.code,
      lines: warning.lines.map((line) => ({ productId: line.productId, channelId: line.channelId })),
    })),
  };
}

/** JSON with object keys sorted at every level, so equal data always gives equal text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function snapshotHash(snapshot: AnalysisSnapshot): string {
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}
