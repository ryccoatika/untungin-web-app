import { expect, test, type Page } from "@playwright/test";
import { addCompositionRow, addMaterial, addProduct, createStoreViaOnboarding, setPrice, signIn, storeUrl } from "./helpers";

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

/** Pretend to be a strong machine so the 3D tests never skip on a 4-core CI runner (the real WebGL check still applies). */
async function pretendStrongDevice(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 }));
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
    await pretendStrongDevice(page);
    await page.goto("/");
    test.skip(!(await webglAvailable(page)), "no WebGL in this browser");
    await expect(page.locator("main canvas")).toBeVisible();
    expect(await threeLoaded(page)).toBe(true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

/** Gula Rp15/g; Es teh 200 g per 10 → Rp300; Rp5.000 × 600 → contribution Rp2.820.000 per month. */
async function storeWithChart(page: Page) {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Grafik");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await setPrice(page, { price: "5.000", est: "600" });
}

test.describe("dashboard chart", () => {
  test("reduced motion shows the 2D chart only and never loads Three.js", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await storeWithChart(page);
    await page.goto(storeUrl(page, "dashboard"));
    const chart = page.getByTestId("chart-2d");
    await expect(chart.getByText("Es teh")).toBeVisible();
    await expect(chart.getByText("Rp2.820.000")).toBeVisible();
    await expect(page.getByRole("group", { name: "Tampilan grafik" })).toHaveCount(0);
    expect(await threeLoaded(page)).toBe(false);
  });

  test("the 3D/2D choice is remembered", async ({ page }) => {
    await pretendStrongDevice(page);
    await storeWithChart(page);
    await page.goto(storeUrl(page, "dashboard"));
    test.skip(!(await webglAvailable(page)), "no WebGL in this browser");
    await expect(page.getByRole("img", { name: /Grafik 3D/ })).toBeVisible();
    await page.getByRole("button", { name: "2D" }).click();
    await expect(page.getByTestId("chart-2d")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("chart-2d")).toBeVisible();
    await expect(page.getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "3D" }).click();
    await expect(page.getByRole("img", { name: /Grafik 3D/ })).toBeVisible();
  });

  test("form pages never load Three.js, even after the dashboard did", async ({ page }) => {
    await storeWithChart(page);
    const productUrl = page.url();
    await page.goto(storeUrl(page, "dashboard"));
    for (const path of ["bahan", "produk", "biaya", "inventaris", "kanal", "pengaturan"]) {
      await page.goto(storeUrl(page, path));
      expect(await threeLoaded(page), path).toBe(false);
    }
    await page.goto(productUrl);
    expect(await threeLoaded(page), "produk/[id]").toBe(false);
    await page.goto("/onboarding");
    expect(await threeLoaded(page), "onboarding").toBe(false);
  });

  test("moving back and forth does not exhaust WebGL contexts", async ({ page }) => {
    await pretendStrongDevice(page);
    await storeWithChart(page);
    await page.goto(storeUrl(page, "dashboard"));
    test.skip(!(await webglAvailable(page)), "no WebGL in this browser");
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/WebGL|context/i.test(message.text())) warnings.push(message.text());
    });
    const chart3d = page.getByRole("img", { name: /Grafik 3D/ });
    await expect(chart3d).toBeVisible();
    for (let i = 0; i < 20; i++) {
      await page.getByRole("link", { name: "Produk", exact: true }).first().click();
      await expect(page).toHaveURL(/\/produk$/);
      await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(chart3d, `3D chart on visit ${i + 1}`).toBeVisible();
    }
    expect(warnings.filter((text) => /too many|lost/i.test(text))).toEqual([]);
  });
});

test.describe("moments", () => {
  test("a new store is welcomed once, and the address bar is cleaned", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await createStoreViaOnboarding(page, "Toko Baru");
    await expect(page.getByRole("status").filter({ hasText: "Toko siap!" })).toHaveCount(1);
    await expect(page.locator("p", { hasText: "Toko siap!" })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await threeLoaded(page)).toBe(false);
    await page.reload();
    await expect(page.getByText("Toko siap!")).toHaveCount(0);
  });

  test("first profit is celebrated once per store, and the message can be closed", async ({ page }) => {
    await storeWithChart(page);
    await page.goto(storeUrl(page, "dashboard"));
    const text = "Selamat! Usahamu mulai untung.";
    await expect(page.getByRole("status")).toHaveText(text); // the live region carries the text for screen readers
    const message = page.locator("p", { hasText: text });
    await expect(message).toBeVisible();
    // The burst never blocks the page.
    await page.getByRole("link", { name: "Coba simulasi" }).click({ trial: true });
    await page.getByRole("button", { name: "Tutup" }).click();
    await expect(message).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("");
    await page.reload();
    await expect(page.getByText("Selamat! Usahamu mulai untung.")).toHaveCount(0);
  });

  test("empty simulation and analysis pages show the illustration; reduced motion keeps it static", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await createStoreViaOnboarding(page, "Toko Kosong");
    for (const path of ["simulasi", "analisis"]) {
      await page.goto(storeUrl(page, path));
      await expect(page.getByTestId("empty-drawing")).toBeVisible();
    }
    expect(await threeLoaded(page)).toBe(false);
  });
});
