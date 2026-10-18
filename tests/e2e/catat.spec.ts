import { expect, test, type Page } from "@playwright/test";
import { adminClient, createStoreViaOnboarding, signIn, storeIdFromUrl, storeUrl } from "./helpers";

const KOPI = "Es kopi susu gula aren";
const OFFLINE = "Offline – Tunai";

async function createSampleStore(page: Page) {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard(\?welcome=1)?$/);
  await expect(page.getByTestId("metric-netProfit")).not.toHaveText("—");
}

/** The Asia/Jakarta calendar day, `offset` days from today. */
function day(offset = 0): string {
  const jakarta = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const ms = Date.UTC(+jakarta.slice(0, 4), +jakarta.slice(5, 7) - 1, +jakarta.slice(8, 10)) + offset * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** "8 Okt": the banner's date format. */
function shortDay(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

const qtyField = (page: Page, product: string) => page.getByRole("textbox", { name: `Jumlah ${product}` });
const plus = (page: Page, product: string) => page.getByRole("button", { name: `Tambah ${product}` });
const channelTab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(name) });
const rupiah = async (page: Page, id: string) => Number((await page.getByTestId(id).innerText()).replace(/[^\d-]/g, ""));

/** Records `count` of KOPI in the offline tab for `date` (the day's page must be open already). */
async function recordKopi(page: Page, date: string, count: number) {
  await page.goto(storeUrl(page, `catat?tanggal=${date}`));
  await qtyField(page, KOPI).fill(String(count));
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Penjualan tersimpan.")).toBeVisible();
}

async function openCatatViaNav(page: Page) {
  const menu = page.getByRole("navigation", { name: "Menu toko" });
  await menu.getByRole("link", { name: "Catat", exact: true }).click();
  await expect(page).toHaveURL(/\/catat$/);
}

test("records a day per channel and shows the live summary", async ({ page }) => {
  await createSampleStore(page);
  await openCatatViaNav(page);
  await expect(page.getByRole("heading", { name: "Catat penjualan" })).toBeVisible();

  await plus(page, KOPI).click();
  await expect(qtyField(page, KOPI)).toHaveValue("1");
  await qtyField(page, KOPI).fill("10");
  await expect(channelTab(page, OFFLINE)).toContainText("10 terjual");

  await channelTab(page, "GoFood").click();
  await qtyField(page, KOPI).fill("5");
  await expect(channelTab(page, "GoFood")).toContainText("5 terjual");

  // 10 × Rp22.000 offline + 5 × Rp27.000 on GoFood
  await expect(page.getByTestId("day-revenue")).toHaveText("Rp355.000");
  expect(await rupiah(page, "day-gross-profit")).toBeGreaterThan(0);
  expect(await rupiah(page, "day-gross-profit")).toBeLessThan(355_000);

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Penjualan tersimpan.")).toBeVisible();

  await page.reload();
  await expect(qtyField(page, KOPI)).toHaveValue("10");
  await expect(channelTab(page, "GoFood")).toContainText("5 terjual");
  await channelTab(page, "GoFood").click();
  await expect(qtyField(page, KOPI)).toHaveValue("5");
  await expect(page.getByTestId("day-revenue")).toHaveText("Rp355.000");
});

test("editing keeps other channels", async ({ page }) => {
  await createSampleStore(page);
  await page.goto(storeUrl(page, "catat"));
  await qtyField(page, KOPI).fill("10");
  await channelTab(page, "GoFood").click();
  await qtyField(page, KOPI).fill("5");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Penjualan tersimpan.")).toBeVisible();

  await page.reload();
  await qtyField(page, KOPI).fill("12");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Penjualan tersimpan.")).toBeVisible();

  await page.reload();
  await expect(qtyField(page, KOPI)).toHaveValue("12");
  await channelTab(page, "GoFood").click();
  await expect(qtyField(page, KOPI)).toHaveValue("5");
  await expect(page.getByTestId("day-revenue")).toHaveText(`Rp${(12 * 22_000 + 5 * 27_000).toLocaleString("id-ID")}`);
});

