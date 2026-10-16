import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await devLogin(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("creates a store and lands on its dashboard", async ({ page }) => {
  await createStoreViaOnboarding(page, "Kopi Senja");
});

test("accepts a margin typed with a decimal comma", async ({ page }) => {
  await createStoreViaOnboarding(page, "Kue Bunda", "12,5");
});

test("does not advance to step 2 without a store name", async ({ page }) => {
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByLabel("Target margin (%)")).toBeHidden();
  await expect(page.getByText("Langkah 1 dari 2")).toBeVisible();
});

test("shows an Indonesian error for a 100% margin", async ({ page }) => {
  await page.getByLabel("Nama toko").fill("Toko Margin");
  await page.getByLabel("Jenis usaha").selectOption("makanan");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Target margin (%)").fill("100");
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page.getByText("Target margin harus kurang dari 100%")).toBeVisible();
  await expect(page.getByLabel("Target margin (%)")).toHaveValue("100");
  await page.getByRole("button", { name: "Kembali" }).click();
  await expect(page.getByLabel("Nama toko")).toHaveValue("Toko Margin");
  await expect(page.getByLabel("Jenis usaha")).toHaveValue("makanan");
});

test("rejects a duplicate store name and returns to step 1", async ({ page }) => {
  await createStoreViaOnboarding(page, "Warung Sama");
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill("warung sama");
  await page.getByLabel("Jenis usaha").selectOption("makanan");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page.getByText("Kamu sudah punya toko dengan nama ini.")).toBeVisible();
  await expect(page.getByLabel("Nama toko")).toHaveValue("warung sama");
});

test("stops a free user at 2 stores", async ({ page }) => {
  await createStoreViaOnboarding(page, "Toko Satu");
  await createStoreViaOnboarding(page, "Toko Dua");
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill("Toko Tiga");
  await page.getByLabel("Jenis usaha").selectOption("makanan");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page.getByText(/Batas jumlah toko untuk paketmu sudah tercapai/)).toBeVisible();
});
