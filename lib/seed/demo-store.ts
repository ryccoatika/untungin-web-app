import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/routing";
import type { AssetCategory, Basis, ExpenseCategory, Frequency, MaterialCategory, StoreData, Unit } from "@/lib/calc";
import { findTemplate } from "@/lib/config/channel-templates";
import type { Database } from "@/lib/supabase/database.types";

type Text = Record<AppLocale, string>;
const L = (id: string, en: string): Text => ({ id, en });

type MaterialSpec = { key: string; name: Text; category: MaterialCategory; qty: number; unit: Unit; price: number };
type ProductSpec = { key: string; name: Text; yieldQty: number };
type RowSpec = { product: string; material: string; qty: number; unit: Unit; basis: Basis; channel?: "gofood" };
type PriceSpec = { product: string; channel: "cash" | "gofood"; price: number; est: number; competitor: number | null };
type ExpenseSpec = { name: Text; category: ExpenseCategory; amount: number; frequency: Frequency };
type AssetSpec = { name: Text; category: AssetCategory; qty: number; unitPrice: number; months: number };

const STORE = {
  name: L("Kedai Kopi Contoh", "Sample Coffee Shop"),
  businessType: "minuman",
  targetMarket: "menengah",
  operatingDaysPerMonth: 26,
  targetMarginPct: 40,
};
const CASH_NAME = L("Offline – Tunai", "Offline – Cash");

const MATERIALS: MaterialSpec[] = [
  { key: "kopi", name: L("Kopi bubuk", "Ground coffee"), category: "bahan", qty: 1, unit: "kg", price: 180_000 },
  { key: "susu", name: L("Susu UHT", "UHT milk"), category: "bahan", qty: 1, unit: "l", price: 18_000 },
  { key: "aren", name: L("Gula aren cair", "Palm sugar syrup"), category: "bahan", qty: 1, unit: "l", price: 45_000 },
  { key: "es", name: L("Es batu", "Ice"), category: "bahan", qty: 5, unit: "kg", price: 10_000 },
  { key: "teh", name: L("Teh celup", "Tea bags"), category: "bahan", qty: 25, unit: "pcs", price: 12_000 },
  { key: "cup", name: L("Cup plastik 16 oz", "16 oz plastic cup"), category: "kemasan", qty: 50, unit: "pcs", price: 35_000 },
  { key: "sedotan", name: L("Sedotan", "Straws"), category: "kemasan", qty: 100, unit: "pcs", price: 15_000 },
  { key: "bag", name: L("Paper bag (online)", "Paper bag (online)"), category: "kemasan", qty: 50, unit: "pcs", price: 40_000 },
];

const PRODUCTS: ProductSpec[] = [
  { key: "kopisusu", name: L("Es kopi susu gula aren", "Iced palm sugar latte"), yieldQty: 1 },
  { key: "americano", name: L("Es americano", "Iced americano"), yieldQty: 1 },
  { key: "teh", name: L("Es teh manis", "Iced sweet tea"), yieldQty: 1 },
];

const COMPOSITION: RowSpec[] = [
  { product: "kopisusu", material: "kopi", qty: 18, unit: "g", basis: "unit" },
  { product: "kopisusu", material: "susu", qty: 150, unit: "ml", basis: "unit" },
  { product: "kopisusu", material: "aren", qty: 20, unit: "ml", basis: "unit" },
  { product: "kopisusu", material: "es", qty: 100, unit: "g", basis: "unit" },
  { product: "kopisusu", material: "cup", qty: 1, unit: "pcs", basis: "unit" },
  { product: "kopisusu", material: "sedotan", qty: 1, unit: "pcs", basis: "unit" },
  { product: "kopisusu", material: "bag", qty: 1, unit: "pcs", basis: "unit", channel: "gofood" },
  { product: "americano", material: "kopi", qty: 18, unit: "g", basis: "unit" },
  { product: "americano", material: "es", qty: 100, unit: "g", basis: "unit" },
  { product: "americano", material: "cup", qty: 1, unit: "pcs", basis: "unit" },
  { product: "americano", material: "sedotan", qty: 1, unit: "pcs", basis: "unit" },
  { product: "americano", material: "bag", qty: 1, unit: "pcs", basis: "unit", channel: "gofood" },
  { product: "teh", material: "teh", qty: 1, unit: "pcs", basis: "unit" },
  { product: "teh", material: "aren", qty: 15, unit: "ml", basis: "unit" },
  { product: "teh", material: "es", qty: 150, unit: "g", basis: "unit" },
  { product: "teh", material: "cup", qty: 1, unit: "pcs", basis: "unit" },
  { product: "teh", material: "sedotan", qty: 1, unit: "pcs", basis: "unit" },
  { product: "teh", material: "bag", qty: 1, unit: "pcs", basis: "unit", channel: "gofood" },
];

