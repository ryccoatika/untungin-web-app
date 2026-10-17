import { expect, test } from "@playwright/test";
import { addChannel, addExpense, addCompositionRow, addMaterial, addProduct, createStoreViaOnboarding, priceSection, setPrice, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Harga");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
});

test("previews HPP and margin while typing, then saves", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await expect(page.getByRole("heading", { name: "Offline – Tunai" })).toBeVisible();
  await form.getByLabel("Harga jual (Rp)").fill("5.000");
  await form.getByLabel("Perkiraan terjual / bulan").fill("600");
  // Material cost Rp300; no fixed costs yet, so full cost is also Rp300: (5.000 − 300) / 5.000 = 94%.
  await expect(form).toContainText("Rp300");
  await expect(form).toContainText("94%");
  await expect(form).toContainText("Sesuai target");

  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(page.getByText("Harga tersimpan.")).toBeVisible();
  await page.reload();
  await expect(page.locator("form[id^='price-']").first().getByLabel("Harga jual (Rp)")).toHaveValue("5000");
});

test("a price below cost shows a loss before saving", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill("200");
  await form.getByLabel("Perkiraan terjual / bulan").fill("10");
  await expect(form).toContainText("Rugi");
});

test("keeps typed values on a validation error", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill("5.000,50");
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(form.getByText("Isi harga dengan angka bulat, contoh 15.000")).toBeVisible();
  await expect(form.getByLabel("Harga jual (Rp)")).toHaveValue("5.000,50");
});

test("warns while the composition is empty", async ({ page }) => {
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Kopi", yieldQty: "1" });
  await expect(page.getByText(/Komposisi produk ini masih kosong/)).toBeVisible();
  await expect(page.getByText(/Harga rekomendasi/)).toHaveCount(0);
  await setPrice(page, { price: "10.000", est: "100" });
});

test("recommends a price and fills it in", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill("5.000");
  await form.getByLabel("Perkiraan terjual / bulan").fill("600");
  // No fixed costs: full cost Rp300; 300 / (1 − 0,4) = 500.
  await expect(form.getByText("Harga rekomendasi: Rp500")).toBeVisible();
  await form.getByRole("button", { name: "Pakai harga rekomendasi" }).click();
  await expect(form.getByLabel("Harga jual (Rp)")).toHaveValue("500");
  // The margin row (not the "(target 40%)" suffix) reads 40% once the recommended price is filled in.
  await expect(form.locator("dt", { hasText: /^Margin$/ }).locator("xpath=following-sibling::dd[1]")).toContainText(/^40%/);
  await expect(form).toContainText("Sesuai target");
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(form.getByText("Harga tersimpan.")).toBeVisible();
});

test("the recommendation follows a typed sales estimate before a price is set", async ({ page }) => {
  const productUrl = page.url();
  await page.goto(storeUrl(page, "biaya"));
  await addExpense(page, { name: "Sewa", category: "sewa", amount: "600.000", frequency: "bulanan" });
  await page.goto(productUrl);
  await page.waitForLoadState("networkidle");
  const form = page.locator("form[id^='price-']").first();
  // No saved sales: material cost only, 300 / (1 − 0,4) = 500, and the hint says so.
  await expect(form.getByText("Harga rekomendasi: Rp500")).toBeVisible();
  await expect(form.getByText(/Belum termasuk biaya operasional/)).toBeVisible();
  await form.getByLabel("Perkiraan terjual / bulan").fill("600");
  // Material Rp300 + overhead 600.000 / 600 = Rp1.000 → 1.300 / 0,6 = 2.166,67 → Rp2.500.
  await expect(form.getByText("Harga rekomendasi: Rp2.500")).toBeVisible();
  await expect(form.getByText(/Belum termasuk biaya operasional/)).toHaveCount(0);
});

test("the recommendation follows other changes on the page without touching the price form", async ({ page }) => {
  const productUrl = page.url();
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Teh", qty: "100", unit: "g", price: "10.000" });
  await page.goto(productUrl);
  await page.waitForLoadState("networkidle");
  const section = priceSection(page, "Offline – Tunai");
  await setPrice(page, { price: "5.000", est: "600" });
  // Material Rp300, no fixed costs: 300 / 0,6 = 500.
  await expect(section.getByText("Harga rekomendasi: Rp500")).toBeVisible();
  // Teh 50 g = Rp5.000 per batch of 10 → +Rp500 per unit: 800 / 0,6 = 1.333,3 → Rp1.500.
  await addCompositionRow(page, { material: "Teh", qty: "50" });
  await expect(section.getByText("Harga rekomendasi: Rp1.500")).toBeVisible();
});

test("commission plus margin of 100% or more has no recommended price", async ({ page }) => {
  const productUrl = page.url();
  await page.goto(page.url().replace(/\/produk\/.*$/, "/kanal"));
  await addChannel(page, { name: "Titip 70", commissionPct: "70" });
  await page.goto(productUrl);
  await expect(priceSection(page, "Titip 70")).toContainText("Komisi + target margin terlalu besar");
  await expect(priceSection(page, "Titip 70").getByRole("button", { name: "Pakai harga rekomendasi" })).toHaveCount(0);
});

test("a competitor price far from yours warns on the dashboard until it is cleared", async ({ page }) => {
  await setPrice(page, { price: "5.000", est: "600", competitor: "Rp 3.000" });
  const productUrl = page.url();
  await page.goto(page.url().replace(/\/produk\/.*$/, "/dashboard"));
  const gap = page.getByRole("listitem").filter({ hasText: "Harga beda lebih dari 25% dari pesaing:" });
  await expect(gap.getByRole("listitem")).toHaveText(["Es teh (Offline – Tunai)"]);

  await page.goto(productUrl);
  await setPrice(page, { price: "5.000", est: "600", competitor: "" });
  await page.reload();
  await expect(page.locator("form[id^='price-']").first().getByLabel("Harga pesaing (Rp, opsional)")).toHaveValue("");
  await page.goto(page.url().replace(/\/produk\/.*$/, "/dashboard"));
  await expect(page.getByText(/dari pesaing/)).toHaveCount(0);
});
