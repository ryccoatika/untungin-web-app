import { expect, test, type Page } from "@playwright/test";
import {
  addCompositionRow,
  addExpense,
  addMaterial,
  addProduct,
  adminClient,
  createStoreViaOnboarding,
  setPrice,
  signIn,
  storeIdFromUrl,
  storeUrl,
  userIdByEmail,
} from "./helpers";

const UNKNOWN = "00000000-0000-4000-8000-0000000000ff";

/** Gula Rp15/g; Es teh: 200 g per 10 → Rp300; price Rp5.000 × 600/month; rent Rp1.000.000 → net Rp1.820.000. */
async function storeWithOneProduct(page: Page) {
  const email = await signIn(page);
  await createStoreViaOnboarding(page, "Toko Analisis");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await setPrice(page, { price: "5.000", est: "600" });
  await page.goto(storeUrl(page, "biaya"));
  await addExpense(page, { name: "Sewa", category: "sewa", amount: "1.000.000", frequency: "bulanan" });
  const storeId = storeIdFromUrl(page);
  const admin = adminClient();
  const [{ data: product }, { data: channel }, { data: material }] = await Promise.all([
    admin.from("products").select("id").eq("store_id", storeId).single(),
    admin.from("sales_channels").select("id").eq("store_id", storeId).single(),
    admin.from("materials").select("id").eq("store_id", storeId).single(),
  ]);
  return { email, storeId, productId: product!.id as string, channelId: channel!.id as string, materialId: material!.id as string };
}

async function seedAnalysis(
  store: Awaited<ReturnType<typeof storeWithOneProduct>>,
  output: Record<string, unknown>,
  createdAt = new Date().toISOString(),
) {
  const { error } = await adminClient().from("ai_analyses").insert({
    store_id: store.storeId,
    user_id: await userIdByEmail(store.email),
    model: "test-model",
    snapshot_hash: "seeded",
    input_snapshot: {},
    output,
    created_at: createdAt,
  });
  if (error) throw error;
}

test("a store without priced products gets an empty state", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await page.goto(storeUrl(page, "analisis"));
  await expect(page.getByText("Belum ada yang bisa dianalisis")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analisis usahaku" })).toHaveCount(0);
});

test("shows the quota, the privacy note and an invitation before the first analysis", async ({ page }) => {
  await storeWithOneProduct(page);
  await page.goto(storeUrl(page, "analisis"));
  await expect(page.getByTestId("ai-quota")).toHaveText("Sisa kuota hari ini: 3 dari 3");
  await expect(page.getByRole("button", { name: "Analisis usahaku" })).toBeEnabled();
  await expect(page.getByText("dikirim ke Google Gemini")).toBeVisible();
  await expect(page.getByText("Belum ada analisis.")).toBeVisible();
});

test("shows a saved analysis; only known suggestions open the simulation", async ({ page }) => {
  const store = await storeWithOneProduct(page);
  await seedAnalysis(store, {
    summary: "Usahamu untung Rp1.820.000 per bulan.",
    highlights: ["Es teh untung."],
    issues: [
      { title: "Belum ada gaji pemilik", explanation: "Catat gajimu sendiri.", related_product_ids: [store.productId, UNKNOWN], priority: "tinggi" },
    ],
    recommendations: [
      { action: "Naikkan harga Es teh ke Rp6.000", reason: "Masih di bawah target.", simulation: { type: "change_price", product_id: store.productId, channel_id: store.channelId, new_price: 6000 } },
      { action: "Ganti pemasok", reason: "Bahan lain lebih murah.", simulation: { type: "change_material_price", material_id: UNKNOWN, pct: -10 } },
    ],
  });
  await page.goto(storeUrl(page, "analisis"));

  await expect(page.getByText("Usahamu untung Rp1.820.000 per bulan.")).toBeVisible();
  await expect(page.getByText("Penting", { exact: true })).toBeVisible();
  await expect(page.getByText("Produk terkait: Es teh", { exact: true })).toBeVisible();
  await expect(page.getByText("Ganti pemasok")).toBeVisible();
  await expect(page.getByText("Data atau bahasamu sudah berubah sejak analisis ini")).toBeVisible();
  await expect(page.getByRole("link", { name: "Coba di simulasi" })).toHaveCount(1);

  await page.getByRole("link", { name: "Coba di simulasi" }).click();
  await expect(page).toHaveURL(/\/simulasi\?p\./);
  // Rp6.000 × 600 = 3.600.000 − materials 180.000 − rent 1.000.000
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp2.420.000");
  await expect(page.getByTestId("sim-now-netProfit")).toHaveText("Rp1.820.000");
});

