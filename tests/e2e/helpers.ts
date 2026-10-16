import { expect, type Page } from "@playwright/test";

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

export async function devLogin(page: Page, email = uniqueEmail("e2e"), next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123456");
  await page.getByRole("button", { name: "Masuk (dev)" }).click();
  await page.waitForURL((url) => !/^\/(?:(?:id|en)\/)?login(?:\/|$)/.test(url.pathname));
  return email;
}

export async function createStoreViaOnboarding(page: Page, name: string, margin = "40") {
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill(name);
  await page.getByLabel("Jenis usaha").selectOption("minuman");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Target margin (%)").fill(margin);
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard$/);
}
