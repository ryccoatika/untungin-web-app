import { expect, test } from "@playwright/test";
import { addProduct, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Produk");
  await page.goto(storeUrl(page, "produk"));
});

test("creates a product and opens it", async ({ page }) => {
  await expect(page.getByText("Belum ada produk")).toBeVisible();
  await addProduct(page, { name: "Es kopi susu", yieldQty: "10", category: "Minuman" });
  await expect(page.getByRole("heading", { name: "Es kopi susu" })).toBeVisible();
  await page.getByRole("link", { name: "Kembali" }).click();
  await expect(page.getByRole("link", { name: /Es kopi susu/ })).toContainText("Belum ada harga");
});

test("edits details: own margin and not on sale", async ({ page }) => {
  await addProduct(page, { name: "Roti bakar", yieldQty: "4" });
  await page.getByLabel("Target margin khusus (%)").fill("25");
  await page.getByLabel("Masih dijual").uncheck();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await expect(page.getByLabel("Masih dijual")).not.toBeChecked();
  await expect(page.getByLabel("Target margin khusus (%)")).toHaveValue("25");
  await page.goto(storeUrl(page, "produk"));
  await expect(page.getByRole("link", { name: /Roti bakar/ })).toContainText("Tidak dijual");
});

test("rejects a yield of 0", async ({ page }) => {
  const form = page.locator("#add-product");
  await form.getByLabel("Nama produk").fill("Kue");
  await form.getByLabel("Hasil per resep").fill("0");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Hasil per resep harus lebih dari 0")).toBeVisible();
  await expect(form.getByLabel("Nama produk")).toHaveValue("Kue");
});

test("deletes a product", async ({ page }) => {
  await addProduct(page, { name: "Produk lama", yieldQty: "1" });
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await expect(page).toHaveURL(/\/produk$/);
  await expect(page.getByText("Belum ada produk")).toBeVisible();
});
