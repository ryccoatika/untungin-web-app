import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, signIn, storeUrl, userIdByEmail } from "./helpers";

test("sample data creates a complete, profitable coffee shop", async ({ page }) => {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard(\?welcome=1)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kedai Kopi Contoh" })).toBeVisible();
  await expect(page.getByTestId("metric-netProfit")).not.toHaveText("—");
  await expect(page.getByText("Es kopi susu gula aren").first()).toBeVisible();
  await expect(page.getByText("GoFood").first()).toBeVisible();
});

test("a second sample store gets a numbered name", async ({ page }) => {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kedai Kopi Contoh 2" })).toBeVisible();
});

test("the privacy page is public, in both languages, and linked from the landing and login pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Kebijakan privasi" }).click();
  await expect(page).toHaveURL(/\/privasi$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kebijakan privasi" })).toBeVisible();
  await expect(page.getByText("Rycco Atika")).toBeVisible();
  await expect(page.getByRole("link", { name: "me@ryccoatika.com" }).first()).toHaveAttribute("href", "mailto:me@ryccoatika.com");
  await expect(page.getByText(/Google Gemini/)).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Kebijakan privasi" })).toBeVisible();
  await page.goto("/en/privasi");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
});

test("a wrong email deletes nothing; the right one deletes the account and signs out", async ({ page }) => {
  const email = await signIn(page);
  await createStoreViaOnboarding(page, "Toko Akun");
  await page.goto(storeUrl(page, "pengaturan"));

  await page.getByLabel("Ketik email-mu untuk konfirmasi").fill("orang-lain@test.local");
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page.getByText("Email tidak cocok dengan akunmu.")).toBeVisible();
  expect(await userIdByEmail(email)).toBeTruthy();

  await page.getByLabel("Ketik email-mu untuk konfirmasi").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page).toHaveURL(/\/(id)?\?akun=dihapus$/);
  await expect(page.getByRole("status").filter({ hasText: "Akunmu sudah dihapus" })).toBeVisible();
  await expect(userIdByEmail(email)).rejects.toThrow(/No user/);

  await page.goto("/toko");
  await expect(page).toHaveURL(/\/login/);
});

test("a user with no store can delete the account from the setup page", async ({ page }) => {
  const email = await signIn(page, undefined, "/onboarding");
  await page.getByText("Hapus akun", { exact: true }).click();
  await page.getByLabel("Ketik email-mu untuk konfirmasi").fill(email);
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page).toHaveURL(/\/(id)?\?akun=dihapus$/);
  await expect(page.getByRole("status").filter({ hasText: "Akunmu sudah dihapus" })).toBeVisible();
  await expect(userIdByEmail(email)).rejects.toThrow(/No user/);
});

test("Rupiah fields show grouped digits and still save", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Rupiah");
  await page.goto(storeUrl(page, "bahan"));
  const price = page.getByLabel("Harga beli");
  await price.fill("15000");
  await price.blur();
  await expect(price).toHaveValue("15.000");
  await price.fill("15.5");
  await price.blur();
  await expect(price).toHaveValue("15.5"); // unreadable input is left for the validation message
});

test("with priced products, AI analysis is the main dashboard action", async ({ page }) => {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const analysis = page.getByRole("link", { name: "Analisis usahaku" });
  const simulation = page.getByRole("link", { name: "Coba simulasi" });
  await expect(analysis).toBeVisible();
  const [a, s] = await Promise.all([analysis.boundingBox(), simulation.boundingBox()]);
  expect(a!.y * 10000 + a!.x).toBeLessThan(s!.y * 10000 + s!.x); // analysis comes first
});
