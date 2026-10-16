import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test("dashboard shows the store name and settings", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Kedai Pagi", "12,5");
  await expect(page.getByRole("heading", { name: "Kedai Pagi" })).toBeVisible();
  await expect(page.getByText("12,5%")).toBeVisible();
  await expect(page.getByText("26 hari")).toBeVisible();
});

test("switches between stores via the store list", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Pertama");
  await createStoreViaOnboarding(page, "Toko Kedua");
  await page.getByRole("link", { name: "Ganti toko" }).click();
  await expect(page).toHaveURL(/\/toko$/);
  await page.getByRole("link", { name: /Toko Pertama/ }).click();
  await expect(page.getByRole("heading", { name: "Toko Pertama" })).toBeVisible();
});

test("store menu navigates to settings", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Menu");
  await page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Pengaturan" }).click();
  await expect(page).toHaveURL(/\/pengaturan$/);
});

test("malformed and unknown store ids show the 404 page", async ({ page }) => {
  await devLogin(page);
  await page.goto("/s/bukan-uuid/dashboard");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await page.goto("/s/00000000-0000-0000-0000-000000000000/dashboard");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});

test("another user's store shows the 404 page", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await devLogin(owner);
  await createStoreViaOnboarding(owner, "Toko Rahasia");
  const storeUrl = new URL(owner.url()).pathname;
  await ownerContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await devLogin(other);
  await other.goto(storeUrl);
  await expect(other.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(other.getByText("Toko Rahasia")).toHaveCount(0);
  await otherContext.close();
});

test("double-clicking 'Buat toko' creates only one store", async ({ page }) => {
  await devLogin(page);
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill("Toko Sekali");
  await page.getByLabel("Jenis usaha").selectOption("minuman");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Buat toko" }).dblclick();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard$/);
  await page.goto("/toko");
  await expect(page.getByRole("link", { name: /Toko Sekali/ })).toHaveCount(1);
});

test("signing out returns to the landing page and protects the app", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Keluar");
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/toko");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoko$/);
});

test("long store names do not overflow a phone screen", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await devLogin(page);
  await createStoreViaOnboarding(page, "TokoDenganNamaSangatPanjangSekaliTanpaSpasiUntukUjiTampilan");
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  const dashboardUrl = page.url();
  await page.goto("/toko");
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.goto(dashboardUrl.replace("/dashboard", "/pengaturan"));
  await expect(page.getByLabel("Ketik nama toko untuk konfirmasi")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
