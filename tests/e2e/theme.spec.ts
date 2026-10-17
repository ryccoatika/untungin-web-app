import { expect, test, type Page } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

const html = (page: Page) => page.locator("html");

async function chooseTheme(page: Page, current: RegExp, option: string) {
  await page.getByRole("button", { name: current }).click();
  await page.getByRole("menuitemradio", { name: option }).click();
}

test.describe("device in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("follows the device on the first visit", async ({ page }) => {
    await page.goto("/id");
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Tema: Ikuti perangkat" })).toBeVisible();
  });

  test("an explicit Light choice overrides the device and survives a reload", async ({ page }) => {
    await page.goto("/id");
    await chooseTheme(page, /^Tema:/, "Terang");
    await expect(html(page)).not.toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(html(page)).not.toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Tema: Terang" })).toBeVisible();
  });
});

test.describe("device in light mode", () => {
  test.use({ colorScheme: "light" });

  test("an explicit Dark choice applies, sets the status bar color, and survives a reload", async ({ page }) => {
    await page.goto("/en/login");
    await expect(html(page)).not.toHaveClass(/\bdark\b/);
    await chooseTheme(page, /^Theme:/, "Dark");
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#0a0a0a");
    await page.reload();
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("button", { name: "Theme: Dark" })).toBeVisible();
  });
});

test("the theme button fits on a phone store header", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await devLogin(page);
  await createStoreViaOnboarding(page, "TokoDenganNamaSangatPanjangSekaliTanpaSpasiUntukUjiTampilan");
  await expect(page.getByRole("button", { name: /^Tema:/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
