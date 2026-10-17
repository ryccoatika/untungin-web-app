import { expect, test } from "@playwright/test";
import { addExpense, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Biaya");
  await page.goto(storeUrl(page, "biaya"));
});

test("lists costs with their monthly equivalent and total", async ({ page }) => {
  await expect(page.getByText("Belum ada biaya")).toBeVisible();
  await expect(page.getByText(/gaji untuk dirimu sendiri/)).toBeVisible();

  await addExpense(page, { name: "Sewa kios", category: "sewa", amount: "1.500.000", frequency: "bulanan" });
  await addExpense(page, { name: "Listrik", category: "listrik_air", amount: "600.000", frequency: "tahunan" });
  await addExpense(page, { name: "Parkir", category: "transportasi", amount: "2.000", frequency: "harian" });

  await expect(page.getByRole("link", { name: /Listrik/ })).toContainText("Rp50.000");
  // 26 open days × Rp2.000
  await expect(page.getByRole("link", { name: /Parkir/ })).toContainText("Rp52.000");
  await expect(page.getByTestId("expenses-total")).toHaveText("Rp1.602.000");
});

test("the owner-salary hint disappears once it is recorded", async ({ page }) => {
  await addExpense(page, { name: "Gaji saya", category: "gaji_pemilik", amount: "3.000.000", frequency: "bulanan" });
  await expect(page.getByText(/gaji untuk dirimu sendiri/)).toBeHidden();
});

test("edits and deletes a cost", async ({ page }) => {
  await addExpense(page, { name: "Internet", category: "internet_pulsa", amount: "300.000", frequency: "bulanan" });
  await page.getByRole("link", { name: /Internet/ }).click();
  await page.getByLabel("Jumlah (Rp)").fill("350.000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.getByRole("button", { name: "Hapus biaya" }).click();
  await page.getByRole("button", { name: "Hapus biaya" }).click();
  await expect(page).toHaveURL(/\/biaya$/);
  await expect(page.getByText("Belum ada biaya")).toBeVisible();
});

test("shows field errors and keeps the input", async ({ page }) => {
  const form = page.locator("#add-expense");
  await form.getByLabel("Jumlah (Rp)").fill("1,5");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Nama biaya wajib diisi")).toBeVisible();
  await expect(form.getByText("Isi jumlah dengan angka bulat, contoh 1.500.000")).toBeVisible();
  await expect(form.getByLabel("Jumlah (Rp)")).toHaveValue("1,5");
});
