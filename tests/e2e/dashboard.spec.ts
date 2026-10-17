import { expect, test } from "@playwright/test";
import {
  addAsset,
  addCompositionRow,
  addExpense,
  addMaterial,
  addProduct,
  createStoreViaOnboarding,
  setPrice,
  signIn,
  storeUrl,
} from "./helpers";

test("a new store shows the checklist and no broken numbers", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await expect(page.getByText("Langkah awal")).toBeVisible();
  await expect(page.getByRole("link", { name: /Catat bahan & kemasan/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Tambah kanal online/ })).toContainText("(opsional)");
  await expect(page.getByTestId("metric-netProfit")).toHaveText("—");
  await expect(page.getByTestId("metric-bep")).toHaveText("—");
  await expect(page.getByTestId("metric-payback")).toHaveText("—");
  expect(await page.getByRole("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);
  await expect(page.getByRole("link", { name: "Coba simulasi" })).toHaveCount(0);
});

test("the full flow shows profit, break-even and payback", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Kedai Teh");

  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await addMaterial(page, { name: "Teh", qty: "100", unit: "g", price: "10.000" });
  await addMaterial(page, { name: "Cup", qty: "1", unit: "lusin", price: "6.000", category: "kemasan" });

  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh manis", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await addCompositionRow(page, { material: "Teh", qty: "50" });
  await addCompositionRow(page, { material: "Cup", qty: "1" });
  await setPrice(page, { price: "5.000", est: "600" });

  await page.goto(storeUrl(page, "biaya"));
  await addExpense(page, { name: "Sewa", category: "sewa", amount: "1.000.000", frequency: "bulanan" });
  await addExpense(page, { name: "Gaji saya", category: "gaji_pemilik", amount: "1.000.000", frequency: "bulanan" });

  await page.goto(storeUrl(page, "inventaris"));
  await addAsset(page, { name: "Blender", category: "peralatan", qty: "1", unitPrice: "600.000", usefulLifeMonths: "12" });

  await page.goto(storeUrl(page, "dashboard"));
  // Material cost 1.300/cup; fixed costs 2.050.000; 600 cups × 5.000.
  await expect(page.getByTestId("metric-netProfit")).toHaveText("Rp170.000");
  await expect(page.getByTestId("metric-grossRevenue")).toHaveText("Rp3.000.000");
  await expect(page.getByTestId("metric-bep")).toHaveText("22 terjual/hari");
  await expect(page.getByTestId("metric-payback")).toHaveText("≈ 3,5 bulan");
  await expect(page.getByText("Langkah awal")).toBeHidden();
  const warning = page.getByRole("listitem").filter({ hasText: "Margin di bawah target:" });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole("listitem")).toHaveText(["Es teh manis (Offline – Tunai)"]);
  await expect(page.getByRole("link", { name: /Es teh manis/ })).toContainText("Di bawah target");

  // At 768 the cards are still stacked; a price never breaks inside the number.
  await page.setViewportSize({ width: 768, height: 1024 });
  const price = page.getByRole("link", { name: /Es teh manis/ }).getByText("Rp5.000", { exact: false }).first();
  await expect(price).toBeVisible();
  const lines = await price.evaluate((el) => {
    const style = getComputedStyle(el);
    return Math.round(el.getBoundingClientRect().height / parseFloat(style.lineHeight));
  });
  expect(lines).toBe(1);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByRole("link", { name: "Coba simulasi" }).click();
  await expect(page).toHaveURL(/\/simulasi$/);
  await expect(page.getByTestId("sim-now-netProfit")).toHaveText("Rp170.000");
});

test("deleting a product removes it from the dashboard", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Hapus");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es gula", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "100" });
  await setPrice(page, { price: "3.000", est: "100" });

  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByRole("link", { name: /Es gula/ })).toBeVisible();

  await page.goto(storeUrl(page, "produk"));
  await page.getByRole("link", { name: /Es gula/ }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await expect(page).toHaveURL(/\/produk$/);

  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByRole("link", { name: /Es gula/ })).toHaveCount(0);
  await expect(page.getByTestId("metric-netProfit")).toHaveText("—");
  await expect(page.getByRole("link", { name: /Buat produk lengkap/ })).toBeVisible();
});

test("long names and large amounts fit on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Besar");
  const longName = "ProdukDenganNamaSangatPanjangSekaliTanpaSpasi".repeat(2).slice(0, 80);
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: longName, qty: "1", unit: "kg", price: "1.000.000.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: longName, yieldQty: "1" });
  await addCompositionRow(page, { material: longName, qty: "1", unit: "g" });
  await setPrice(page, { price: "1.500.000.000", est: "1.000" });
  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByTestId("metric-grossRevenue")).toContainText("Rp1.500.000.000.000");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
