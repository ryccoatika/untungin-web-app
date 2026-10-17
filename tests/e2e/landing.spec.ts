import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, signIn } from "./helpers";

test("signed-out visitors see the pitch and a login button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("untung-rugi");
  await page.getByRole("link", { name: "Mulai gratis dengan Google" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("signed-in users get a link into the app", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Landing");
  await page.goto("/");
  await page.getByRole("link", { name: "Buka aplikasi" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard$/);
});

test("landing has no horizontal scroll on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("uses the Geist font", async ({ page }) => {
  await page.goto("/");
  const family = await page.evaluate(() => getComputedStyle(document.documentElement).fontFamily);
  expect(family).toContain("Geist");
});
