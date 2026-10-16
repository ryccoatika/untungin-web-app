import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin, uniqueEmail } from "./helpers";

test.describe("English browser", () => {
  test.use({ locale: "en-US" });

  test("the root redirects to /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("a protected English path redirects to the English login with next", async ({ page }) => {
    await page.goto("/en/toko");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Ftoko$/);
  });
});

test.describe("unsupported browser language", () => {
  test.use({ locale: "ja-JP" });

  test("falls back to Indonesian", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/id$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  });
});

test("an unprefixed path keeps its query when redirected", async ({ page }) => {
  await page.goto("/login?error=auth");
  await expect(page).toHaveURL(/\/id\/login\?error=auth$/);
});

test("a percent-encoded protected path still requires login", async ({ page }) => {
  await page.goto("/id/%74oko");
  await expect(page).toHaveURL(/\/id\/login\?next=/);
});

test("an unknown locale segment shows the 404 page", async ({ page }) => {
  await page.goto("/fr/toko");
  await expect(page.getByRole("heading", { name: /Halaman tidak ditemukan|Page not found/ })).toBeVisible();
});

test("a mis-cased locale is normalized and still requires login", async ({ page }) => {
  await page.goto("/ID/toko");
  await expect(page).toHaveURL(/\/id\/login\?next=%2Fid%2Ftoko$/);
});

test("a path outside the proxy matcher renders the root bilingual 404", async ({ page }) => {
  const response = await page.goto("/foo.bar");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Page not found/ })).toBeVisible();
});

test.describe("English public pages", () => {
  test.use({ locale: "en-US" });

  test("landing, login and 404 are in English", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Know whether your business makes money from day one.",
    );
    await page.getByRole("link", { name: "Start free with Google" }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to BusinessNote" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in (dev)" })).toBeVisible();

    await page.goto("/en/does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test("the switcher changes language, keeps the path, and is remembered", async ({ page }) => {
  await page.goto("/id");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("switching language keeps you signed in and the saved choice follows the account", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("locale");
  await devLogin(page, email);
  await createStoreViaOnboarding(page, "Kedai Bahasa", "12,5");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/s\/[0-9a-f-]{36}\/dashboard$/);
  await expect(page.getByText("Calculation basis")).toBeVisible();
  await expect(page.getByText("12.5%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en$/);
  await context.clearCookies();

  await devLogin(page, email);
  await expect(page).toHaveURL(/\/en\/s\/[0-9a-f-]{36}\/dashboard$/);
  await expect(page.getByText("Calculation basis")).toBeVisible();
});

test.describe("English forms", () => {
  test.use({ locale: "en-US" });

  test("validation errors are shown in English", async ({ page }) => {
    await devLogin(page);
    await page.goto("/en/onboarding");
    await page.getByLabel("Store name").fill("English Shop");
    await page.getByLabel("Business type").selectOption("makanan");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByLabel("Target margin (%)").fill("100");
    await page.getByRole("button", { name: "Create store" }).click();
    await expect(page.getByText("Target margin must be less than 100%")).toBeVisible();
  });
});

test("the switcher fits on a phone header next to a long store name", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await devLogin(page);
  await createStoreViaOnboarding(page, "TokoDenganNamaSangatPanjangSekaliTanpaSpasiUntukUjiTampilan");
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("a language chosen on the login page survives the next-path prefix", async ({ page }) => {
  await page.goto("/id/toko");
  await expect(page).toHaveURL(/\/id\/login\?next=/);
  await page.getByRole("button", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/login/);
  await devLogin(page, uniqueEmail("loginlang"));
  await expect(page).toHaveURL(/\/en\/onboarding$/);
});
