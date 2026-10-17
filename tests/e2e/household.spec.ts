import { expect, test, type Page } from "@playwright/test";
import { addCompositionRow, addMaterial, addProduct, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Takaran");
  await page.goto(storeUrl(page, "bahan"));
});

const row = (page: Page, material: string) => page.getByRole("listitem").filter({ hasText: material });

async function newProduct(page: Page, name: string) {
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name, yieldQty: "1" });
}

async function openMaterial(page: Page, name: string) {
  await page.goto(storeUrl(page, "bahan"));
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name: "Ubah bahan" })).toBeVisible();
}

test("a volume material takes sdm without a spoon weight", async ({ page }) => {
  await page.locator("#add-material").getByLabel("Satuan").selectOption("l");
  await expect(page.getByLabel("Berat 1 sdm (gram)")).toHaveCount(0);
  await addMaterial(page, { name: "Susu", qty: "1", unit: "l", price: "18.000" });
  await newProduct(page, "Kopi susu");
  await addCompositionRow(page, { material: "Susu", qty: "10", unit: "sdm", basis: "batch" });
  // 10 sdm = 150 ml × Rp18/ml
  await expect(row(page, "Susu")).toContainText("Rp2.700/porsi");
});

test("a weight material needs its spoon weight before sdm", async ({ page }) => {
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await newProduct(page, "Teh manis");
  const productUrl = page.url();

  const form = page.locator("#add-composition");
  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: "Gula" });
  await form.getByLabel("Jumlah").fill("2");
  await form.getByLabel("Satuan").selectOption("sdm");
  await expect(page.getByText(/Isi dulu berat 1 sdm untuk Gula/)).toBeVisible();
  await expect(form.getByRole("link", { name: "halaman Bahan" })).toBeVisible();
  await form.getByLabel("Satuan").selectOption("g");
  await expect(page.getByText(/Isi dulu berat 1 sdm untuk Gula/)).toHaveCount(0);
  await form.getByLabel("Satuan").selectOption("sdm");
  await expect(page.getByText(/Isi dulu berat 1 sdm untuk Gula/)).toBeVisible();

  await openMaterial(page, "Gula");
  await page.getByLabel("Berat 1 sdm (gram)").fill("12");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();

  await page.goto(productUrl);
  await addCompositionRow(page, { material: "Gula", qty: "2", unit: "sdm", basis: "batch" });
  // 2 sdm = 24 g × Rp15/g
  await expect(row(page, "Gula")).toContainText("Rp360/porsi");
});

test("the spoon weight cannot be cleared while a recipe uses sdm", async ({ page }) => {
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await openMaterial(page, "Gula");
  await page.getByLabel("Berat 1 sdm (gram)").fill("12");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();

  await newProduct(page, "Teh manis");
  await addCompositionRow(page, { material: "Gula", qty: "2", unit: "sdm", basis: "batch" });

  await openMaterial(page, "Gula");
  await expect(page.getByLabel("Berat 1 sdm (gram)")).toHaveValue("12");
  await page.getByLabel("Berat 1 sdm (gram)").fill("");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Bahan ini dipakai dengan sdm\/sdt\/gelas di resep/)).toBeVisible();
  // The refused value stays in the field instead of being reset.
  await expect(page.getByLabel("Berat 1 sdm (gram)")).toHaveValue("");
});

test("the spoon weight survives switching the unit away and back", async ({ page }) => {
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await openMaterial(page, "Gula");
  await page.getByLabel("Berat 1 sdm (gram)").fill("12");
  await page.getByLabel("Satuan").selectOption("pcs");
  await expect(page.getByLabel("Berat 1 sdm (gram)")).toHaveCount(0);
  await page.getByLabel("Satuan").selectOption("g");
  await expect(page.getByLabel("Berat 1 sdm (gram)")).toHaveValue("12");
});

test("the material form with the spoon field does not overflow at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByLabel("Berat 1 sdm (gram)")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("editing a row shows the spoon-weight hint as soon as sdm is picked", async ({ page }) => {
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await newProduct(page, "Teh manis");
  await addCompositionRow(page, { material: "Gula", qty: "200", unit: "g", basis: "batch" });
  const item = row(page, "Gula");
  await item.getByLabel("Satuan").selectOption("sdm");
  await expect(item.getByRole("link", { name: "halaman Bahan" })).toBeVisible();
  await item.getByLabel("Satuan").selectOption("g");
  await expect(item.getByRole("link", { name: "halaman Bahan" })).toHaveCount(0);
});
