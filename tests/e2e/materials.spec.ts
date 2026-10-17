import { expect, test } from "@playwright/test";
import { addMaterial, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Bahan");
  await page.goto(storeUrl(page, "bahan"));
});

test("shows an empty state, then lists a new material with its cost per base unit", async ({ page }) => {
  await expect(page.getByText("Belum ada bahan")).toBeVisible();
  const form = page.locator("#add-material");
  await form.getByLabel("Jumlah beli").fill("1");
  await form.getByLabel("Satuan").selectOption("kg");
  await form.getByLabel("Harga beli (Rp)").fill("15.000");
  await form.getByLabel("Nama bahan").fill("Gula pasir");
  await expect(form.getByText("Biaya: Rp15 per g")).toBeVisible();

  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Bahan ditambahkan.")).toBeVisible();
  const item = page.getByRole("link", { name: /Gula pasir/ });
  await expect(item).toContainText("Rp15.000");
  await expect(item).toContainText("Rp15/g");
  await expect(form.getByLabel("Nama bahan")).toHaveValue("");
});

test("keeps typed values and shows field errors", async ({ page }) => {
  const form = page.locator("#add-material");
  await form.getByLabel("Jumlah beli").fill("1");
  await form.getByLabel("Harga beli (Rp)").fill("15,5");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Nama bahan wajib diisi")).toBeVisible();
  await expect(form.getByText("Isi harga dengan angka bulat, contoh 15.000")).toBeVisible();
  await expect(form.getByLabel("Harga beli (Rp)")).toHaveValue("15,5");
});

test("edits and deletes a material", async ({ page }) => {
  await addMaterial(page, { name: "Susu UHT", qty: "1", unit: "l", price: "20.000", waste: "10" });
  await page.getByRole("link", { name: /Susu UHT/ }).click();
  await expect(page.getByRole("heading", { name: "Ubah bahan" })).toBeVisible();
  await page.getByLabel("Harga beli (Rp)").fill("18.000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await expect(page.getByLabel("Harga beli (Rp)")).toHaveValue("18.000");

  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await expect(page).toHaveURL(/\/bahan$/);
  await expect(page.getByText("Belum ada bahan")).toBeVisible();
});

test("a long name and a large price fit on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await addMaterial(page, { name: "BahanDenganNamaSangatPanjang".repeat(3).slice(0, 80), qty: "1", unit: "kg", price: "1.000.000.000" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