test("a suggestion for a product deleted since loses its button and chip", async ({ page }) => {
  const store = await storeWithOneProduct(page);
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Kopi", yieldQty: "1" });
  await addCompositionRow(page, { material: "Gula", qty: "10" });
  await setPrice(page, { price: "8.000", est: "100" });
  const admin = adminClient();
  const { data: kopi } = await admin.from("products").select("id").eq("store_id", store.storeId).eq("name", "Kopi").single();
  const kopiId = kopi!.id as string;
  await seedAnalysis(store, {
    summary: "Ringkasan lama.",
    highlights: [],
    issues: [{ title: "Kopi rugi", explanation: "Harga terlalu rendah.", related_product_ids: [kopiId], priority: "tinggi" }],
    recommendations: [
      { action: "Naikkan harga Kopi", reason: "Karena.", simulation: { type: "change_price", product_id: kopiId, channel_id: store.channelId, new_price: 9000 } },
    ],
  });
  // Composition rows and prices cascade with the product.
  const { error } = await admin.from("products").delete().eq("id", kopiId);
  if (error) throw error;

  await page.goto(storeUrl(page, "analisis"));
  await expect(page.getByText("Naikkan harga Kopi")).toBeVisible();
  await expect(page.getByText("Kopi rugi")).toBeVisible();
  await expect(page.getByRole("link", { name: "Coba di simulasi" })).toHaveCount(0);
  await expect(page.getByText(/^Produk terkait/)).toHaveCount(0);
});

test("older analyses are listed as history, an unreadable one says so", async ({ page }) => {
  const store = await storeWithOneProduct(page);
  await seedAnalysis(store, { summary: "Analisis pertama.", highlights: [], issues: [], recommendations: [] }, "2026-01-01T01:00:00.000Z");
  await seedAnalysis(store, { broken: true }, "2026-01-02T01:00:00.000Z");
  await seedAnalysis(store, { summary: "Analisis terbaru.", highlights: [], issues: [], recommendations: [] });
  await page.goto(storeUrl(page, "analisis"));

  await expect(page.getByText("Analisis terbaru.")).toBeVisible();
  await expect(page.getByText("Analisis pertama.")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Riwayat" })).toBeVisible();
  await page.getByText("Dibuat 1 Jan 2026, 08.00").click();
  await expect(page.getByText("Analisis pertama.")).toBeVisible();
  await page.getByText("Dibuat 2 Jan 2026, 08.00").click();
  await expect(page.getByText("Analisis ini tidak bisa ditampilkan.")).toBeVisible();
});

test("a used-up quota disables the button", async ({ page }) => {
  const store = await storeWithOneProduct(page);
  const userId = await userIdByEmail(store.email);
  const { error } = await adminClient().from("ai_usage").insert([{ user_id: userId }, { user_id: userId }, { user_id: userId }]);
  if (error) throw error;
  await page.goto(storeUrl(page, "analisis"));
  await expect(page.getByTestId("ai-quota")).toHaveText("Sisa kuota hari ini: 0 dari 3");
  await expect(page.getByRole("button", { name: "Analisis usahaku" })).toBeDisabled();
  await expect(page.getByText("Kuota hari ini habis.")).toBeVisible();
});

test("reachable from the dashboard and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const store = await storeWithOneProduct(page);
  await seedAnalysis(store, {
    summary: "Ringkasan yang cukup panjang untuk dibungkus di layar kecil tanpa menggeser halaman ke samping sama sekali.",
    highlights: ["Satu"],
    issues: [{ title: "Judul", explanation: "Penjelasan", related_product_ids: [store.productId], priority: "sedang" }],
    recommendations: [{ action: "Aksi", reason: "Alasan", simulation: { type: "change_sales_volume", multiplier: 1.2 } }],
  });
  await page.goto(storeUrl(page, "dashboard"));
  await page.getByRole("link", { name: "Analisis usahaku" }).click();
  await expect(page).toHaveURL(/\/analisis$/);
  await expect(page.getByText("Sedang", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
