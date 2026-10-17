import { expect, test } from "@playwright/test";
import { addChannel, addProduct, addTemplateChannel, createStoreViaOnboarding, priceSection, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kanal");
  await page.goto(storeUrl(page, "kanal"));
});

test("lists the default channel and adds one from a template", async ({ page }) => {
  await expect(page.getByRole("link", { name: /Offline – Tunai/ })).toContainText("Tanpa potongan");
  await expect(page.getByText(/Perkiraan Oktober 2026/)).toBeVisible();
  await addTemplateChannel(page, "GoFood");
  await expect(page.getByRole("link", { name: /GoFood/ })).toContainText("Komisi 20% + Rp1.000/pesanan");
  await expect(page.getByRole("button", { name: /^GoFood ·/ })).toHaveCount(0);
});

test("refuses a duplicate channel name", async ({ page }) => {
  await addTemplateChannel(page, "GoFood");
  const form = page.locator("#add-channel");
  await form.getByLabel("Nama kanal").fill(" gofood ");
  await form.getByLabel("Komisi (%)").fill("15");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Kanal dengan nama ini sudah ada")).toBeVisible();
  await expect(page.getByRole("link", { name: /GoFood/i })).toHaveCount(1);
});

test("adds a custom channel and edits it", async ({ page }) => {
  await addChannel(page, { name: "Titip warung", commissionPct: "10", fixedFee: "500" });
  await page.getByRole("link", { name: /Titip warung/ }).click();
  await expect(page.getByRole("heading", { name: "Ubah kanal" })).toBeVisible();
  await page.getByLabel("Komisi (%)").fill("12,5");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.goto(storeUrl(page, "kanal"));
  await expect(page.getByRole("link", { name: /Titip warung/ })).toContainText("Komisi 12,5% + Rp500/pesanan");
});

test("the last channel can't be deleted", async ({ page }) => {
  await page.getByRole("link", { name: /Offline – Tunai/ }).click();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await expect(page.getByText("Kanal terakhir tidak bisa dihapus. Tambahkan kanal lain dulu.")).toBeVisible();
});

test("deleting a channel removes its prices from products", async ({ page }) => {
  await addTemplateChannel(page, "GoFood");
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  const productUrl = page.url();
  await expect(priceSection(page, "GoFood")).toBeVisible();

  await page.goto(storeUrl(page, "kanal"));
  await page.getByRole("link", { name: /GoFood/ }).click();
  await expect(page.getByText(/juga menghapus harga produk/)).toBeVisible();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await expect(page).toHaveURL(/\/kanal$/);
  await page.goto(productUrl);
  await expect(priceSection(page, "GoFood")).toHaveCount(0);
  await expect(priceSection(page, "Offline – Tunai")).toBeVisible();
});
