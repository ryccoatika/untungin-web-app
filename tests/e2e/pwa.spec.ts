import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, signIn } from "./helpers";

test("manifest is installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest.start_url).toBe("/mulai");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);
});

test("service worker and offline page are public", async ({ request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  const offline = await request.get("/offline.html");
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain("Kamu sedang offline");
});

test("shows the offline page when the network is down", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The worker claims the page on activation; wait until it controls it.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.goto("/s/xyz/dashboard").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Kamu sedang offline" })).toBeVisible();

  await context.setOffline(false);
  await page.goto("/s/xyz/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("Lainnya shows the install card, hidden when already installed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "install card lives on the mobile Lainnya page");
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Pasang");
  await page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Lainnya" }).click();
  await expect(page.getByRole("heading", { name: "Pasang Untungin di HP" })).toBeVisible();

  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes("display-mode: standalone")
        ? ({ ...original(query), matches: true } as MediaQueryList)
        : original(query);
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Lainnya" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pasang Untungin di HP" })).toHaveCount(0);
});
