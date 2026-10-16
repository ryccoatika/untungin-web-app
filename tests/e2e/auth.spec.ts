import { expect, test } from "@playwright/test";
import { devLogin } from "./helpers";

test("signed-out user is sent to login with a next param", async ({ page }) => {
  await page.goto("/toko");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoko$/);
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
});

test("new user lands on onboarding after login", async ({ page }) => {
  await devLogin(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("an external next param is ignored", async ({ page }) => {
  await devLogin(page, undefined, "https://evil.example/steal");
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/onboarding$/);
});

test("signed-in user visiting /login is redirected into the app", async ({ page }) => {
  await devLogin(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("unknown pages show the Indonesian 404", async ({ page }) => {
  await page.goto("/halaman-yang-tidak-ada");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});