test("all zeros asks whether the shop was closed", async ({ page }) => {
  await createSampleStore(page);
  await page.goto(storeUrl(page, `catat?tanggal=${day(-1)}`));
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText("Toko tutup hari ini?")).toBeVisible();
  await expect(page.getByTestId("closed-note")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Ya, toko tutup" }).click();
  await expect(page.getByTestId("closed-note")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("closed-note")).toBeVisible();

  // Recording sales on a closed day reopens it.
  await qtyField(page, KOPI).fill("2");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Penjualan tersimpan.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("closed-note")).toHaveCount(0);
  await expect(qtyField(page, KOPI)).toHaveValue("2");
});

test("closing a day that has sales asks first and clears them", async ({ page }) => {
  await createSampleStore(page);
  await recordKopi(page, day(-1), 4);
  await page.reload();
  await page.getByRole("button", { name: "Toko tutup hari ini", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByText(/menghapus semua catatan penjualan/)).toBeVisible();
  await dialog.getByRole("button", { name: "Batal" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(qtyField(page, KOPI)).toHaveValue("4");

  await page.getByRole("button", { name: "Toko tutup hari ini", exact: true }).click();
  await dialog.getByRole("button", { name: "Ya, toko tutup" }).click();
  await expect(page.getByTestId("closed-note")).toBeVisible();
  await expect(qtyField(page, KOPI)).toHaveValue("0");
  await page.reload();
  await expect(qtyField(page, KOPI)).toHaveValue("0");
  await expect(page.getByTestId("day-revenue")).toHaveText("Rp0");
});

test("missing-days banner links to the day", async ({ page }) => {
  await createSampleStore(page);
  await recordKopi(page, day(-3), 3);
  await recordKopi(page, day(-1), 2);
  await page.goto(storeUrl(page, "catat"));
  const banner = page.getByTestId("missing-days");
  await expect(banner).toContainText("1 hari belum dicatat");
  const link = banner.getByRole("link", { name: shortDay(day(-2)) });
  await expect(link).toBeVisible();
  await expect(banner.getByRole("link")).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`catat\\?tanggal=${day(-2)}$`));
  await expect(page.getByLabel("Tanggal")).toHaveValue(day(-2));
  await expect(page.getByText(/Kamu mengubah hari yang sudah lewat/)).toBeVisible();
  // Filling the gap clears the banner.
  await qtyField(page, KOPI).fill("1");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Penjualan tersimpan.")).toBeVisible();
  await page.goto(storeUrl(page, "catat"));
  await expect(page.getByTestId("missing-days")).toHaveCount(0);
});

test("missing-days banner lists at most five days and counts the rest", async ({ page }) => {
  await createSampleStore(page);
  await recordKopi(page, day(-9), 1);
  await page.goto(storeUrl(page, "catat"));
  const banner = page.getByTestId("missing-days");
  await expect(banner).toContainText("8 hari belum dicatat");
  await expect(banner.getByRole("link")).toHaveCount(5);
  await expect(banner).toContainText("dan 3 lainnya");
});

test("date picker refuses future and out-of-range dates", async ({ page }) => {
  await createSampleStore(page);
  for (const bad of [day(1), day(-93), "2020-01-01", "bukan-tanggal"]) {
    await page.goto(storeUrl(page, `catat?tanggal=${bad}`));
    await expect(page.getByText(/Tanggal itu tidak bisa dicatat/)).toBeVisible();
    await expect(page.getByLabel("Tanggal")).toHaveValue(day());
  }
  await page.goto(storeUrl(page, `catat?tanggal=${day(-92)}`));
  await expect(page.getByText(/Tanggal itu tidak bisa dicatat/)).toHaveCount(0);
  await expect(page.getByLabel("Tanggal")).toHaveValue(day(-92));

  const picker = page.getByLabel("Tanggal");
  await expect(picker).toHaveAttribute("max", day());
  await expect(picker).toHaveAttribute("min", day(-92));
  await picker.fill(day(-2));
  await expect(page).toHaveURL(new RegExp(`catat\\?tanggal=${day(-2)}$`));
});

test("deleted product's line stays read-only", async ({ page }) => {
  await createSampleStore(page);
  await recordKopi(page, day(), 3);
  await page.goto(storeUrl(page, "produk"));
  await page.getByRole("link", { name: new RegExp(KOPI) }).first().click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await expect(page).toHaveURL(/\/produk$/);

  await page.goto(storeUrl(page, "catat"));
  const previous = page.getByRole("region", { name: "Tercatat sebelumnya" });
  await expect(previous.getByText(KOPI)).toBeVisible();
  await expect(previous.getByText(/3 × Rp22\.000/)).toBeVisible();
  // It still counts in the day's summary.
  await expect(page.getByTestId("day-revenue")).toHaveText("Rp66.000");
  await expect(qtyField(page, KOPI)).toHaveCount(0);

  const remove = previous.getByRole("button", { name: `Hapus ${KOPI} (${OFFLINE})` });
  await remove.click();
  await expect(remove).toContainText("Yakin hapus?");
  await remove.click();
  await expect(page.getByText("Catatan dihapus.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Tercatat sebelumnya" })).toHaveCount(0);
  await expect(page.getByTestId("day-revenue")).toHaveText("Rp0");
});

