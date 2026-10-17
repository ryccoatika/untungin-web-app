import type { Unit } from "./units";

export const MATERIAL_CATEGORIES = ["bahan", "kemasan"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = [
  "sewa",
  "listrik_air",
  "internet_pulsa",
  "gaji_karyawan",
  "gaji_pemilik",
  "transportasi",
  "pemasaran",
  "lainnya",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const FREQUENCIES = ["harian", "mingguan", "bulanan", "tahunan"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const ASSET_CATEGORIES = [
  "peralatan",
  "furnitur",
  "elektronik",
  "kendaraan",
  "renovasi",
  "perizinan",
  "lainnya",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** `batch` = amount for one recipe (divided by yield); `unit` = amount per sold unit. */
export const BASES = ["batch", "unit"] as const;
export type Basis = (typeof BASES)[number];

export type CalcMaterial = {
  id: string;
  name: string;
  category: MaterialCategory;
  purchaseQty: number;
  purchaseUnit: Unit;
  purchasePrice: number;
  wastePct: number;
};

export type CalcProduct = {
  id: string;
  name: string;
  /** Display only; not used in calculations. */
  category?: string | null;
  yieldQty: number;
  /** Overrides the store target when not null. */
  targetMarginPct: number | null;
  isActive: boolean;
};

export type CalcCompositionRow = {
  id: string;
  productId: string;
  materialId: string;
  qty: number;
  unit: Unit;
  basis: Basis;
  /** null = used in every channel. */
  channelId: string | null;
};

export type CalcChannel = { id: string; name: string; commissionPct: number; fixedFee: number };

export type CalcPrice = {
  productId: string;
  channelId: string;
  price: number;
  estMonthlySales: number;
  competitorPrice: number | null;
};

export type CalcExpense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
};

export type CalcAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  qty: number;
  unitPrice: number;
  usefulLifeMonths: number;
};

/** Everything the calculations need for one store (spec §4). */
export type StoreData = {
  store: { id: string; name: string; targetMarginPct: number; operatingDaysPerMonth: number };
  materials: CalcMaterial[];
  products: CalcProduct[];
  composition: CalcCompositionRow[];
  channels: CalcChannel[];
  prices: CalcPrice[];
  expenses: CalcExpense[];
  assets: CalcAsset[];
};
