import { expect, test } from "@playwright/test";
import { addAsset, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Inventaris");
  await page.goto(storeUrl(page, "inventaris"));
});

test("totals capital and monthly depreciation", async ({ page }) => {
  await expect(page.getByText("Belum ada inventaris")).toBeVisible();
  await addAsset(page, { name: "Meja kayu", category: "furnitur", qty: "2", unitPrice: "1.200.000", usefulLifeMonths: "24" });
  await addAsset(page, { name: "Freezer", category: "elektronik", qty: "1", unitPrice: "6.000.000", usefulLifeMonths: "60" });

  await expect(page.getByRole("link", { name: /Meja kayu/ })).toContainText("Rp100.000");
  await expect(page.getByTestId("assets-capital")).toHaveText("Rp8.400.000");
  await expect(page.getByTestId("assets-depreciation")).toHaveText("Rp200.000");
});

test("edits and deletes an item", async ({ page }) => {
  await addAsset(page, { name: "Kompor", category: "peralatan", qty: "1", unitPrice: "500.000", usefulLifeMonths: "36" });
  await page.getByRole("link", { name: /Kompor/ }).click();
  await page.getByLabel("Jumlah", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.getByRole("button", { name: "Hapus barang" }).click();
  await page.getByRole("button", { name: "Hapus barang" }).click();
  await expect(page).toHaveURL(/\/inventaris$/);
  await expect(page.getByText("Belum ada inventaris")).toBeVisible();
});

test("rejects a useful life of 0 months", async ({ page }) => {
  const form = page.locator("#add-asset");
  await form.getByLabel("Nama barang").fill("Blender");
  await form.getByLabel("Harga satuan (Rp)").fill("400.000");
  await form.getByLabel("Umur pakai (bulan)").fill("0");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Umur pakai minimal 1 bulan")).toBeVisible();
});
