import { expect, test, type Page } from "@playwright/test";
import { addMaterial, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

/** The Asia/Jakarta calendar day, `offset` days from today. */
function day(offset = 0): string {
  const jakarta = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const ms = Date.UTC(+jakarta.slice(0, 4), +jakarta.slice(5, 7) - 1, +jakarta.slice(8, 10)) + offset * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function shortDay(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

const form = (page: Page) => page.locator("#purchase-form");

async function openBelanja(page: Page) {
  await page.goto(storeUrl(page, "catat/belanja"));
  await expect(page.getByRole("heading", { name: "Catat belanja" })).toBeVisible();
}

async function fillPurchase(page: Page, p: { material?: string; qty: string; unit?: string; total: string; date?: string }) {
  const f = form(page);
  if (p.material) await f.getByLabel("Bahan", { exact: true }).selectOption({ label: p.material });
  await f.getByLabel("Jumlah", { exact: true }).fill(p.qty);
  if (p.unit) await f.getByLabel("Satuan").selectOption(p.unit);
  await f.getByLabel("Total dibayar (Rp)").fill(p.total);
  if (p.date) await f.getByLabel("Tanggal").fill(p.date);
}

async function savePurchase(page: Page, message: string | RegExp) {
  await form(page).getByRole("button", { name: /^(Catat belanja|Simpan perubahan)$/ }).click();
  await expect(form(page).getByText(message)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Belanja");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await addMaterial(page, { name: "Gelas plastik", qty: "50", unit: "pcs", price: "20.000", category: "kemasan" });
});

test("purchase updates the material price", async ({ page }) => {
  await openBelanja(page);
  await fillPurchase(page, { material: "Gula", qty: "2", total: "34.000" });
  await expect(form(page).getByText("Gula: Rp15.000 → Rp17.000 per 1 kg")).toBeVisible();
  await savePurchase(page, "Harga Gula sekarang Rp17.000 per 1 kg");

  await page.goto(storeUrl(page, "bahan"));
  await expect(page.getByRole("link", { name: /Gula/ })).toContainText("Rp17.000");
});

test("back-dated purchase leaves the price", async ({ page }) => {
  await openBelanja(page);
  await fillPurchase(page, { material: "Gula", qty: "1", total: "18.000", date: day(-1) });
  await savePurchase(page, "Harga Gula sekarang Rp18.000 per 1 kg");

  await fillPurchase(page, { material: "Gula", qty: "1", total: "12.000", date: day(-3) });
  await expect(form(page).getByText(new RegExp(`Harga tidak berubah \\(Rp18\\.000 per 1 kg\\) karena ada belanja yang lebih baru \\(${shortDay(day(-1))}\\)`))).toBeVisible();
  await savePurchase(page, `Belanja dicatat. Harga tidak berubah karena ada belanja yang lebih baru (${shortDay(day(-1))})`);

  await page.goto(storeUrl(page, "bahan"));
  await expect(page.getByRole("link", { name: /Gula/ })).toContainText("Rp18.000");
});

test("editing a typo fixes the price", async ({ page }) => {
  await openBelanja(page);
  await fillPurchase(page, { material: "Gula", qty: "2", total: "340.000" });
  await savePurchase(page, "Harga Gula sekarang Rp170.000 per 1 kg");

  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: "Gula" });
  await row.getByRole("link", { name: "Ubah" }).click();
  await expect(page.getByRole("heading", { name: "Ubah belanja" })).toBeVisible();
  await expect(form(page).getByLabel("Total dibayar (Rp)")).toHaveValue("340.000");
  await form(page).getByLabel("Total dibayar (Rp)").fill("34.000");
  await expect(form(page).getByText("Gula: Rp170.000 → Rp17.000 per 1 kg")).toBeVisible();
  await savePurchase(page, "Harga Gula sekarang Rp17.000 per 1 kg");

  await page.goto(storeUrl(page, "bahan"));
  await expect(page.getByRole("link", { name: /Gula/ })).toContainText("Rp17.000");
});

test("unit list follows the material", async ({ page }) => {
  await openBelanja(page);
  const units = form(page).getByLabel("Satuan");
  await form(page).getByLabel("Bahan", { exact: true }).selectOption({ label: "Gelas plastik" });
  await expect(units.locator("option")).toHaveText(["buah (pcs)", "lusin (12 pcs)"]);
  await form(page).getByLabel("Bahan", { exact: true }).selectOption({ label: "Gula" });
  await expect(units.locator("option")).toHaveText(["gram (g)", "ons (100 g)", "kilogram (kg)"]);
  await expect(units).toHaveValue("kg");
});

test("the preview follows the material chosen after the quantity was typed", async ({ page }) => {
  await openBelanja(page);
  const f = form(page);
  await f.getByLabel("Jumlah", { exact: true }).fill("2");
  await f.getByLabel("Total dibayar (Rp)").fill("34.000");
  await f.getByLabel("Bahan", { exact: true }).selectOption({ label: "Gelas plastik" });
  await expect(f.getByTestId("price-preview")).toContainText("Gelas plastik: Rp20.000 → Rp850.000 per 50 pcs");
  // Back to a weight material: the unit follows (kg), not the previous unit (pcs).
  await f.getByLabel("Bahan", { exact: true }).selectOption({ label: "Gula" });
  await expect(f.getByLabel("Satuan")).toHaveValue("kg");
  await expect(f.getByTestId("price-preview")).toContainText("Gula: Rp15.000 → Rp17.000 per 1 kg");
  await f.getByLabel("Satuan").selectOption("g");
  await expect(f.getByTestId("price-preview")).toContainText("Gula: Rp15.000 → Rp17.000.000 per 1 kg");
});

test("a price above the money cap is a field error, not a generic failure", async ({ page }) => {
  await openBelanja(page);
  await fillPurchase(page, { material: "Gula", qty: "0,001", unit: "g", total: "1.000.000.000" });
  await form(page).getByRole("button", { name: "Catat belanja" }).click();
  await expect(form(page).getByText("Angka terlalu besar")).toBeVisible();
  await expect(form(page).getByText("Gagal menyimpan")).toHaveCount(0);
});

test("deleting a purchase keeps the price", async ({ page }) => {
  await openBelanja(page);
  await fillPurchase(page, { material: "Gula", qty: "2", total: "34.000" });
  await savePurchase(page, "Harga Gula sekarang Rp17.000 per 1 kg");

  await page.reload();
  const row = page.getByRole("listitem").filter({ hasText: "Gula" });
  await row.getByRole("button", { name: "Hapus" }).click();
  await expect(row.getByText("Yakin ingin menghapus?")).toBeVisible();
  await row.getByRole("button", { name: "Hapus" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Gula" })).toHaveCount(0);

  await page.goto(storeUrl(page, "bahan"));
  await expect(page.getByRole("link", { name: /Gula/ })).toContainText("Rp17.000");
});

test("this month's purchases are listed", async ({ page }) => {
  await openBelanja(page);
  await expect(page.getByText("Belum ada belanja bulan ini.")).toBeVisible();
  await fillPurchase(page, { material: "Gula", qty: "2", total: "34.000" });
  await savePurchase(page, "Harga Gula sekarang Rp17.000 per 1 kg");
  await expect(form(page).getByLabel("Total dibayar (Rp)")).toHaveValue("");

  const row = page.getByRole("listitem").filter({ hasText: "Gula" });
  await expect(row).toContainText("2 kg");
  await expect(row).toContainText("Rp34.000");
  await expect(page.getByText("Belum ada belanja bulan ini.")).toHaveCount(0);
});
