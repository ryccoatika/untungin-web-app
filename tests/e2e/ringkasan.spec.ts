import { expect, test, type Page } from "@playwright/test";
import { createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

async function createSampleStore(page: Page) {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard(\?welcome=1)?$/);
  await expect(page.getByTestId("metric-netProfit")).not.toHaveText("—");
}

/** Opens "Ringkasan pinjaman" through the navigation: the sidebar on wide screens, Lainnya below. */
async function openReportViaNav(page: Page) {
  const menu = page.getByRole("navigation", { name: "Menu toko" });
  // Below lg the sidebar is replaced by the bottom bar and the Lainnya page.
  if (page.viewportSize()!.width < 1024) {
    await menu.getByRole("link", { name: "Lainnya" }).click();
    await page.getByRole("main").getByRole("link", { name: /Ringkasan pinjaman/ }).click();
  } else {
    await menu.getByRole("link", { name: "Ringkasan pinjaman" }).click();
  }
  await expect(page).toHaveURL(/\/ringkasan$/);
}

const squash = (text: string) => text.replace(/\s+/g, "");

test("sample store: summary shows the store, the dashboard's net profit, products and assets", async ({ page }) => {
  await createSampleStore(page);
  const dashboardProfit = squash(await page.getByTestId("metric-netProfit").innerText());
  await openReportViaNav(page);

  const sheet = page.getByTestId("loan-summary");
  await expect(sheet.getByText("Kedai Kopi Contoh", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Ringkasan usaha" })).toBeVisible();
  expect(squash(await page.getByTestId("report-net-profit").innerText())).toBe(dashboardProfit);
  await expect(sheet.getByRole("heading", { name: "Produk" })).toBeVisible();
  await expect(sheet.getByRole("cell", { name: "Es kopi susu gula aren" }).first()).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Peralatan dan modal" })).toBeVisible();
  await expect(sheet.getByText("Total modal awal")).toBeVisible();
  await expect(sheet.getByText(/bukan laporan keuangan yang diaudit/)).toBeVisible();
  // The printed monthly lines add up: revenue − channel fees − material costs = gross profit.
  const rupiah = async (id: string) => Number((await page.getByTestId(id).innerText()).replace(/[^\d-]/g, ""));
  const [revenue, fees, materials, gross] = [
    await rupiah("report-gross-revenue"),
    await rupiah("report-channel-fees"),
    await rupiah("report-material-costs"),
    await rupiah("report-gross-profit"),
  ];
  expect(fees).toBeGreaterThan(0);
  expect(Math.abs(revenue - fees - materials - gross)).toBeLessThanOrEqual(1);
  await expect(sheet.getByText("Potongan kanal (komisi & biaya)")).toBeVisible();
  // Bank-facing wording: not the casual "Gaji kamu sendiri".
  await expect(sheet.getByRole("cell", { name: "Gaji pemilik", exact: true })).toBeVisible();
  await expect(sheet.getByText("Gaji kamu sendiri")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Ringkasan usaha" })).toBeVisible();
});

test("instalment check: calculates, keeps the values in the URL and flags a bad rate", async ({ page }) => {
  await createSampleStore(page);
  await openReportViaNav(page);

  await page.getByLabel("Jumlah pinjaman").fill("10.000.000");
  await page.getByLabel("Tenor (bulan)").fill("12");
  await expect(page.getByLabel("Bunga per tahun (%)")).toHaveValue("6");
  await page.getByRole("button", { name: "Hitung" }).click();
  await expect(page.getByTestId("installment-monthly")).toHaveText("Rp860.664");
  await expect(page.getByTestId("installment-share")).toContainText(/Cicilan = .+ dari laba bersih per bulan/);
  await expect(page).toHaveURL(/pinjaman=10\.000\.000&tenor=12&bunga=6$/);

  await page.reload();
  await expect(page.getByLabel("Jumlah pinjaman")).toHaveValue("10.000.000");
  await expect(page.getByLabel("Tenor (bulan)")).toHaveValue("12");
  await expect(page.getByTestId("installment-monthly")).toHaveText("Rp860.664");

  await page.getByLabel("Bunga per tahun (%)").fill("31");
  await page.getByRole("button", { name: "Hitung" }).click();
  await expect(page.getByText("Isi bunga antara 0 dan 30.")).toBeVisible();
  await expect(page.getByTestId("installment-monthly")).toHaveCount(0);
});

test("CSV download: Excel-friendly file with the store and the net profit", async ({ page }) => {
  await createSampleStore(page);
  await openReportViaNav(page);
  await page.getByLabel("Jumlah pinjaman").fill("5000000");
  await page.getByLabel("Tenor (bulan)").fill("6");
  await page.getByRole("button", { name: "Hitung" }).click();
  await expect(page.getByTestId("installment-monthly")).toBeVisible();

  const link = page.getByRole("link", { name: "Unduh Excel (CSV)" });
  const href = (await link.getAttribute("href"))!;
  expect(href).toMatch(/\/id\/s\/[0-9a-f-]{36}\/ringkasan\/csv\?pinjaman=5\.000\.000&tenor=6&bunga=6$/);
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  expect(response.headers()["content-disposition"]).toMatch(/^attachment; filename="ringkasan-kedai-kopi-contoh-\d{4}-\d{2}-\d{2}\.csv"$/);
  const body = await response.text();
  expect(body).toContain("sep=;");
  expect(body).toContain("Kedai Kopi Contoh");
  expect(body).toContain("Cek cicilan");
  expect(body).toContain("Gaji pemilik;");
  expect(body).toContain("Dibuat;");
  expect(body).toContain("Potongan kanal (komisi & biaya);");
  expect(body.trimEnd().split("\r\n").pop()).toMatch(/bukan laporan keuangan yang diaudit/);
  expect(body).not.toContain("Gaji kamu sendiri");

  const reportProfit = Number(squash(await page.getByTestId("report-net-profit").innerText()).replace(/[^\d-]/g, ""));
  expect(body).toContain(`Laba bersih;${reportProfit}\r\n`);
});

test("owner name: saved to the profile, shown in the header and in the CSV", async ({ page }) => {
  await createSampleStore(page);
  await openReportViaNav(page);
  const sheet = page.getByTestId("loan-summary");
  await expect(sheet.getByText("Pemilik:")).toHaveCount(0);

  await page.getByLabel("Nama pemilik").fill("  Sari Wulandari ");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Nama pemilik tersimpan.")).toBeVisible();
  await expect(sheet.getByText("Sari Wulandari", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nama pemilik")).toHaveValue("Sari Wulandari");

  const href = (await page.getByRole("link", { name: "Unduh Excel (CSV)" }).getAttribute("href"))!;
  expect(await (await page.request.get(href)).text()).toContain("Pemilik;Sari Wulandari");

  // Clearing the field removes the name again (full_name becomes null) and the owner line disappears.
  await page.getByLabel("Nama pemilik").fill("   ");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Nama pemilik tersimpan.")).toBeVisible();
  await expect(sheet.getByText("Sari Wulandari")).toHaveCount(0);
  await expect(sheet.getByText("Pemilik:")).toHaveCount(0);
  await expect(page.getByLabel("Nama pemilik")).toHaveValue("");
  await page.reload();
  await expect(sheet.getByText("Pemilik:")).toHaveCount(0);
});

test("print: the app chrome and toolbar disappear, the summary stays", async ({ page }) => {
  await createSampleStore(page);
  await openReportViaNav(page);
  await expect(page.getByRole("button", { name: "Cetak / Simpan PDF" })).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Cetak / Simpan PDF" })).toBeHidden();
  await expect(page.getByLabel("Jumlah pinjaman")).toBeHidden();
  for (const nav of await page.locator('nav[aria-label="Menu toko"]').all()) await expect(nav).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Ringkasan usaha" })).toBeVisible();
  await expect(page.getByTestId("loan-summary").getByText("Kedai Kopi Contoh", { exact: true })).toBeVisible();
});

test("a store without priced products shows the empty state", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await page.goto(storeUrl(page, "ringkasan"));
  await expect(page.getByText("Belum ada produk dengan harga")).toBeVisible();
  await expect(page.getByTestId("loan-summary")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ke halaman Produk" })).toBeVisible();
});

test("another user's store: page and CSV are not found", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await createSampleStore(owner);
  const base = new URL(storeUrl(owner, "ringkasan")).pathname;
  await ownerContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signIn(other);
  await other.goto(base);
  await expect(other.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(other.getByText("Kedai Kopi Contoh")).toHaveCount(0);
  const csv = await other.request.get(`${base}/csv`);
  expect(csv.status()).toBe(404);
  expect(await csv.text()).not.toContain("Kedai Kopi Contoh");
  await otherContext.close();
});

test("the CSV route needs a session", async ({ request }) => {
  const response = await request.get("/id/s/00000000-0000-0000-0000-000000000000/ringkasan/csv", { maxRedirects: 0 });
  expect([307, 308, 401]).toContain(response.status());
});

test("360px: the summary does not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await createSampleStore(page);
  await openReportViaNav(page);
  await page.getByLabel("Jumlah pinjaman").fill("10000000");
  await page.getByLabel("Tenor (bulan)").fill("12");
  await page.getByRole("button", { name: "Hitung" }).click();
  await expect(page.getByTestId("installment-monthly")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
