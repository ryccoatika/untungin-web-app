import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("sample data creates a complete, profitable coffee shop", async ({ page }) => {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard(\?welcome=1)?$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kedai Kopi Contoh" })).toBeVisible();
  await expect(page.getByTestId("metric-netProfit")).not.toHaveText("—");
  await expect(page.getByText("Es kopi susu gula aren").first()).toBeVisible();
  await expect(page.getByText("GoFood").first()).toBeVisible();
});

test("a second sample store gets a numbered name", async ({ page }) => {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Kedai Kopi Contoh 2" })).toBeVisible();
});
