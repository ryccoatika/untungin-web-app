import { expect, test, type Page } from "@playwright/test";

/** Three.js sets window.__THREE__ when it is imported. */
async function threeLoaded(page: Page) {
  return page.evaluate(() => "__THREE__" in window);
}

async function webglAvailable(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  });
}

test.describe("landing hero", () => {
  test("reduced motion shows the static drawing and never loads Three.js", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByTestId("hero-poster")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await threeLoaded(page)).toBe(false);
  });

  test("a capable browser gets the 3D hero", async ({ page }) => {
    await page.goto("/");
    test.skip(!(await webglAvailable(page)), "no WebGL in this browser");
    test.skip(await page.evaluate(() => navigator.hardwareConcurrency <= 4), "weak device by the spec's rule");
    await expect(page.locator("main canvas")).toBeVisible();
    expect(await threeLoaded(page)).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
