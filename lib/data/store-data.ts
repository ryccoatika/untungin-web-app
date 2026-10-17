import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isUnit,
  type AssetCategory,
  type Basis,
  type ExpenseCategory,
  type Frequency,
  type MaterialCategory,
  type StoreData,
  type Unit,
} from "@/lib/calc";
import type { Database } from "@/lib/supabase/database.types";

function unit(value: string): Unit {
  if (!isUnit(value)) throw new Error(`Unknown unit in the database: ${value}`);
  return value;
}

/**
 * Loads everything lib/calc needs for one store. Returns null when the store does not exist or RLS
 * hides it (not the owner). Category and frequency columns are trusted: database check constraints
 * limit them to the same values as lib/calc.
 */
export async function fetchStoreData(supabase: SupabaseClient<Database>, storeId: string): Promise<StoreData | null> {
  const [store, materials, products, composition, channels, prices, expenses, assets] = await Promise.all([
    supabase.from("stores").select("id, name, target_margin_pct, operating_days_per_month").eq("id", storeId).maybeSingle(),
    supabase.from("materials").select("*").eq("store_id", storeId).order("created_at").order("id"),
    supabase.from("products").select("*").eq("store_id", storeId).order("created_at").order("id"),
    supabase.from("product_materials").select("*").eq("store_id", storeId).order("created_at").order("id"),
    supabase.from("sales_channels").select("*").eq("store_id", storeId).order("sort_order").order("created_at").order("id"),
    supabase.from("product_channel_prices").select("*").eq("store_id", storeId).order("created_at").order("id"),
    supabase.from("operating_expenses").select("*").eq("store_id", storeId).order("created_at").order("id"),
    supabase.from("assets").select("*").eq("store_id", storeId).order("created_at").order("id"),
  ]);
  for (const result of [store, materials, products, composition, channels, prices, expenses, assets]) {
    if (result.error) throw result.error;
  }
  if (!store.data) return null;

  return {
    store: {
      id: store.data.id,
      name: store.data.name,
      targetMarginPct: Number(store.data.target_margin_pct),
      operatingDaysPerMonth: store.data.operating_days_per_month,
    },
    materials: (materials.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as MaterialCategory,
      purchaseQty: Number(row.purchase_qty),
      purchaseUnit: unit(row.purchase_unit),
      purchasePrice: row.purchase_price,
      wastePct: Number(row.waste_pct),
    })),
    products: (products.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      yieldQty: Number(row.yield_qty),
      targetMarginPct: row.target_margin_pct === null ? null : Number(row.target_margin_pct),
      isActive: row.is_active,
    })),
    composition: (composition.data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      materialId: row.material_id,
      qty: Number(row.qty),
      unit: unit(row.unit),
      basis: row.basis as Basis,
      channelId: row.channel_id,
    })),
    channels: (channels.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      commissionPct: Number(row.commission_pct),
      fixedFee: row.fixed_fee,
    })),
    prices: (prices.data ?? []).map((row) => ({
      productId: row.product_id,
      channelId: row.channel_id,
      price: row.price,
      estMonthlySales: row.est_monthly_sales,
      competitorPrice: row.competitor_price,
    })),
    expenses: (expenses.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as ExpenseCategory,
      amount: row.amount,
      frequency: row.frequency as Frequency,
    })),
    assets: (assets.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as AssetCategory,
      qty: row.qty,
      unitPrice: row.unit_price,
      usefulLifeMonths: row.useful_life_months,
    })),
  };
}
