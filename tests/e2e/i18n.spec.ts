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

test("unknown or mis-cased locale segments show the 404 page", async ({ page }) => {
  for (const path of ["/fr/toko", "/ID/toko"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: /Halaman tidak ditemukan|Page not found/ })).toBeVisible();
  }
});
