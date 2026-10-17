import { expect, test } from "@playwright/test";
import { googleSignInNext, signIn } from "./helpers";

test("signed-out user is sent to login with a next param", async ({ page }) => {
  await page.goto("/toko");
  await expect(page).toHaveURL(/\/id\/login\?next=%2Fid%2Ftoko$/);
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
  // Google is the only way in: no email/password form, locally or in production.
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("new user lands on onboarding after login", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("the Google button returns to the requested page", async ({ page }) => {
  await page.goto("/id/login?next=%2Fid%2Ftoko");
  expect(await googleSignInNext(page, "Masuk dengan Google")).toBe("/id/toko");
});

test("the Google button ignores an external next param", async ({ page }) => {
  await page.goto("/id/login?next=https://evil.example/steal");
  expect(await googleSignInNext(page, "Masuk dengan Google")).toBe("/id/mulai");
});

test("signed-in user visiting /login is redirected into the app", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("unknown pages show the Indonesian 404", async ({ page }) => {
  await page.goto("/halaman-yang-tidak-ada");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});

test("repeated next params render the login page instead of crashing", async ({ page }) => {
  await page.goto("/login?next=/a&next=/b");
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
});
