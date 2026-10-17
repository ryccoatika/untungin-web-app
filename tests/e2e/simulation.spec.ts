import { expect, test, type Page } from "@playwright/test";
import {
  addCompositionRow,
  addExpense,
  addMaterial,
  addProduct,
  createStoreViaOnboarding,
  setPrice,
  signIn,
  storeUrl,
} from "./helpers";

/** Gula Rp15/g; Es teh: 200 g per 10 → Rp300; price Rp5.000 × 600/month; rent Rp1.000.000 → net Rp1.820.000. */
async function storeWithOneProduct(page: Page) {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Simulasi");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await setPrice(page, { price: "5.000", est: "600" });
  await page.goto(storeUrl(page, "biaya"));
  await addExpense(page, { name: "Sewa", category: "sewa", amount: "1.000.000", frequency: "bulanan" });
  await page.goto(storeUrl(page, "simulasi"));
}

test("a store without priced products gets an empty state", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await page.goto(storeUrl(page, "simulasi"));
  await expect(page.getByText("Belum ada yang bisa disimulasikan")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ke halaman produk" })).toBeVisible();
});

test("each control changes the simulated profit", async ({ page }) => {
  await storeWithOneProduct(page);
  await expect(page.getByTestId("sim-now-netProfit")).toHaveText("Rp1.820.000");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.820.000");

  // Materials +100%: 600 × (5.000 − 600) − 1.000.000
  await page.getByLabel("Harga semua bahan").fill("100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.640.000");
  await expect(page.getByTestId("sim-diff-netProfit")).toHaveText("-Rp180.000");

  await page.getByRole("button", { name: "Kembali ke angka sekarang" }).click();
  // Sales +50%: 900 × 4.700 − 1.000.000
  await page.getByLabel("Jumlah terjual").fill("50");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp3.230.000");
  await expect(page.getByTestId("sim-diff-netProfit")).toHaveText("+Rp1.410.000");

  await page.getByRole("button", { name: "Kembali ke angka sekarang" }).click();
  // Price Rp6.000: 600 × (6.000 − 300) − 1.000.000
  await page.getByLabel("Harga jual Es teh (Offline – Tunai)").fill("6.000");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp2.420.000");

  // Materials free: never NaN. The per-material fields sit in a closed <details>.
  await page.getByRole("button", { name: "Kembali ke angka sekarang" }).click();
  await page.getByText("Atur per bahan").click();
  await page.getByLabel("Perubahan harga Gula (%)").fill("-100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp2.000.000");
  expect(await page.getByRole("main").innerText()).not.toMatch(/NaN|Infinity/);
});

test("nothing sold shows dashes, never NaN", async ({ page }) => {
  await storeWithOneProduct(page);
  // The slider stops at −50%; a link can ask for −100% and widens it.
  await page.goto(`${storeUrl(page, "simulasi")}?s=-100`);
  await expect(page.getByLabel("Jumlah terjual")).toHaveValue("-100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("—");
  await expect(page.getByTestId("sim-sim-bepUnitsDaily")).toHaveText("—");
  expect(await page.getByRole("main").innerText()).not.toMatch(/NaN|Infinity/);
});

test("the address bar keeps the scenario, hostile links are ignored, and nothing is saved", async ({ page }) => {
  await storeWithOneProduct(page);
  await page.getByLabel("Harga semua bahan").fill("100");
  await expect(page).toHaveURL(/[?&]m=100(&|$)/);
  await page.reload();
  await expect(page.getByLabel("Harga semua bahan")).toHaveValue("100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.640.000");

  await page.goto(`${storeUrl(page, "simulasi")}?s=50`);
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp3.230.000");

  await page.goto(`${storeUrl(page, "simulasi")}?m=abc&s=99999&p.x.y=-5`);
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.820.000");

  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByTestId("metric-netProfit")).toHaveText("Rp1.820.000");
});

test("fits a phone without horizontal scrolling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await storeWithOneProduct(page);
  await page.getByLabel("Harga semua bahan").fill("100");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
