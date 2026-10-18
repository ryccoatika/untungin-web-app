import { expect, test, type Page, type Response } from "@playwright/test";
import { TERMS_VERSION } from "../../lib/legal/versions";
import { adminClient, signIn, storeIdFromUrl, storeUrl, userIdByEmail } from "./helpers";

const AGREE_ID = "Setuju & lanjut";

/** An agreed user with the sample store open on its dashboard; returns the email. */
async function signInWithSampleStore(page: Page): Promise<string> {
  const email = await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard(\?welcome=1)?$/);
  return email;
}

/** Removes every consent row of the user, as if they signed up before the current terms. */
async function forgetConsents(email: string) {
  const { error } = await adminClient().from("consents").delete().eq("user_id", await userIdByEmail(email));
  if (error) throw error;
}

/** The redirect responses that led to `response`, oldest first. */
async function redirectsBefore(response: Response | null): Promise<Response[]> {
  const chain: Response[] = [];
  for (let request = response?.request().redirectedFrom(); request; request = request.redirectedFrom()) {
    const redirect = await request.response();
    if (redirect) chain.unshift(redirect);
  }
  return chain;
}

test("a user who hasn't agreed sees the agreement screen with a way out", async ({ page }) => {
  await signIn(page, undefined, "/mulai", { agreed: false });
  await expect(page).toHaveURL(/\/id\/syarat\/setuju\?next=%2Fid%2Fmulai$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Syarat & Ketentuan" }).first()).toHaveAttribute("href", "/id/syarat");
  await expect(page.getByRole("link", { name: "Kebijakan privasi" }).first()).toHaveAttribute("href", "/id/privasi");
  await expect(page.getByRole("button", { name: AGREE_ID })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hapus akun" })).toBeVisible();
  await expect(page.getByLabel("Ketik email-mu untuk konfirmasi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hapus akun saya" })).toBeVisible();
});

test("a deep link goes to the agreement screen in one redirect and back to the store after agreeing", async ({ page }) => {
  const email = await signInWithSampleStore(page);
  const storeId = storeIdFromUrl(page);
  await forgetConsents(email);

  const response = await page.goto(storeUrl(page, "catat"));
  const next = encodeURIComponent(`/id/s/${storeId}/dashboard`);
  await expect(page).toHaveURL(new RegExp(`/id/syarat/setuju\\?next=${next}$`));
  const redirects = await redirectsBefore(response);
  expect(redirects.map((r) => r.status())).toEqual([307]);
  expect(redirects[0].headers().location).toMatch(new RegExp(`/id/syarat/setuju\\?next=${next}$`));

  await page.getByRole("button", { name: AGREE_ID }).click();
  await expect(page).toHaveURL(new RegExp(`/id/s/${storeId}/dashboard$`));

  const { data, error } = await adminClient()
    .from("consents")
    .select("kind, version")
    .eq("user_id", await userIdByEmail(email));
  if (error) throw error;
  expect(data).toEqual([{ kind: "terms", version: TERMS_VERSION }]);
});

test("public pages stay open while the terms aren't agreed", async ({ page }) => {
  await signIn(page, undefined, "/id/syarat", { agreed: false });
  for (const path of ["/id/syarat", "/id/privasi", "/id"]) {
    const response = await page.goto(path);
    expect(await redirectsBefore(response)).toEqual([]);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }
});

test("a hostile next lands inside the app after agreeing", async ({ page }) => {
  await signIn(page, undefined, "/id/syarat/setuju?next=//evil.example", { agreed: false });
  await page.getByRole("button", { name: AGREE_ID }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/id\/(mulai|onboarding)$/);
});

test("signing out from the agreement screen leaves the app", async ({ page }) => {
  const email = await signInWithSampleStore(page);
  const store = storeUrl(page, "dashboard");
  await forgetConsents(email);

  await page.goto(store);
  await expect(page).toHaveURL(/\/id\/syarat\/setuju\?next=/);
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/id$/);
  await page.goto(store);
  await expect(page).toHaveURL(/\/id\/login\?next=/);
});

test("the agreement screen sends a user who already agreed on to the app", async ({ page }) => {
  await signIn(page);
  const response = await page.goto("/id/syarat/setuju");
  const redirects = await redirectsBefore(response);
  expect(redirects[0].headers().location).toMatch(/\/id\/mulai$/);
  await expect(page).toHaveURL(/\/id\/onboarding$/);
});

test("the agreement screen works in English", async ({ page }) => {
  await signIn(page, undefined, "/en/mulai", { agreed: false });
  await expect(page).toHaveURL(/\/en\/syarat\/setuju\?next=%2Fen%2Fmulai$/);
  await page.getByRole("button", { name: "Agree & continue" }).click();
  await expect(page).toHaveURL(/\/en\/(mulai|onboarding)$/);
});

test("agreeing to an older terms version doesn't count", async ({ page }) => {
  const email = await signIn(page, undefined, "/id/syarat", { agreed: false });
  const { error } = await adminClient()
    .from("consents")
    .insert({ user_id: await userIdByEmail(email), kind: "terms", version: "2026-01-01" });
  if (error) throw error;
  await page.goto("/id/mulai");
  await expect(page).toHaveURL(/\/id\/syarat\/setuju\?next=%2Fid%2Fmulai$/);
});
