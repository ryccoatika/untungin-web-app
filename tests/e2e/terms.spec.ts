import { expect, test } from "@playwright/test";

const ID_SECTIONS = [
  "Tentang Untungin dan siapa yang mengelolanya",
  "Siapa yang boleh memakai",
  "Akunmu",
  "Datamu",
  "Perkiraan, bukan nasihat",
  "Analisis AI",
  "Pemakaian yang wajar",
  "Layanan apa adanya",
  "Batas tanggung jawab",
  "Mengakhiri pemakaian",
  "Perubahan syarat",
  "Hukum yang berlaku",
  "Kontak",
];

test("the Indonesian terms page has every section", async ({ page }) => {
  await page.goto("/id/syarat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Syarat & Ketentuan");
  await expect(page.getByText("Terakhir diperbarui: 18 Oktober 2026")).toBeVisible();
  const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(headings).toEqual(ID_SECTIONS);

  const estimates = page.locator("section", { has: page.getByRole("heading", { name: "Perkiraan, bukan nasihat" }) });
  await expect(estimates).toContainText("bukan nasihat keuangan");

  const ai = page.locator("section#ai");
  await expect(ai.getByRole("heading", { name: "Analisis AI" })).toBeVisible();
  await expect(ai).toContainText("Google Gemini");

  const law = page.locator("section", { has: page.getByRole("heading", { name: "Hukum yang berlaku" }) });
  await expect(law).toContainText("teks bahasa Indonesia yang berlaku");

  await expect(page.getByRole("link", { name: "Kebijakan privasi" }).first()).toHaveAttribute("href", "/id/privasi");
  await expect(page.locator('a[href="mailto:me@ryccoatika.com"]').first()).toBeVisible();
});

test("the English terms page renders", async ({ page }) => {
  await page.goto("/en/syarat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms & Conditions");
  await expect(page.getByText("the Indonesian text prevails")).toBeVisible();
});

test("the login page shows the agreement line with links", async ({ page }) => {
  await page.goto("/id/login");
  await expect(page.getByText("Dengan masuk, kamu menyetujui")).toBeVisible();
  await expect(page.getByRole("link", { name: "Syarat & Ketentuan", exact: true })).toHaveAttribute("href", "/id/syarat");
  await expect(page.getByRole("link", { name: "Kebijakan privasi", exact: true })).toHaveAttribute("href", "/id/privasi");
});

test("the landing footer and the privacy page link to the terms", async ({ page }) => {
  await page.goto("/id");
  await expect(page.locator("footer").getByRole("link", { name: "Syarat & Ketentuan" })).toHaveAttribute("href", "/id/syarat");
  await page.goto("/id/privasi");
  await expect(page.getByRole("link", { name: "Syarat & Ketentuan" }).first()).toHaveAttribute("href", "/id/syarat");
});

test("the privacy page lists the agreement records", async ({ page }) => {
  await page.goto("/id/privasi");
  await expect(page.getByText("Catatan persetujuan:")).toBeVisible();
  await expect(page.getByText("Terakhir diperbarui: 18 Oktober 2026")).toBeVisible();
});

test("the terms page has no horizontal scroll on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/id/syarat");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
