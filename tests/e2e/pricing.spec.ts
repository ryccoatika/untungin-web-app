import { expect, test } from "@playwright/test";
import { addCompositionRow, addMaterial, addProduct, createStoreViaOnboarding, setPrice, signIn, storeUrl } from "./helpers";

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
  await setPrice(page, { price: "10.000", est: "100" });
});
