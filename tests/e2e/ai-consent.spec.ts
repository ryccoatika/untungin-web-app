import { expect, test, type Page } from "@playwright/test";
import { AI_TERMS_VERSION } from "../../lib/legal/versions";
import { adminClient, signIn, storeIdFromUrl, storeUrl, userIdByEmail } from "./helpers";

// SAFETY: .env.local holds a real Gemini key. Every test here guards the Server Action POSTs (`next-action`
// header) with `guardActions`, and only the consent POST, or a POST made while the user has no `ai` consent (which
// the server must refuse before any quota claim or Gemini call), is ever let through.

const ANALYZE = "Analisis usahaku";
const TITLE = "Sebelum analisis AI";
const AGREE = "Setuju & analisis";
const NEEDS_CONSENT = "Setujui dulu syarat analisis AI sebelum mulai.";

/** Lets the first `allow` Server Action POSTs through and aborts every later one; returns the attempt count. */
async function guardActions(page: Page, allow: number): Promise<() => number> {
  let attempts = 0;
  await page.route("**/*", (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.headers()["next-action"]) {
      attempts += 1;
      if (attempts > allow) return route.abort();
    }
    return route.continue();
  });
  return () => attempts;
}

/** A signed-in user (terms agreed, no `ai` row) with the sample store's AI page open. */
async function openAnalysisWithSampleStore(page: Page) {
  const email = await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard(\?welcome=1)?$/);
  const storeId = storeIdFromUrl(page);
  await page.goto(storeUrl(page, "analisis"));
  await expect(page.getByRole("button", { name: ANALYZE })).toBeEnabled();
  return { userId: await userIdByEmail(email), storeId };
}

async function aiConsentVersions(userId: string): Promise<string[]> {
  const { data, error } = await adminClient().from("consents").select("version").eq("user_id", userId).eq("kind", "ai");
  if (error) throw error;
  return data.map((row) => row.version as string);
}

async function rowCount(table: "ai_usage" | "ai_analyses", column: "user_id" | "store_id", value: string) {
  const { count, error } = await adminClient().from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return count;
}

test("the dialog explains what is sent; Batal and Escape close it without agreeing", async ({ page }) => {
  const { userId } = await openAnalysisWithSampleStore(page);
  const attempts = await guardActions(page, 0);

  await page.getByRole("button", { name: ANALYZE }).click();
  const dialog = page.getByRole("dialog", { name: TITLE });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("harga pesaing");
  await expect(dialog).toContainText("Google Gemini");
  await expect(dialog.locator('a[href="/id/syarat#ai"]')).toBeVisible();
  await expect(dialog.locator('a[href="/id/privasi"]')).toBeVisible();
  await expect(dialog.getByRole("button", { name: AGREE })).toBeVisible();

  await dialog.getByRole("button", { name: "Batal" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: ANALYZE }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  expect(attempts()).toBe(0);
  expect(await aiConsentVersions(userId)).toEqual([]);
});

test("agreeing records the consent once, then analyzes; the dialog doesn't come back", async ({ page }) => {
  const { userId } = await openAnalysisWithSampleStore(page);
  // The first action POST is the consent; the analysis after it is aborted before it leaves the browser.
  const attempts = await guardActions(page, 1);

  await page.getByRole("button", { name: ANALYZE }).click();
  await page.getByRole("dialog", { name: TITLE }).getByRole("button", { name: AGREE }).click();

  await expect.poll(() => attempts()).toBe(2);
  expect(await aiConsentVersions(userId)).toEqual([AI_TERMS_VERSION]);

  await page.reload();
  await page.getByRole("button", { name: ANALYZE }).click();
  await expect.poll(() => attempts()).toBe(3);
  await expect(page.getByRole("dialog", { name: TITLE })).toHaveCount(0);
  expect(await aiConsentVersions(userId)).toEqual([AI_TERMS_VERSION]);
});

test("the server refuses an analysis without consent, before any quota or AI call", async ({ page }) => {
  const { userId, storeId } = await openAnalysisWithSampleStore(page);
  // The direct submit must reach the server (no consent, so it is refused there); anything after it is aborted.
  await guardActions(page, 1);

  await page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: ANALYZE }) })
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());

  await expect(page.locator('[role="alert"]', { hasText: NEEDS_CONSENT })).toBeVisible();
  await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
  expect(await rowCount("ai_usage", "user_id", userId)).toBe(0);
  expect(await rowCount("ai_analyses", "store_id", storeId)).toBe(0);
  expect(await aiConsentVersions(userId)).toEqual([]);
});

test("an agreement to an older AI terms version asks again", async ({ page }) => {
  const { userId } = await openAnalysisWithSampleStore(page);
  const { error } = await adminClient().from("consents").insert({ user_id: userId, kind: "ai", version: "2026-01-01" });
  if (error) throw error;
  await page.reload();
  const attempts = await guardActions(page, 0);

  await page.getByRole("button", { name: ANALYZE }).click();
  await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
  expect(attempts()).toBe(0);
});

test("the dialog fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openAnalysisWithSampleStore(page);
  const attempts = await guardActions(page, 0);

  await page.getByRole("button", { name: ANALYZE }).click();
  const dialog = page.getByRole("dialog", { name: TITLE });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Both buttons can be reached on a short screen.
  await dialog.getByRole("button", { name: AGREE }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: AGREE })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Batal" })).toBeVisible();
  expect(attempts()).toBe(0);
});
