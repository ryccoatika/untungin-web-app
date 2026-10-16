import { expect, test } from "@playwright/test";

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
