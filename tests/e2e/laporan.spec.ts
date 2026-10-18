import { expect, test, type Page } from "@playwright/test";
import { createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

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

const shortDay = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));

// Sample records: the 14 days ending yesterday. Day 6 of the span is missing, day 10 is closed.
const MISSING = day(-9);
const CLOSED = day(-5);
const monthOf = (date: string) => date.slice(0, 7);

async function openLaporan(page: Page, month?: string) {
  await page.goto(storeUrl(page, month ? `laporan?bulan=${month}` : "laporan"));
  await expect(page.getByRole("heading", { level: 1, name: "Laporan bulanan" })).toBeVisible();
}

/** Signed Rupiah of a line: "Rp1.200" -> 1200, "-Rp300" or "−Rp300" -> -300. */
async function amount(page: Page, id: string): Promise<number> {
  const text = await page.getByTestId(id).innerText();
  const value = Number(text.replace(/[^\d]/g, ""));
  return /[-−]/.test(text) ? -value : value;
}

test("sample store: the answer and the five lines add up", async ({ page }) => {
  await createSampleStore(page);
  await openLaporan(page, monthOf(day(-1)));

  const answer = page.getByTestId("report-answer");
  await expect(answer).toContainText(/^(Untung|Rugi) Rp[\d.]+/);
  await expect(page.getByText("dari penjualan yang kamu catat")).toBeVisible();

  await expect(page.getByTestId("report-fixed-label")).toContainText(/Biaya tetap \(\d+ dari \d+ hari\)/);
  const omzet = await amount(page, "report-omzet");
  const fees = await amount(page, "report-fees");
  const materials = await amount(page, "report-materials");
  const fixed = await amount(page, "report-fixed");
  const net = await amount(page, "report-net");
  expect(omzet).toBeGreaterThan(0);
  expect(fees).toBeGreaterThan(0);
  expect(Math.abs(omzet - fees - materials - fixed - net)).toBeLessThanOrEqual(1);

  const answerValue = Number((await answer.innerText()).replace(/[^\d]/g, ""));
  expect(answerValue).toBe(Math.abs(net));
  await expect(answer).toContainText(net > 0 ? "Untung" : "Rugi");

  await expect(page.getByTestId("plan-bar-plan")).toBeVisible();
  await expect(page.getByTestId("plan-bar-actual")).toBeVisible();
});

test("the missing day is named, linked to Catat and marked in the calendar", async ({ page }) => {
  await createSampleStore(page);
  await openLaporan(page, monthOf(MISSING));

  const warning = page.getByTestId("missing-days");
  await expect(warning).toContainText(shortDay(MISSING));
  await expect(page.getByTestId(`calendar-${MISSING}`)).toHaveAttribute("data-state", "missing");
  await warning.getByRole("link", { name: `Isi sekarang: ${shortDay(MISSING)}` }).click();
  await expect(page).toHaveURL(new RegExp(`/catat\\?tanggal=${MISSING}$`));
  await expect(page.getByRole("heading", { name: "Catat penjualan" })).toBeVisible();
});

test("the calendar marks the closed day, a recorded day and opens Catat on tap", async ({ page }) => {
  await createSampleStore(page);
  await openLaporan(page, monthOf(CLOSED));
  await expect(page.getByTestId(`calendar-${CLOSED}`)).toHaveAttribute("data-state", "closed");
  await expect(page.getByTestId(`calendar-${day(-1)}`)).toHaveAttribute("data-state", /recorded|closed|missing/);
  await page.getByTestId(`calendar-${CLOSED}`).click();
  await expect(page).toHaveURL(new RegExp(`/catat\\?tanggal=${CLOSED}$`));
  await expect(page.getByTestId("closed-note")).toBeVisible();
});

