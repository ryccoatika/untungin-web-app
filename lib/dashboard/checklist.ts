import type { StoreData } from "@/lib/calc";

export const CHECKLIST_KEYS = ["materials", "products", "expenses", "ownerSalary", "assets"] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
export type ChecklistItem = { key: ChecklistKey; done: boolean; href: string };

/** Setup steps shown on the dashboard until every one is done (spec §5.2). */
export function setupChecklist(data: StoreData): ChecklistItem[] {
  const base = `/s/${data.store.id}`;
  const withComposition = new Set(data.composition.map((row) => row.productId));
  // A product is "done" once the dashboard can show its profit.
  const productReady = data.products.some(
    (product) =>
      product.isActive &&
      withComposition.has(product.id) &&
      data.prices.some((row) => row.productId === product.id && row.price > 0 && row.estMonthlySales > 0),
  );
  const done: Record<ChecklistKey, boolean> = {
    materials: data.materials.length > 0,
    products: productReady,
    expenses: data.expenses.some((expense) => expense.category !== "gaji_pemilik"),
    ownerSalary: data.expenses.some((expense) => expense.category === "gaji_pemilik"),
    assets: data.assets.length > 0,
  };
  const href: Record<ChecklistKey, string> = {
    materials: `${base}/bahan`,
    products: `${base}/produk`,
    expenses: `${base}/biaya`,
    ownerSalary: `${base}/biaya`,
    assets: `${base}/inventaris`,
  };
  return CHECKLIST_KEYS.map((key) => ({ key, done: done[key], href: href[key] }));
}