const PRICES: PriceSpec[] = [
  { product: "kopisusu", channel: "cash", price: 22_000, est: 600, competitor: 20_000 },
  { product: "kopisusu", channel: "gofood", price: 27_000, est: 300, competitor: 26_000 },
  { product: "americano", channel: "cash", price: 15_000, est: 300, competitor: 22_000 },
  { product: "americano", channel: "gofood", price: 19_000, est: 150, competitor: null },
  { product: "teh", channel: "cash", price: 8_000, est: 400, competitor: 7_000 },
  { product: "teh", channel: "gofood", price: 10_000, est: 100, competitor: null },
];

const EXPENSES: ExpenseSpec[] = [
  { name: L("Sewa tempat", "Rent"), category: "sewa", amount: 1_500_000, frequency: "bulanan" },
  { name: L("Listrik & air", "Electricity & water"), category: "listrik_air", amount: 400_000, frequency: "bulanan" },
  { name: L("Internet", "Internet"), category: "internet_pulsa", amount: 150_000, frequency: "bulanan" },
  { name: L("Gaji saya", "My salary"), category: "gaji_pemilik", amount: 3_000_000, frequency: "bulanan" },
  { name: L("Promosi media sosial", "Social media ads"), category: "pemasaran", amount: 50_000, frequency: "mingguan" },
];

const ASSETS: AssetSpec[] = [
  { name: L("Mesin espresso", "Espresso machine"), category: "peralatan", qty: 1, unitPrice: 8_000_000, months: 60 },
  { name: L("Grinder kopi", "Coffee grinder"), category: "peralatan", qty: 1, unitPrice: 2_500_000, months: 48 },
  { name: L("Kulkas", "Fridge"), category: "elektronik", qty: 1, unitPrice: 3_000_000, months: 60 },
  { name: L("Meja & kursi", "Tables & chairs"), category: "furnitur", qty: 2, unitPrice: 750_000, months: 36 },
];

/** The sample store in one language (spec §5.1): plain data with keys instead of database ids. */
export type DemoStore = {
  store: { name: string; businessType: string; targetMarket: string; operatingDaysPerMonth: number; targetMarginPct: number };
  channels: { key: "cash" | "gofood"; name: string; commissionPct: number; fixedFee: number }[];
  materials: { key: string; name: string; category: MaterialCategory; purchaseQty: number; purchaseUnit: Unit; purchasePrice: number }[];
  products: { key: string; name: string; yieldQty: number }[];
  composition: RowSpec[];
  prices: PriceSpec[];
  expenses: { name: string; category: ExpenseCategory; amount: number; frequency: Frequency }[];
  assets: { name: string; category: AssetCategory; qty: number; unitPrice: number; usefulLifeMonths: number }[];
};

export function buildDemoStore(locale: AppLocale): DemoStore {
  const gofood = findTemplate("gofood")!;
  return {
    store: { ...STORE, name: STORE.name[locale] },
    channels: [
      { key: "cash", name: CASH_NAME[locale], commissionPct: 0, fixedFee: 0 },
      { key: "gofood", name: gofood.name, commissionPct: gofood.commissionPct, fixedFee: gofood.fixedFee },
    ],
    materials: MATERIALS.map((m) => ({
      key: m.key,
      name: m.name[locale],
      category: m.category,
      purchaseQty: m.qty,
      purchaseUnit: m.unit,
      purchasePrice: m.price,
    })),
    products: PRODUCTS.map((p) => ({ key: p.key, name: p.name[locale], yieldQty: p.yieldQty })),
    composition: COMPOSITION,
    prices: PRICES,
    expenses: EXPENSES.map((e) => ({ name: e.name[locale], category: e.category, amount: e.amount, frequency: e.frequency })),
    assets: ASSETS.map((a) => ({ name: a.name[locale], category: a.category, qty: a.qty, unitPrice: a.unitPrice, usefulLifeMonths: a.months })),
  };
}

/** The same store as lib/calc input, with keys as ids — lets tests check the numbers without a database. */
export function demoAsStoreData(demo: DemoStore): StoreData {
  return {
    store: { id: "demo", name: demo.store.name, targetMarginPct: demo.store.targetMarginPct, operatingDaysPerMonth: demo.store.operatingDaysPerMonth },
    materials: demo.materials.map((m) => ({ id: m.key, name: m.name, category: m.category, purchaseQty: m.purchaseQty, purchaseUnit: m.purchaseUnit, purchasePrice: m.purchasePrice, wastePct: 0 })),
    products: demo.products.map((p) => ({ id: p.key, name: p.name, category: null, yieldQty: p.yieldQty, targetMarginPct: null, isActive: true })),
    composition: demo.composition.map((row, i) => ({ id: `c${i}`, productId: row.product, materialId: row.material, qty: row.qty, unit: row.unit, basis: row.basis, channelId: row.channel ?? null })),
    channels: demo.channels.map((c) => ({ id: c.key, name: c.name, commissionPct: c.commissionPct, fixedFee: c.fixedFee })),
    prices: demo.prices.map((p) => ({ productId: p.product, channelId: p.channel, price: p.price, estMonthlySales: p.est, competitorPrice: p.competitor })),
    expenses: demo.expenses.map((e, i) => ({ id: `e${i}`, name: e.name, category: e.category, amount: e.amount, frequency: e.frequency })),
    assets: demo.assets.map((a, i) => ({ id: `a${i}`, name: a.name, category: a.category, qty: a.qty, unitPrice: a.unitPrice, usefulLifeMonths: a.usefulLifeMonths })),
  };
}