test("calc error blocks saving", async ({ page }) => {
  await createSampleStore(page);
  const storeId = storeIdFromUrl(page);
  await page.goto(storeUrl(page, "catat"));
  await plus(page, KOPI).click();

  // The UI forbids this state, so set it up with the admin client on this user's own store: a recipe
  // that uses sdm on a weight material (Kopi bubuk, kg) that has no spoon weight.
  const admin = adminClient();
  const [{ data: material }, { data: product }] = await Promise.all([
    admin.from("materials").select("id").eq("store_id", storeId).eq("name", "Kopi bubuk").single(),
    admin.from("products").select("id").eq("store_id", storeId).eq("name", "Es americano").single(),
  ]);
  const { error } = await admin
    .from("product_materials")
    .insert({ store_id: storeId, product_id: product!.id, material_id: material!.id, qty: 1, unit: "sdm", basis: "batch" });
  expect(error).toBeNull();

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /penjualan belum bisa disimpan/ })).toContainText("Es americano");
  // Nothing was saved, and a fresh page says what to fix instead of offering the form.
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: /belum bisa dihitung/ })).toContainText("Es americano");
  await expect(page.getByRole("button", { name: "Simpan", exact: true })).toHaveCount(0);
  const { count } = await admin.from("sales_days").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  expect(count).toBe(0);
});

test("another user's store is 404 for /catat", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signIn(owner);
  await createStoreViaOnboarding(owner, "Toko Catat Rahasia");
  const catatUrl = new URL(owner.url()).pathname.replace("/dashboard", "/catat");
  await ownerContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signIn(other);
  await other.goto(catatUrl);
  await expect(other.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await otherContext.close();
});

test("a store without prices explains what to do first", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await page.goto(storeUrl(page, "catat"));
  await expect(page.getByText("Belum ada produk dengan harga jual")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ke produk" })).toBeVisible();
});

test("no horizontal scroll at 360px and steppers are at least 40px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await createSampleStore(page);
  await recordKopi(page, day(-1), 1);
  await page.goto(storeUrl(page, "catat"));
  await expect(qtyField(page, KOPI)).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  for (const target of [plus(page, KOPI), page.getByRole("button", { name: `Kurangi ${KOPI}` }), qtyField(page, KOPI)]) {
    const box = (await target.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(40);
  }
  // With the missing-day banner, the confirm panel and the date notice shown too.
  await page.goto(storeUrl(page, `catat?tanggal=${day(1)}`));
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});
