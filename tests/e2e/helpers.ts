import { expect, test, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Unit } from "../../lib/calc";

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

const password = "password-123456";

/**
 * Signs `page` in as `email` without going through Google: creates the user (confirmed) with the admin API if
 * needed, signs in with email/password in Node, and copies the session cookies @supabase/ssr would set into the
 * browser. Needs the Email provider on local Supabase (production keeps it disabled). Then opens `next`.
 */
export async function signIn(page: Page, email = uniqueEmail("e2e"), next = "/mulai") {
  const admin = adminClient();
  const { error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError && createError.code !== "email_exists") throw createError;

  const cookies: { name: string; value: string }[] = [];
  const supabase = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: { getAll: () => [], setAll: (toSet) => {
        cookies.push(...toSet);
      } },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const { hostname } = new URL(test.info().project.use.baseURL!);
  await page.context().addCookies(
    cookies.map(({ name, value }) => ({ name, value, domain: hostname, path: "/", sameSite: "Lax" as const })),
  );
  await page.goto(next);
  return email;
}

/**
 * Clicks the Google button and returns the `next` path the OAuth round trip would come back to.
 * The request to Supabase's /authorize endpoint is aborted, so Google is never contacted.
 */
export async function googleSignInNext(page: Page, buttonName: string): Promise<string | null> {
  await page.route(/\/auth\/v1\/authorize\?/, (route) => route.abort());
  const authorize = page.waitForRequest(/\/auth\/v1\/authorize\?/);
  await page.getByRole("button", { name: buttonName }).click();
  const redirectTo = new URL((await authorize).url()).searchParams.get("redirect_to");
  return redirectTo ? new URL(redirectTo).searchParams.get("next") : null;
}

/** The locale saved on the user's profile, read with the admin API. */
export async function savedLocale(email: string): Promise<string | null> {
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((candidate) => candidate.email === email);
  if (!user) return null;
  const { data: profile } = await admin.from("profiles").select("locale").eq("id", user.id).single();
  return profile?.locale ?? null;
}

function adminClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing. Run \`npm run db:start && npm run env:local\` first.`);
  return value;
}

export async function createStoreViaOnboarding(page: Page, name: string, margin = "40") {
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill(name);
  await page.getByLabel("Jenis usaha").selectOption("minuman");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Target margin (%)").fill(margin);
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard$/);
}

/** URL of another page of the store currently open, e.g. storeUrl(page, "bahan"). */
export function storeUrl(page: Page, path: string): string {
  const match = page.url().match(/^(.*\/s\/[0-9a-f-]{36})\//);
  if (!match) throw new Error(`Not on a store page: ${page.url()}`);
  return `${match[1]}/${path}`;
}

export async function addMaterial(
  page: Page,
  m: { name: string; qty: string; unit: Unit; price: string; category?: "bahan" | "kemasan"; waste?: string },
) {
  const form = page.locator("#add-material");
  await form.getByLabel("Nama bahan").fill(m.name);
  await form.getByLabel("Jenis").selectOption(m.category ?? "bahan");
  await form.getByLabel("Jumlah beli").fill(m.qty);
  await form.getByLabel("Satuan").selectOption(m.unit);
  await form.getByLabel("Harga beli (Rp)").fill(m.price);
  if (m.waste) await form.getByLabel("Susut / terbuang (%)").fill(m.waste);
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Bahan ditambahkan.")).toBeVisible();
  // The success message of a previous add stays visible, so also wait for the form to reset.
  await expect(form.getByLabel("Nama bahan")).toHaveValue("");
}

export async function addExpense(page: Page, e: { name: string; category: string; amount: string; frequency: string }) {
  const form = page.locator("#add-expense");
  await form.getByLabel("Nama biaya").fill(e.name);
  await form.getByLabel("Kategori").selectOption(e.category);
  await form.getByLabel("Jumlah (Rp)").fill(e.amount);
  await form.getByLabel("Dibayar").selectOption(e.frequency);
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Biaya ditambahkan.")).toBeVisible();
  // The success message of a previous add stays visible, so also wait for the form to reset.
  await expect(form.getByLabel("Nama biaya")).toHaveValue("");
}

export async function addAsset(
  page: Page,
  a: { name: string; category: string; qty: string; unitPrice: string; usefulLifeMonths: string },
) {
  const form = page.locator("#add-asset");
  await form.getByLabel("Nama barang").fill(a.name);
  await form.getByLabel("Kategori").selectOption(a.category);
  await form.getByLabel("Jumlah").fill(a.qty);
  await form.getByLabel("Harga satuan (Rp)").fill(a.unitPrice);
  await form.getByLabel("Umur pakai (bulan)").fill(a.usefulLifeMonths);
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Barang ditambahkan.")).toBeVisible();
  // The success message of a previous add stays visible, so also wait for the form to reset.
  await expect(form.getByLabel("Nama barang")).toHaveValue("");
}

export async function addProduct(page: Page, p: { name: string; yieldQty: string; category?: string }) {
  const form = page.locator("#add-product");
  await form.getByLabel("Nama produk").fill(p.name);
  await form.getByLabel("Hasil per resep").fill(p.yieldQty);
  if (p.category) await form.getByLabel("Kategori (opsional)").fill(p.category);
  await form.getByRole("button", { name: "Tambah" }).click();
  await page.waitForURL(/\/produk\/[0-9a-f-]{36}$/);
}

export async function addCompositionRow(page: Page, r: { material: string; qty: string; unit?: string; basis?: "batch" | "unit" }) {
  const form = page.locator("#add-composition");
  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: r.material });
  await form.getByLabel("Jumlah").fill(r.qty);
  if (r.unit) await form.getByLabel("Satuan").selectOption(r.unit);
  if (r.basis) await form.getByLabel("Dihitung").selectOption(r.basis);
  await form.getByRole("button", { name: "Tambah ke komposisi" }).click();
  await expect(page.getByText("Bahan ditambahkan ke komposisi.")).toBeVisible();
  // The success message of a previous add stays visible, so also wait for the form to reset.
  await expect(form.getByLabel("Bahan", { exact: true })).toHaveValue("");
}

export async function setPrice(page: Page, p: { price: string; est: string }) {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill(p.price);
  await form.getByLabel("Perkiraan terjual / bulan").fill(p.est);
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(page.getByText("Harga tersimpan.")).toBeVisible();
}