export type SeedResult = { storeId: string } | { error: "duplicate" | "limit" | "failed" };

// SQLSTATE raised by the stores_enforce_limit trigger (20261016000003_store_limit.sql).
export const STORE_LIMIT_ERROR_CODE = "UT001";

/**
 * Writes the sample store with the signed-in user's client (RLS applies). If anything fails after the
 * store exists, the store is deleted — every other row cascades — so nothing half-made is left behind.
 */
export async function seedDemoStore(supabase: SupabaseClient<Database>, demo: DemoStore, storeName: string): Promise<SeedResult> {
  const created = await supabase.rpc("create_store", {
    p_name: storeName,
    p_business_type: demo.store.businessType,
    p_operating_days: demo.store.operatingDaysPerMonth,
    p_target_margin: demo.store.targetMarginPct,
    p_target_market: demo.store.targetMarket,
    p_default_channel_name: demo.channels[0].name,
  });
  if (created.error?.code === "23505") return { error: "duplicate" };
  if (created.error?.code === STORE_LIMIT_ERROR_CODE) return { error: "limit" };
  if (created.error || !created.data) return { error: "failed" };
  const storeId = created.data as string;

  try {
    const must = <T>(result: { data: T; error: unknown }): NonNullable<T> => {
      if (result.error || result.data === null || result.data === undefined) throw result.error ?? new Error("no data");
      return result.data as NonNullable<T>;
    };

    const cash = must(await supabase.from("sales_channels").select("id").eq("store_id", storeId).single());
    const gofoodSpec = demo.channels[1];
    const gofood = must(
      await supabase
        .from("sales_channels")
        .insert({ store_id: storeId, name: gofoodSpec.name, commission_pct: gofoodSpec.commissionPct, fixed_fee: gofoodSpec.fixedFee, sort_order: 1 })
        .select("id")
        .single(),
    );
    const channelIds: Record<"cash" | "gofood", string> = { cash: cash.id, gofood: gofood.id };

    const materials = must(
      await supabase
        .from("materials")
        .insert(demo.materials.map((m) => ({ store_id: storeId, name: m.name, category: m.category, purchase_qty: m.purchaseQty, purchase_unit: m.purchaseUnit, purchase_price: m.purchasePrice })))
        .select("id, name"),
    );
    const products = must(
      await supabase
        .from("products")
        .insert(demo.products.map((p) => ({ store_id: storeId, name: p.name, yield_qty: p.yieldQty })))
        .select("id, name"),
    );
    const materialIds = new Map(demo.materials.map((m) => [m.key, materials.find((row) => row.name === m.name)!.id]));
    const productIds = new Map(demo.products.map((p) => [p.key, products.find((row) => row.name === p.name)!.id]));

    must(
      await supabase
        .from("product_materials")
        .insert(
          demo.composition.map((row) => ({
            store_id: storeId,
            product_id: productIds.get(row.product)!,
            material_id: materialIds.get(row.material)!,
            qty: row.qty,
            unit: row.unit,
            basis: row.basis,
            channel_id: row.channel ? channelIds[row.channel] : null,
          })),
        )
        .select("id"),
    );
    must(
      await supabase
        .from("product_channel_prices")
        .insert(
          demo.prices.map((p) => ({
            store_id: storeId,
            product_id: productIds.get(p.product)!,
            channel_id: channelIds[p.channel],
            price: p.price,
            est_monthly_sales: p.est,
            competitor_price: p.competitor,
          })),
        )
        .select("id"),
    );
    must(await supabase.from("operating_expenses").insert(demo.expenses.map((e) => ({ store_id: storeId, ...e }))).select("id"));
    must(
      await supabase
        .from("assets")
        .insert(demo.assets.map((a) => ({ store_id: storeId, name: a.name, category: a.category, qty: a.qty, unit_price: a.unitPrice, useful_life_months: a.usefulLifeMonths })))
        .select("id"),
    );
    return { storeId };
  } catch {
    try {
      const cleanup = await supabase.from("stores").delete().eq("id", storeId);
      if (cleanup.error) console.error("Sample store cleanup failed:", cleanup.error.message);
    } catch (error) {
      console.error("Sample store cleanup failed:", error instanceof Error ? error.message : String(error));
    }
    return { error: "failed" };
  }
}