test("month switcher: previous works, next is disabled on the current month, a bad month falls back", async ({ page }) => {
  await createSampleStore(page);
  await openLaporan(page);
  const current = day().slice(0, 7);
  await expect(page.getByTestId("next-month")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("link", { name: "Bulan berikutnya" })).toHaveCount(0);
  await expect(page.getByTestId("month-label")).toHaveText(monthLabel(current));

  await page.getByRole("link", { name: "Bulan sebelumnya" }).click();
  const previous = new Date(Date.UTC(+current.slice(0, 4), +current.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
  await expect(page).toHaveURL(new RegExp(`bulan=${previous}$`));
  await expect(page.getByTestId("month-label")).toHaveText(monthLabel(previous));
  await expect(page.getByRole("link", { name: "Bulan berikutnya" })).toBeVisible();

  for (const bad of ["2999-01", "bukan-bulan", "2026-13"]) {
    await openLaporan(page, bad);
    await expect(page.getByTestId("month-label")).toHaveText(monthLabel(current));
  }
});

test("a month before the first record shows the empty state", async ({ page }) => {
  await createSampleStore(page);
  await openLaporan(page, "2020-01");
  await expect(page.getByText("Belum ada penjualan yang dicatat")).toBeVisible();
  await expect(page.getByRole("link", { name: "Catat penjualan pertamamu" })).toBeVisible();
  await expect(page.getByTestId("report-answer")).toHaveCount(0);
});

test("the month's purchases are listed with edit and delete", async ({ page }) => {
  await createSampleStore(page);
  // Sample purchases: ground coffee 11 days ago, UHT milk 4 days ago.
  await openLaporan(page, monthOf(day(-11)));
  const kopi = page.getByRole("listitem").filter({ hasText: "Kopi bubuk" });
  await expect(kopi).toContainText(shortDay(day(-11)));
  await expect(kopi).toContainText("Rp360.000");

  await kopi.getByRole("link", { name: /^Ubah belanja Kopi bubuk$/ }).click();
  await expect(page).toHaveURL(/\/catat\/belanja\?ubah=[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Ubah belanja" })).toBeVisible();
  await expect(page.locator("#purchase-form").getByLabel("Total dibayar (Rp)")).toHaveValue("360.000");

  await openLaporan(page, monthOf(day(-4)));
  const susu = page.getByRole("listitem").filter({ hasText: "Susu UHT" });
  await expect(susu).toBeVisible();
  await susu.getByRole("button", { name: "Hapus" }).click();
  await expect(susu.getByText("Yakin ingin menghapus?")).toBeVisible();
  await susu.getByRole("button", { name: "Hapus" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Susu UHT" })).toHaveCount(0);
});

test("dashboard shows the actual result card linking to the report, and the nudge", async ({ page }) => {
  await createSampleStore(page);
  const card = page.getByTestId("records-card");
  await expect(card).toContainText(/Bulan ini sebenarnya: (untung|rugi|impas)/);
  await expect(page.getByRole("link", { name: "Catat penjualan hari ini" })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/laporan$/);
});

test("an empty store shows the empty state and no dashboard card", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Laporan Kosong");
  await expect(page.getByTestId("records-card")).toHaveCount(0);
  await page.goto(storeUrl(page, "laporan"));
  await expect(page.getByText("Belum ada penjualan yang dicatat")).toBeVisible();
  await page.getByRole("link", { name: "Catat penjualan pertamamu" }).click();
  await expect(page).toHaveURL(/\/catat$/);
});

test("another user's store is 404 for /laporan", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signIn(owner);
  await createStoreViaOnboarding(owner, "Toko Laporan Rahasia");
  const url = new URL(owner.url()).pathname.replace("/dashboard", "/laporan");
  await ownerContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signIn(other);
  await other.goto(url);
  await expect(other.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await otherContext.close();
});

test("no horizontal scroll at 360px and calendar days are at least 40px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await createSampleStore(page);
  await openLaporan(page, monthOf(MISSING));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const box = (await page.getByTestId(`calendar-${MISSING}`).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(40);
  expect(box.height).toBeGreaterThanOrEqual(40);
  for (const control of [page.getByRole("link", { name: "Bulan sebelumnya" })]) {
    const b = (await control.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(40);
    expect(b.height).toBeGreaterThanOrEqual(40);
  }
});
