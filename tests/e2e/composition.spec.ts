import { expect, test, type Page } from "@playwright/test";
import { addCompositionRow, addMaterial, addProduct, addTemplateChannel, createStoreViaOnboarding, priceSection, signIn, storeUrl } from "./helpers";

let productUrl = "";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Resep");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await addMaterial(page, { name: "Cup", qty: "1", unit: "lusin", price: "6.000", category: "kemasan" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh manis", yieldQty: "10" });
  productUrl = page.url();
});

const row = (page: Page, material: string) => page.getByRole("listitem").filter({ hasText: material });

test("offers only units of the material's kind and a sensible basis", async ({ page }) => {
  const form = page.locator("#add-composition");
  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: "Gula" });
  await expect(form.getByLabel("Satuan").locator("option")).toHaveText([
    "gram (g)",
    "ons (100 g)",
    "kilogram (kg)",
    "sdm (sendok makan, 15 ml)",
    "sdt (sendok teh, 5 ml)",
    "gelas (250 ml)",
  ]);
  await expect(form.getByLabel("Satuan")).toHaveValue("g");
  await expect(form.getByLabel("Dihitung")).toHaveValue("batch");

  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: "Cup" });
  await expect(form.getByLabel("Satuan").locator("option")).toHaveText(["buah (pcs)", "lusin (12 pcs)"]);
  await expect(form.getByLabel("Satuan")).toHaveValue("pcs");
  await expect(form.getByLabel("Dihitung")).toHaveValue("unit");
});

test("adds, edits and removes rows with their cost per unit", async ({ page }) => {
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  // 200 g × Rp15 / 10 portions
  await expect(row(page, "Gula")).toContainText("Rp300/porsi");
  await addCompositionRow(page, { material: "Cup", qty: "1" });
  await expect(row(page, "Cup")).toContainText("Rp500/porsi");

  await row(page, "Gula").getByLabel("Jumlah").fill("100");
  await row(page, "Gula").getByRole("button", { name: "Simpan Gula" }).click();
  await expect(row(page, "Gula")).toContainText("Rp150/porsi");

  await page.getByRole("button", { name: "Hapus Cup dari komposisi" }).click();
  await expect(row(page, "Cup")).toHaveCount(0);
});

test("a material used in a composition can't be deleted", async ({ page }) => {
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await page.goto(storeUrl(page, "bahan"));
  await page.getByRole("link", { name: /Gula/ }).click();
  await expect(page.getByText("Dipakai di: Es teh manis")).toBeVisible();
  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await expect(page.getByText("Tidak bisa dihapus. Dipakai di: Es teh manis")).toBeVisible();
});

test("changing a used material's unit to another kind is refused", async ({ page }) => {
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await page.goto(storeUrl(page, "bahan"));
  await page.getByRole("link", { name: /Gula/ }).click();
  // Let the page hydrate; an early select/submit is lost to hydration.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Satuan").selectOption("pcs");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Satuan ini beda jenis/)).toBeVisible();
  await expect(page.getByLabel("Satuan")).toHaveValue("pcs");

  await page.getByLabel("Satuan").selectOption("ons");
  await page.getByLabel("Jumlah beli").fill("10");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.goto(productUrl);
  await expect(row(page, "Gula")).toContainText("Rp300/porsi");
});

test("packaging used only in one channel raises only that channel's cost", async ({ page }) => {
  await page.goto(storeUrl(page, "kanal"));
  await addTemplateChannel(page, "GoFood");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Bubble wrap", qty: "100", unit: "pcs", price: "20.000", category: "kemasan" });
  await page.goto(productUrl);
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await addCompositionRow(page, { material: "Bubble wrap", qty: "1", channel: "GoFood" });
  await expect(row(page, "Bubble wrap")).toContainText("Hanya di GoFood");

  for (const [channel, cost] of [["Offline – Tunai", "Rp300"], ["GoFood", "Rp500"]] as const) {
    const section = priceSection(page, channel);
    await section.getByLabel("Harga jual (Rp)").fill("5.000");
    await section.getByLabel("Perkiraan terjual / bulan").fill("100");
    await expect(section).toContainText(cost);
  }
});
