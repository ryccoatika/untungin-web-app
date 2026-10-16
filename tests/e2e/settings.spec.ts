import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Lama");
  await page.goto(page.url().replace(/dashboard$/, "pengaturan"));
});

test("renames the store and updates the margin", async ({ page }) => {
  await page.getByLabel("Nama toko", { exact: true }).fill("Toko Baru");
  await page.getByLabel("Target margin (%)").fill("35,5");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Perubahan tersimpan.")).toBeVisible();
  await expect(page.getByLabel("Nama toko", { exact: true })).toHaveValue("Toko Baru");
  await expect(page.getByRole("link", { name: "Ganti toko" })).toHaveText("Toko Baru");
  await page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("35,5%")).toBeVisible();
});

test("shows field errors without saving", async ({ page }) => {
  await page.getByLabel("Nama toko", { exact: true }).fill("Toko Lama");
  await page.getByLabel("Hari buka per bulan").fill("40");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Maksimal 31 hari")).toBeVisible();
  await expect(page.getByLabel("Hari buka per bulan")).toHaveValue("40");
  await expect(page.getByLabel("Nama toko", { exact: true })).toHaveValue("Toko Lama");
});

test("refuses to delete when the confirmation does not match", async ({ page }) => {
  await page.getByLabel("Ketik nama toko untuk konfirmasi").fill("toko lama");
  await page.getByRole("button", { name: "Hapus toko" }).click();
  await expect(page.getByText("Nama toko tidak cocok.")).toBeVisible();
  await expect(page.getByLabel("Ketik nama toko untuk konfirmasi")).toHaveValue("toko lama");
});

test("deletes the store and returns to onboarding when none are left", async ({ page }) => {
  await page.getByLabel("Ketik nama toko untuk konfirmasi").fill("Toko Lama");
  await page.getByRole("button", { name: "Hapus toko" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});
