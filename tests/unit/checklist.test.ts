import { describe, expect, it } from "vitest";
import { setupChecklist } from "@/lib/dashboard/checklist";
import { fixture } from "./calc/fixture";

const done = (data: Parameters<typeof setupChecklist>[0]) =>
  Object.fromEntries(setupChecklist(data).map((item) => [item.key, item.done]));

describe("setupChecklist", () => {
  it("is all to-do for an empty store, in spec order, with store links", () => {
    const empty = { ...fixture(), materials: [], products: [], composition: [], prices: [], expenses: [], assets: [] };
    expect(setupChecklist(empty)).toEqual([
      { key: "materials", done: false, href: "/s/store/bahan" },
      { key: "products", done: false, href: "/s/store/produk" },
      { key: "expenses", done: false, href: "/s/store/biaya" },
      { key: "ownerSalary", done: false, href: "/s/store/biaya" },
      { key: "assets", done: false, href: "/s/store/inventaris" },
    ]);
  });

  it("marks the fixture's steps, except the owner's salary", () => {
    expect(done(fixture())).toEqual({ materials: true, products: true, expenses: true, ownerSalary: false, assets: true });
  });

  it("a product counts only with a composition, a price, and a sales estimate", () => {
    const noEstimate = fixture();
    noEstimate.prices = noEstimate.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    expect(done(noEstimate).products).toBe(false);

    const noComposition = fixture();
    noComposition.composition = [];
    expect(done(noComposition).products).toBe(false);

    const inactive = fixture();
    inactive.products[0] = { ...inactive.products[0], isActive: false };
    expect(done(inactive).products).toBe(false);
  });

  it("the owner's salary alone does not count as operating costs", () => {
    const data = fixture();
    data.expenses = [{ id: "g", name: "Gaji saya", category: "gaji_pemilik", amount: 1, frequency: "bulanan" }];
    expect(done(data)).toMatchObject({ expenses: false, ownerSalary: true });
  });
});
