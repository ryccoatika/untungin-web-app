# Phase 7 — Finishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Untungin ready for its first real users:
- a one-tap sample coffee shop to explore;
- a privacy page and self-service account deletion;
- tighter database permissions and AI wording;
- clearer dashboard actions;
- Rupiah fields that show "18.000";
- a written production deploy checklist.

**Architecture:**
- **Sample data:** `lib/seed/demo-store.ts` builds a locale-aware demo store description (pure, unit-tested through `analyzeStore`). `seedDemoStore` writes it with the user's own client, so RLS still applies, and deletes the store if any insert fails.
- **Account deletion:** a Server Action that checks the session, asks the user to type their email, deletes the auth user with the secret-key client (everything cascades), then signs out.
- **Database permissions:** one migration takes away powers RLS does not govern from the API roles.
- **Privacy page:** static, served from the message catalogs.
- **Rupiah inputs:** a small `MoneyInput` component formats Rupiah fields on blur, using the same parser as the server.

**Tech Stack:** Next.js 16.4 App Router, React 19, Supabase (Postgres + RLS + Auth admin API), next-intl 4, zod 4, Tailwind 4 + shadcn (Base UI), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-untungin-design.md` — §5.1 (sample data: "Coba dengan data contoh"), §5.2 (`/privasi`), §6.4 (privacy statements), §10 item 7, §11 (manual setup).

**Base branch:** `feat/tahap-7-finishing`, created from `feat/tahap-6-3d` (PR #7 open; #1–#6 merged).

## Global Constraints

- Read `AGENTS.md`: Next.js 16.4 — page `params`/`searchParams` are Promises; check `node_modules/next/dist/docs/` when unsure.
- Code comments, README and docs in English. Every user-facing string comes from `messages/id.json` and `messages/en.json` with identical keys; edit those files as text, never re-serialise them. Indonesian is the default locale.
- App-generated data (sample store, its materials, products, costs, assets) is named in the locale active at creation time and is the user's own data afterwards (spec §5.1).
- The server checks the session with `getClaims()` (via `requireUser()`), never `getSession()`. The secret-key client (`createAdminClient`) is used only after the session is verified, only server-side, and never logged.
- Privacy page operator and contact (user decision): **Rycco Atika, me@ryccoatika.com**.
- Money shown with `formatRupiah`; Rupiah inputs accept "18000", "18.000", "18,000", "Rp 18.000" (the existing `wholeNumber` rules).
- Mobile first: tap targets ≥ 40px, no horizontal scroll at 360px, light and dark mode.
- No new runtime dependencies.
- Tests: `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, and e2e against a production build only (`npm run build`, `npx next start -p 3100` in the background capturing its PID, `npx playwright test`, stop ONLY that PID). Never kill by name or pattern; never touch port 3000; never read `.env.local`; never click "Analisis usahaku". Apply migrations with `npx supabase migration up --local` (never `db:reset`), then `npm run db:types`.
- Commit messages are conventional and end with the Co-Authored-By trailer of the committing agent's harness.

## Review Focus

1. **The sample store fails half-way** (a constraint error, the store limit, or a duplicate name). It must leave nothing behind and show a clear message; a second tap must work. — Tests in Task 2.
2. **Deleting the account must remove everything that user owns and nothing of anyone else's**, and the browser must end up signed out. A wrong or empty confirmation must delete nothing. — Tests in Task 3.
3. **Tighter grants must not break any page**: the signed-in user still reads and writes their data, while anon and other users get nothing. — RLS tests plus the full e2e suite in Task 1.
4. **Rupiah fields must keep accepting everything they accepted before**, never reformat a value they cannot parse, and the "Pakai harga rekomendasi" button must fill a grouped value. — Tests in Task 4.
5. **`/privasi` must be readable without signing in**, in both languages, and reachable from the landing page, the login page, the analysis privacy note and settings. — e2e in Task 3.

## Rulings

- **Sample store:** a coffee shop named "Kedai Kopi Contoh" (id) / "Sample Coffee Shop" (en). If that name already exists for the user, " 2", " 3" … is appended. It counts against the store limit like any store. The demo store is ordinary data the user can edit or delete.
- **Seeding** uses the user's own Supabase client: RLS stays the guard, and no secret key is involved. On any error after the store row exists, the store is deleted (cascade) and a "could not create sample data" message is shown.
- **The account deletion confirmation is the user's email address**, case-insensitive. Its home is the store settings page, under "Akun"; users with no store have no data beyond their sign-in.
- **After deletion** the browser lands on `/?akun=dihapus`, where the landing page shows "Akunmu sudah dihapus".
- **Grants:** `anon` loses all table privileges on app tables, and `authenticated` loses TRUNCATE, TRIGGER and REFERENCES. RLS keeps row access as before. `service_role` gets explicit grants on the AI tables.
- **`MoneyInput`** is used only for Rupiah fields: material price, expense amount, channel fixed fee, asset unit price, selling price and competitor price. Counts and quantities stay plain. Simulation inputs are unchanged.
- **Dashboard hierarchy:** when the store has priced products, "Analisis usahaku" is the primary button and "Coba simulasi" the outline one.

## File Structure

```
supabase/migrations/20261018000001_least_privilege.sql   anon/authenticated grants, service_role on AI tables
lib/seed/demo-store.ts            buildDemoStore(locale), demoAsStoreData, seedDemoStore(supabase, locale, storeName)
app/[locale]/onboarding/{actions.ts,demo-store-button.tsx,page.tsx}
app/[locale]/privasi/page.tsx     privacy policy (public)
app/[locale]/s/[storeId]/pengaturan/{account-actions.ts,delete-account-form.tsx,page.tsx}
lib/auth/require-user.ts          + email
lib/validation/number.ts          + parseWholeNumber (shared by wholeNumber and MoneyInput)
lib/format.ts                     + groupDigits
components/forms/money-input.tsx  MoneyInput
lib/ai/prompt.ts                  Rupiah formatting + full unit glossary
docs/deploy.md                    production checklist
tests/rls/least-privilege.test.ts tests/rls/seed.test.ts tests/rls/account.test.ts
tests/unit/demo-store.test.ts tests/unit/money.test.ts
tests/e2e/finishing.spec.ts
```

---

### Task 1: Least-privilege grants and a reliable e2e user lookup

**Files:**
- Create: `supabase/migrations/20261018000001_least_privilege.sql`, `tests/rls/least-privilege.test.ts`
- Modify: `lib/supabase/database.types.ts` (regenerated — expect no change), `tests/e2e/helpers.ts`

**Interfaces:**
- Produces: the grants in the migration; `userIdByEmail(email)` in `tests/e2e/helpers.ts`, which pages through all users.

- [ ] **Step 1: Write the failing RLS tests**

Create `tests/rls/least-privilege.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, createStore, createTestUser, type TestUser } from "./helpers";

const APP_TABLES = [
  "profiles",
  "stores",
  "sales_channels",
  "materials",
  "products",
  "product_materials",
  "product_channel_prices",
  "operating_expenses",
  "assets",
  "ai_analyses",
  "ai_usage",
] as const;

describe("anon has no access to app tables", () => {
  it.each(APP_TABLES)("anon cannot read %s", async (table) => {
    const { data, error } = await anonClient().from(table).select("*").limit(1);
    expect(error?.code === "42501" || /permission denied/i.test(error?.message ?? "")).toBe(true);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("signed-in users keep normal access to their own data", () => {
  let owner: TestUser;
  let storeId: string;

  beforeAll(async () => {
    owner = await createTestUser("lp-owner");
    storeId = await createStore(owner, "Toko Hak");
  });

  it("can still insert, update, read and delete their materials", async () => {
    const insert = await owner.client
      .from("materials")
      .insert({ store_id: storeId, name: "Gula", category: "bahan", purchase_qty: 1, purchase_unit: "kg", purchase_price: 15000 })
      .select("id")
      .single();
    expect(insert.error).toBeNull();
    const update = await owner.client.from("materials").update({ purchase_price: 16000 }).eq("id", insert.data!.id).select("purchase_price");
    expect(update.data).toEqual([{ purchase_price: 16000 }]);
    const removed = await owner.client.from("materials").delete().eq("id", insert.data!.id).select("id");
    expect(removed.data).toHaveLength(1);
  });

  it("can still read their profile and change their name", async () => {
    const { error } = await owner.client.from("profiles").update({ full_name: "Nama Baru" }).eq("id", owner.id);
    expect(error).toBeNull();
    const { data } = await owner.client.from("profiles").select("full_name").eq("id", owner.id).single();
    expect(data?.full_name).toBe("Nama Baru");
  });
});

describe("the server role keeps what the AI feature needs", () => {
  it("can insert and delete AI usage and analyses", async () => {
    const user = await createTestUser("lp-ai");
    const storeId = await createStore(user, "Toko AI Hak");
    const usage = await admin.from("ai_usage").insert({ user_id: user.id }).select("id").single();
    expect(usage.error).toBeNull();
    expect((await admin.from("ai_usage").delete().eq("id", usage.data!.id)).error).toBeNull();
    const analysis = await admin
      .from("ai_analyses")
      .insert({ store_id: storeId, user_id: user.id, model: "m", snapshot_hash: "h", input_snapshot: {}, output: {} })
      .select("id")
      .single();
    expect(analysis.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify the anon tests fail**

Run: `npm run test:rls -- tests/rls/least-privilege.test.ts`
Expected: the `anon cannot read …` cases FAIL for the older tables (today anon gets an empty array through RLS, not "permission denied"). `ai_analyses`/`ai_usage` already pass (Phase 5). The other cases pass.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261018000001_least_privilege.sql`:

```sql
-- Least privilege for the API roles. RLS already limits rows; these grants remove what RLS does
-- not govern (TRUNCATE, TRIGGER, REFERENCES) and all table access for anon, which never reads app
-- data (the landing and login pages only talk to Supabase Auth).
-- New tables get Supabase's broad default grants: repeat this pattern in every migration that adds one.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'stores', 'sales_channels', 'materials', 'products', 'product_materials',
    'product_channel_prices', 'operating_expenses', 'assets', 'ai_analyses', 'ai_usage'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
  end loop;
end;
$$;

-- The server writes AI results and usage with the secret key (Phase 5); make that explicit
-- instead of relying on Supabase's default grants.
grant select, insert, update, delete on public.ai_analyses, public.ai_usage to service_role;
```

- [ ] **Step 4: Apply and verify**

Run: `npx supabase migration up --local && npm run db:types && git diff --stat lib/supabase/database.types.ts`
Expected: applied; types unchanged (grants don't change types).
Run: `npm run test:rls`
Expected: all RLS files pass, including the new one.

- [ ] **Step 5: Make the e2e user lookup page through all users**

In `tests/e2e/helpers.ts`, replace the body of `userIdByEmail` (and make `savedLocale` use it) so it pages until the user is found or a page comes back short:

```ts
/** The auth user id for an e2e email, read with the admin API (pages through every user). */
export async function userIdByEmail(email: string): Promise<string> {
  const admin = adminClient();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email === email);
    if (user) return user.id;
    if (data.users.length < perPage) throw new Error(`No user ${email}`);
  }
}
```

and in `savedLocale`, use `const id = await userIdByEmail(email).catch(() => null); if (!id) return null;` before reading the profile.

- [ ] **Step 6: Full verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`, then the FULL e2e suite on your own 3100 server.
Expected: all pass — no page broke under the tighter grants.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261018000001_least_privilege.sql lib/supabase/database.types.ts tests/rls/least-privilege.test.ts tests/e2e/helpers.ts
git commit -m "feat(db): least-privilege grants for API roles; e2e user lookup pages through all users"
```

---

### Task 2: Sample coffee shop ("Coba dengan data contoh")

**Files:**
- Create: `lib/seed/demo-store.ts`, `app/[locale]/onboarding/demo-store-button.tsx`, `tests/unit/demo-store.test.ts`, `tests/rls/seed.test.ts`, `tests/e2e/finishing.spec.ts`
- Modify: `app/[locale]/onboarding/actions.ts`, `app/[locale]/onboarding/page.tsx`, `messages/id.json`, `messages/en.json`

**Interfaces:**
- Consumes: `create_store` RPC (with `p_default_channel_name`), `CHANNEL_TEMPLATES` (`gofood`), `analyzeStore`, `StoreData` types, `PLAN_LIMITS`, `canCreateStore`, `toPlan`.
- Produces:
  - `type DemoStore` (below), `buildDemoStore(locale: AppLocale): DemoStore`
  - `demoAsStoreData(demo: DemoStore): StoreData` (for tests)
  - `seedDemoStore(supabase: SupabaseClient<Database>, demo: DemoStore, storeName: string): Promise<{ storeId: string } | { error: "duplicate" | "limit" | "failed" }>`
  - `createDemoStoreAction(prev: FormState, formData: FormData): Promise<FormState>`
  - `<DemoStoreButton />`; `tests/e2e/finishing.spec.ts` (Tasks 3–4 append).

- [ ] **Step 1: Write the failing unit tests**

Create `tests/unit/demo-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeStore } from "@/lib/calc";
import { buildDemoStore, demoAsStoreData } from "@/lib/seed/demo-store";

describe("buildDemoStore", () => {
  it("is a profitable coffee shop with every part the spec lists", () => {
    const demo = buildDemoStore("id");
    const data = demoAsStoreData(demo);
    const analysis = analyzeStore(data);

    expect(demo.store.name).toBe("Kedai Kopi Contoh");
    expect(data.materials.some((m) => m.category === "kemasan")).toBe(true);
    expect(data.channels.map((c) => c.name)).toEqual(["Offline – Tunai", "GoFood"]);
    // Online-only packaging: some composition row is tied to the GoFood channel.
    expect(data.composition.some((row) => row.channelId === data.channels[1].id)).toBe(true);
    expect(data.expenses.some((e) => e.category === "gaji_pemilik")).toBe(true);
    expect(data.assets.length).toBeGreaterThan(0);
    expect(data.prices.some((p) => p.competitorPrice !== null)).toBe(true);

    expect(analysis.netProfit).toBeGreaterThan(0);
    expect(analysis.lines.length).toBe(data.products.length * 2);
    const codes = analysis.warnings.map((w) => w.code);
    expect(codes).not.toContain("NO_OWNER_SALARY");
    expect(codes).not.toContain("NET_LOSS");
    // Something to learn from: at least one line is below target or far from the competitor.
    expect(codes.some((code) => code === "BELOW_TARGET" || code === "COMPETITOR_GAP")).toBe(true);
  });

  it("names everything in the chosen language with the same numbers", () => {
    const id = buildDemoStore("id");
    const en = buildDemoStore("en");
    expect(en.store.name).toBe("Sample Coffee Shop");
    expect(en.channels[0].name).toBe("Offline – Cash");
    expect(en.materials.map((m) => m.name)).not.toEqual(id.materials.map((m) => m.name));
    const numbers = (demo: typeof id) => demo.materials.map((m) => [m.purchaseQty, m.purchaseUnit, m.purchasePrice]);
    expect(numbers(en)).toEqual(numbers(id));
    expect(analyzeStore(demoAsStoreData(en)).netProfit).toBe(analyzeStore(demoAsStoreData(id)).netProfit);
  });

  it("refers only to keys it defines", () => {
    const demo = buildDemoStore("id");
    const materials = new Set(demo.materials.map((m) => m.key));
    const products = new Set(demo.products.map((p) => p.key));
    const channels = new Set(demo.channels.map((c) => c.key));
    for (const row of demo.composition) {
      expect(materials.has(row.material)).toBe(true);
      expect(products.has(row.product)).toBe(true);
      if (row.channel) expect(channels.has(row.channel)).toBe(true);
    }
    for (const price of demo.prices) {
      expect(products.has(price.product)).toBe(true);
      expect(channels.has(price.channel)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/demo-store.test.ts`
Expected: FAIL — cannot resolve `@/lib/seed/demo-store`.

- [ ] **Step 3: Write `lib/seed/demo-store.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/routing";
import type { AssetCategory, Basis, ExpenseCategory, Frequency, MaterialCategory, StoreData, Unit } from "@/lib/calc";
import { findTemplate } from "@/lib/config/channel-templates";
import type { Database } from "@/lib/supabase/database.types";

type Text = Record<AppLocale, string>;
const L = (id: string, en: string): Text => ({ id, en });

type MaterialSpec = { key: string; name: Text; category: MaterialCategory; qty: number; unit: Unit; price: number };
type ProductSpec = { key: string; name: Text; yieldQty: number };
type RowSpec = { product: string; material: string; qty: number; unit: Unit; basis: Basis; channel?: "gofood" };
type PriceSpec = { product: string; channel: "cash" | "gofood"; price: number; est: number; competitor: number | null };
type ExpenseSpec = { name: Text; category: ExpenseCategory; amount: number; frequency: Frequency };
type AssetSpec = { name: Text; category: AssetCategory; qty: number; unitPrice: number; months: number };

const STORE = {
  name: L("Kedai Kopi Contoh", "Sample Coffee Shop"),
  businessType: "minuman",
  targetMarket: "menengah",
  operatingDaysPerMonth: 26,
  targetMarginPct: 40,
};
const CASH_NAME = L("Offline – Tunai", "Offline – Cash");

const MATERIALS: MaterialSpec[] = [
  { key: "kopi", name: L("Kopi bubuk", "Ground coffee"), category: "bahan", qty: 1, unit: "kg", price: 180_000 },
  { key: "susu", name: L("Susu UHT", "UHT milk"), category: "bahan", qty: 1, unit: "l", price: 18_000 },
  { key: "aren", name: L("Gula aren cair", "Palm sugar syrup"), category: "bahan", qty: 1, unit: "l", price: 45_000 },
  { key: "es", name: L("Es batu", "Ice"), category: "bahan", qty: 5, unit: "kg", price: 10_000 },
  { key: "teh", name: L("Teh celup", "Tea bags"), category: "bahan", qty: 25, unit: "pcs", price: 12_000 },
  { key: "cup", name: L("Cup plastik 16 oz", "16 oz plastic cup"), category: "kemasan", qty: 50, unit: "pcs", price: 35_000 },
  { key: "sedotan", name: L("Sedotan", "Straws"), category: "kemasan", qty: 100, unit: "pcs", price: 15_000 },
  { key: "bag", name: L("Paper bag (online)", "Paper bag (online)"), category: "kemasan", qty: 50, unit: "pcs", price: 40_000 },
];

const PRODUCTS: ProductSpec[] = [
  { key: "kopisusu", name: L("Es kopi susu gula aren", "Iced palm sugar latte"), yieldQty: 1 },
  { key: "americano", name: L("Es americano", "Iced americano"), yieldQty: 1 },
  { key: "teh", name: L("Es teh manis", "Iced sweet tea"), yieldQty: 1 },
];

const COMPOSITION: RowSpec[] = [
  { product: "kopisusu", material: "kopi", qty: 18, unit: "g", basis: "unit" },
  { product: "kopisusu", material: "susu", qty: 150, unit: "ml", basis: "unit" },
  { product: "kopisusu", material: "aren", qty: 20, unit: "ml", basis: "unit" },
  { product: "kopisusu", material: "es", qty: 100, unit: "g", basis: "unit" },
  { product: "kopisusu", material: "cup", qty: 1, unit: "pcs", basis: "unit" },
  { product: "kopisusu", material: "sedotan", qty: 1, unit: "pcs", basis: "unit" },
  { product: "kopisusu", material: "bag", qty: 1, unit: "pcs", basis: "unit", channel: "gofood" },
  { product: "americano", material: "kopi", qty: 18, unit: "g", basis: "unit" },
  { product: "americano", material: "es", qty: 100, unit: "g", basis: "unit" },
  { product: "americano", material: "cup", qty: 1, unit: "pcs", basis: "unit" },
  { product: "americano", material: "sedotan", qty: 1, unit: "pcs", basis: "unit" },
  { product: "americano", material: "bag", qty: 1, unit: "pcs", basis: "unit", channel: "gofood" },
  { product: "teh", material: "teh", qty: 1, unit: "pcs", basis: "unit" },
  { product: "teh", material: "aren", qty: 15, unit: "ml", basis: "unit" },
  { product: "teh", material: "es", qty: 150, unit: "g", basis: "unit" },
  { product: "teh", material: "cup", qty: 1, unit: "pcs", basis: "unit" },
  { product: "teh", material: "sedotan", qty: 1, unit: "pcs", basis: "unit" },
  { product: "teh", material: "bag", qty: 1, unit: "pcs", basis: "unit", channel: "gofood" },
];

const PRICES: PriceSpec[] = [
  { product: "kopisusu", channel: "cash", price: 22_000, est: 600, competitor: 20_000 },
  { product: "kopisusu", channel: "gofood", price: 27_000, est: 300, competitor: 26_000 },
  { product: "americano", channel: "cash", price: 15_000, est: 300, competitor: 22_000 },
  { product: "americano", channel: "gofood", price: 19_000, est: 150, competitor: null },
  { product: "teh", channel: "cash", price: 8_000, est: 400, competitor: 7_000 },
  { product: "teh", channel: "gofood", price: 10_000, est: 100, competitor: null },
];

const EXPENSES: ExpenseSpec[] = [
  { name: L("Sewa tempat", "Rent"), category: "sewa", amount: 1_500_000, frequency: "bulanan" },
  { name: L("Listrik & air", "Electricity & water"), category: "listrik_air", amount: 400_000, frequency: "bulanan" },
  { name: L("Internet", "Internet"), category: "internet_pulsa", amount: 150_000, frequency: "bulanan" },
  { name: L("Gaji saya", "My salary"), category: "gaji_pemilik", amount: 3_000_000, frequency: "bulanan" },
  { name: L("Promosi media sosial", "Social media ads"), category: "pemasaran", amount: 50_000, frequency: "mingguan" },
];

const ASSETS: AssetSpec[] = [
  { name: L("Mesin espresso", "Espresso machine"), category: "peralatan", qty: 1, unitPrice: 8_000_000, months: 60 },
  { name: L("Grinder kopi", "Coffee grinder"), category: "peralatan", qty: 1, unitPrice: 2_500_000, months: 48 },
  { name: L("Kulkas", "Fridge"), category: "elektronik", qty: 1, unitPrice: 3_000_000, months: 60 },
  { name: L("Meja & kursi", "Tables & chairs"), category: "furnitur", qty: 2, unitPrice: 750_000, months: 36 },
];

/** The sample store in one language (spec §5.1): plain data with keys instead of database ids. */
export type DemoStore = {
  store: { name: string; businessType: string; targetMarket: string; operatingDaysPerMonth: number; targetMarginPct: number };
  channels: { key: "cash" | "gofood"; name: string; commissionPct: number; fixedFee: number }[];
  materials: { key: string; name: string; category: MaterialCategory; purchaseQty: number; purchaseUnit: Unit; purchasePrice: number }[];
  products: { key: string; name: string; yieldQty: number }[];
  composition: RowSpec[];
  prices: PriceSpec[];
  expenses: { name: string; category: ExpenseCategory; amount: number; frequency: Frequency }[];
  assets: { name: string; category: AssetCategory; qty: number; unitPrice: number; usefulLifeMonths: number }[];
};

export function buildDemoStore(locale: AppLocale): DemoStore {
  const gofood = findTemplate("gofood")!;
  return {
    store: { ...STORE, name: STORE.name[locale] },
    channels: [
      { key: "cash", name: CASH_NAME[locale], commissionPct: 0, fixedFee: 0 },
      { key: "gofood", name: gofood.name, commissionPct: gofood.commissionPct, fixedFee: gofood.fixedFee },
    ],
    materials: MATERIALS.map((m) => ({
      key: m.key,
      name: m.name[locale],
      category: m.category,
      purchaseQty: m.qty,
      purchaseUnit: m.unit,
      purchasePrice: m.price,
    })),
    products: PRODUCTS.map((p) => ({ key: p.key, name: p.name[locale], yieldQty: p.yieldQty })),
    composition: COMPOSITION,
    prices: PRICES,
    expenses: EXPENSES.map((e) => ({ name: e.name[locale], category: e.category, amount: e.amount, frequency: e.frequency })),
    assets: ASSETS.map((a) => ({ name: a.name[locale], category: a.category, qty: a.qty, unitPrice: a.unitPrice, usefulLifeMonths: a.months })),
  };
}

/** The same store as lib/calc input, with keys as ids — lets tests check the numbers without a database. */
export function demoAsStoreData(demo: DemoStore): StoreData {
  return {
    store: { id: "demo", name: demo.store.name, targetMarginPct: demo.store.targetMarginPct, operatingDaysPerMonth: demo.store.operatingDaysPerMonth },
    materials: demo.materials.map((m) => ({ id: m.key, name: m.name, category: m.category, purchaseQty: m.purchaseQty, purchaseUnit: m.purchaseUnit, purchasePrice: m.purchasePrice, wastePct: 0 })),
    products: demo.products.map((p) => ({ id: p.key, name: p.name, category: null, yieldQty: p.yieldQty, targetMarginPct: null, isActive: true })),
    composition: demo.composition.map((row, i) => ({ id: `c${i}`, productId: row.product, materialId: row.material, qty: row.qty, unit: row.unit, basis: row.basis, channelId: row.channel ?? null })),
    channels: demo.channels.map((c) => ({ id: c.key, name: c.name, commissionPct: c.commissionPct, fixedFee: c.fixedFee })),
    prices: demo.prices.map((p) => ({ productId: p.product, channelId: p.channel, price: p.price, estMonthlySales: p.est, competitorPrice: p.competitor })),
    expenses: demo.expenses.map((e, i) => ({ id: `e${i}`, name: e.name, category: e.category, amount: e.amount, frequency: e.frequency })),
    assets: demo.assets.map((a, i) => ({ id: `a${i}`, name: a.name, category: a.category, qty: a.qty, unitPrice: a.unitPrice, usefulLifeMonths: a.usefulLifeMonths })),
  };
}

export type SeedResult = { storeId: string } | { error: "duplicate" | "limit" | "failed" };

// SQLSTATE raised by the stores_enforce_limit trigger.
const STORE_LIMIT_ERROR_CODE = "UT001";

/**
 * Writes the sample store with the signed-in user's client (RLS applies). If anything fails after the
 * store exists, the store is deleted — every other row cascades — so nothing half-made is left behind.
 */
export async function seedDemoStore(supabase: SupabaseClient<Database>, demo: DemoStore, storeName: string): Promise<SeedResult> {
  const created = await supabase.rpc("create_store", {
    p_name: storeName,
    p_business_type: demo.store.businessType,
    p_operating_days: demo.store.operatingDaysPerMonth,
    p_target_margin: demo.store.targetMarginPct,
    p_target_market: demo.store.targetMarket,
    p_default_channel_name: demo.channels[0].name,
  });
  if (created.error?.code === "23505") return { error: "duplicate" };
  if (created.error?.code === STORE_LIMIT_ERROR_CODE) return { error: "limit" };
  if (created.error || !created.data) return { error: "failed" };
  const storeId = created.data as string;

  try {
    const must = <T>(result: { data: T | null; error: unknown }): T => {
      if (result.error || result.data === null) throw result.error ?? new Error("no data");
      return result.data;
    };

    const cash = must(await supabase.from("sales_channels").select("id").eq("store_id", storeId).single());
    const gofoodSpec = demo.channels[1];
    const gofood = must(
      await supabase
        .from("sales_channels")
        .insert({ store_id: storeId, name: gofoodSpec.name, commission_pct: gofoodSpec.commissionPct, fixed_fee: gofoodSpec.fixedFee, sort_order: 1 })
        .select("id")
        .single(),
    );
    const channelIds: Record<"cash" | "gofood", string> = { cash: cash.id, gofood: gofood.id };

    const materials = must(
      await supabase
        .from("materials")
        .insert(demo.materials.map((m) => ({ store_id: storeId, name: m.name, category: m.category, purchase_qty: m.purchaseQty, purchase_unit: m.purchaseUnit, purchase_price: m.purchasePrice })))
        .select("id, name"),
    );
    const products = must(
      await supabase
        .from("products")
        .insert(demo.products.map((p) => ({ store_id: storeId, name: p.name, yield_qty: p.yieldQty })))
        .select("id, name"),
    );
    const materialIds = new Map(demo.materials.map((m) => [m.key, materials.find((row) => row.name === m.name)!.id]));
    const productIds = new Map(demo.products.map((p) => [p.key, products.find((row) => row.name === p.name)!.id]));

    must(
      await supabase
        .from("product_materials")
        .insert(
          demo.composition.map((row) => ({
            store_id: storeId,
            product_id: productIds.get(row.product)!,
            material_id: materialIds.get(row.material)!,
            qty: row.qty,
            unit: row.unit,
            basis: row.basis,
            channel_id: row.channel ? channelIds[row.channel] : null,
          })),
        )
        .select("id"),
    );
    must(
      await supabase
        .from("product_channel_prices")
        .insert(
          demo.prices.map((p) => ({
            store_id: storeId,
            product_id: productIds.get(p.product)!,
            channel_id: channelIds[p.channel],
            price: p.price,
            est_monthly_sales: p.est,
            competitor_price: p.competitor,
          })),
        )
        .select("id"),
    );
    must(await supabase.from("operating_expenses").insert(demo.expenses.map((e) => ({ store_id: storeId, ...e }))).select("id"));
    must(
      await supabase
        .from("assets")
        .insert(demo.assets.map((a) => ({ store_id: storeId, name: a.name, category: a.category, qty: a.qty, unit_price: a.unitPrice, useful_life_months: a.usefulLifeMonths })))
        .select("id"),
    );
    return { storeId };
  } catch {
    await supabase.from("stores").delete().eq("id", storeId);
    return { error: "failed" };
  }
}
```

If a column name differs from the database (check `lib/supabase/database.types.ts`: e.g. `sales_channels.sort_order`, `commission_pct`, `fixed_fee`), use the real name. If the default cash channel's `select … .single()` could match more than one row, filter by `sort_order` or take the first by `created_at`.

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run tests/unit/demo-store.test.ts`
Expected: PASS. If `netProfit` or the warning expectations fail, the calc is the authority: adjust the sample's estimated sales or prices (never the calc or the assertions' intent) and report the change.

- [ ] **Step 5: Write the failing integration test**

Create `tests/rls/seed.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildDemoStore, seedDemoStore } from "@/lib/seed/demo-store";
import { createTestUser } from "./helpers";

vi.mock("server-only", () => ({}));

async function counts(client: Awaited<ReturnType<typeof createTestUser>>["client"], storeId: string) {
  const tables = ["materials", "products", "product_materials", "product_channel_prices", "operating_expenses", "assets", "sales_channels"] as const;
  const result: Record<string, number> = {};
  for (const table of tables) {
    const { count } = await client.from(table).select("*", { count: "exact", head: true }).eq("store_id", storeId);
    result[table] = count ?? 0;
  }
  return result;
}

describe("seedDemoStore", () => {
  it("creates the whole sample store for the signed-in user", async () => {
    const user = await createTestUser("seed");
    const demo = buildDemoStore("id");
    const result = await seedDemoStore(user.client, demo, demo.store.name);
    expect("storeId" in result).toBe(true);
    const storeId = (result as { storeId: string }).storeId;
    expect(await counts(user.client, storeId)).toEqual({
      materials: demo.materials.length,
      products: demo.products.length,
      product_materials: demo.composition.length,
      product_channel_prices: demo.prices.length,
      operating_expenses: demo.expenses.length,
      assets: demo.assets.length,
      sales_channels: 2,
    });
  });

  it("reports a duplicate name without creating anything", async () => {
    const user = await createTestUser("seed-dup");
    const demo = buildDemoStore("id");
    await seedDemoStore(user.client, demo, demo.store.name);
    expect(await seedDemoStore(user.client, demo, demo.store.name)).toEqual({ error: "duplicate" });
    const { count } = await user.client.from("stores").select("*", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("removes the store when a later insert fails", async () => {
    const user = await createTestUser("seed-fail");
    const demo = buildDemoStore("id");
    const broken = { ...demo, assets: [{ ...demo.assets[0], usefulLifeMonths: 0 }] }; // violates useful_life_months >= 1
    expect(await seedDemoStore(user.client, broken, "Toko Gagal")).toEqual({ error: "failed" });
    const { count } = await user.client.from("stores").select("*", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("respects the store limit", async () => {
    const user = await createTestUser("seed-limit");
    const demo = buildDemoStore("id");
    await seedDemoStore(user.client, demo, "Satu");
    await seedDemoStore(user.client, demo, "Dua");
    expect(await seedDemoStore(user.client, demo, "Tiga")).toEqual({ error: "limit" });
  });
});
```

If `lib/seed/demo-store.ts` imports nothing server-only, drop the `vi.mock`. Check `vitest.rls.config.ts` resolves the `@/` alias; if not, import with a relative path (`../../lib/seed/demo-store`).

- [ ] **Step 6: Run it (fail → pass)**

Run: `npm run test:rls -- tests/rls/seed.test.ts`
Expected: PASS (after Step 3 is in place it should pass immediately; run it once with an obviously wrong expectation first if you need to see RED, then restore).

- [ ] **Step 7: Messages, action and button**

Add to the `Onboarding` namespace in `messages/id.json`:

```json
"or": "atau",
"demoTitle": "Belum siap mengisi data sendiri?",
"demoBody": "Lihat dulu contoh kedai kopi yang sudah lengkap: bahan, kemasan, produk, GoFood, biaya termasuk gajimu, dan inventaris. Nanti bisa kamu ubah atau hapus.",
"demoButton": "Coba dengan data contoh",
"demoPending": "Menyiapkan contoh…",
"demoFailed": "Data contoh gagal dibuat. Coba lagi."
```

and to `messages/en.json`:

```json
"or": "or",
"demoTitle": "Not ready to enter your own data?",
"demoBody": "Explore a complete sample coffee shop first: materials, packaging, products, GoFood, costs including your salary, and equipment. You can change or delete it later.",
"demoButton": "Try with sample data",
"demoPending": "Preparing the sample…",
"demoFailed": "The sample data couldn't be created. Try again."
```

Add to `app/[locale]/onboarding/actions.ts`:

```ts
import { buildDemoStore, seedDemoStore } from "@/lib/seed/demo-store";
import type { AppLocale } from "@/i18n/routing";

const MAX_NAME_ATTEMPTS = 5;

export async function createDemoStoreAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const tStore = await getTranslations("Store");
  const tOnboarding = await getTranslations("Onboarding");
  const { supabase, userId } = await requireUser();

  const [profile, stores] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).single(),
    supabase.from("stores").select("id", { count: "exact", head: true }),
  ]);
  if (profile.error || stores.error) return { message: tOnboarding("demoFailed") };
  const plan = toPlan(profile.data?.plan);
  const limitMessage = tStore("limitReached", { max: PLAN_LIMITS[plan].maxStores });
  if (!canCreateStore(plan, stores.count ?? 0)) return { message: limitMessage };

  const locale = (await getLocale()) as AppLocale;
  const demo = buildDemoStore(locale);
  for (let attempt = 1; attempt <= MAX_NAME_ATTEMPTS; attempt++) {
    const name = attempt === 1 ? demo.store.name : `${demo.store.name} ${attempt}`;
    const result = await seedDemoStore(supabase, demo, name);
    if ("storeId" in result) {
      return redirect({ href: `/s/${result.storeId}/dashboard?welcome=1`, locale });
    }
    if (result.error === "limit") return { message: limitMessage };
    if (result.error === "failed") return { message: tOnboarding("demoFailed") };
  }
  return { message: tOnboarding("demoFailed") };
}
```

Create `app/[locale]/onboarding/demo-store-button.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/forms/submit-button";
import { createDemoStoreAction } from "./actions";

export function DemoStoreButton() {
  const t = useTranslations("Onboarding");
  const [state, formAction] = useActionState(createDemoStoreAction, undefined);
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="font-medium">{t("demoTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("demoBody")}</p>
      <SubmitButton variant="outline" className="w-full" pendingText={t("demoPending")}>
        {t("demoButton")}
      </SubmitButton>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
```

In `app/[locale]/onboarding/page.tsx`, render below `<OnboardingForm />`:

```tsx
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <DemoStoreButton />
```

(import `DemoStoreButton` from `./demo-store-button`).

- [ ] **Step 8: Write the e2e test**

Create `tests/e2e/finishing.spec.ts`:

```ts
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
```

If `signIn`'s signature differs (`signIn(page, email?, next?)`), adapt the call; if the metric test id differs, use the one the dashboard e2e uses.

- [ ] **Step 9: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint && npm run test:rls && npm run build`, e2e `tests/e2e/finishing.spec.ts tests/e2e/onboarding.spec.ts`, then the full suite. Screenshot the onboarding page at 360 and 1280 (light/dark) and the sample store's dashboard; look at them.

```bash
git add lib/seed "app/[locale]/onboarding" messages tests/unit/demo-store.test.ts tests/rls/seed.test.ts tests/e2e/finishing.spec.ts
git commit -m "feat(onboarding): sample coffee shop in one tap"
```

---

### Task 3: Privacy page and self-service account deletion

**Files:**
- Create: `app/[locale]/privasi/page.tsx`, `app/[locale]/s/[storeId]/pengaturan/account-actions.ts`, `app/[locale]/s/[storeId]/pengaturan/delete-account-form.tsx`, `tests/rls/account.test.ts`
- Modify: `lib/auth/require-user.ts`, `app/[locale]/s/[storeId]/pengaturan/page.tsx`, `app/[locale]/page.tsx`, `app/[locale]/login/page.tsx`, `app/[locale]/s/[storeId]/analisis/page.tsx`, `messages/id.json`, `messages/en.json`, `tests/e2e/finishing.spec.ts`, `docs/superpowers/specs/2026-10-16-untungin-design.md`

**Interfaces:**
- Consumes: `createAdminClient` (Phase 5), `requireUser`, `FormState`, `rawValues`, `getValidationTranslator`.
- Produces: `requireUser()` now returns `{ supabase, userId, email: string | null }`; `deleteAccountAction(prev, formData)`; `emailConfirmationMatches(input, email)`; page `/privasi`.

- [ ] **Step 1: Write the failing integration test (cascade)**

Create `tests/rls/account.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { admin, createStore, createTestUser } from "./helpers";

describe("deleting an auth user", () => {
  it("removes that user's profile, stores, store data, analyses and usage — and nobody else's", async () => {
    const leaving = await createTestUser("acct-leave");
    const staying = await createTestUser("acct-stay");
    const leavingStore = await createStore(leaving, "Toko Pergi");
    const stayingStore = await createStore(staying, "Toko Tetap");
    await leaving.client
      .from("materials")
      .insert({ store_id: leavingStore, name: "Gula", category: "bahan", purchase_qty: 1, purchase_unit: "kg", purchase_price: 1 });
    await admin.from("ai_usage").insert({ user_id: leaving.id });
    await admin.from("ai_analyses").insert({ store_id: leavingStore, user_id: leaving.id, model: "m", snapshot_hash: "h", input_snapshot: {}, output: {} });

    const { error } = await admin.auth.admin.deleteUser(leaving.id);
    expect(error).toBeNull();

    const count = async (table: string, column: string, value: string) =>
      (await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value)).count;
    expect(await count("profiles", "id", leaving.id)).toBe(0);
    expect(await count("stores", "id", leavingStore)).toBe(0);
    expect(await count("materials", "store_id", leavingStore)).toBe(0);
    expect(await count("ai_usage", "user_id", leaving.id)).toBe(0);
    expect(await count("ai_analyses", "store_id", leavingStore)).toBe(0);
    expect(await count("stores", "id", stayingStore)).toBe(1);
    expect(await count("profiles", "id", staying.id)).toBe(1);
  });
});
```

Run: `npm run test:rls -- tests/rls/account.test.ts`. Expected: PASS already (the cascades exist since Phase 1/5) — this test pins the behaviour account deletion relies on. If it fails, stop and report: the deletion feature must not ship on a broken cascade.

- [ ] **Step 2: Confirmation helper (TDD)**

Add to `tests/unit/store-validation.test.ts` (or a new `tests/unit/account.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { emailConfirmationMatches } from "@/lib/validation/account";

describe("emailConfirmationMatches", () => {
  it("accepts the account email, ignoring case and surrounding spaces", () => {
    expect(emailConfirmationMatches("  Abby@Example.com ", "abby@example.com")).toBe(true);
  });
  it.each([["", "a@b.c"], ["a@b.c", ""], ["x@b.c", "a@b.c"], ["a@b.c ", "a@b.co"]])("rejects %j for %j", (input, email) => {
    expect(emailConfirmationMatches(input, email)).toBe(false);
  });
});
```

Run → FAIL. Create `lib/validation/account.ts`:

```ts
/** The user must type their own email to delete the account. Empty never matches. */
export function emailConfirmationMatches(input: string, email: string): boolean {
  const typed = input.trim().toLowerCase();
  return typed !== "" && email.trim() !== "" && typed === email.trim().toLowerCase();
}
```

Run → PASS.

- [ ] **Step 3: `requireUser` returns the email**

```ts
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return redirect({ href: "/login", locale: await getLocale() });
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { supabase, userId: data.claims.sub, email };
}
```

- [ ] **Step 4: Messages**

Add a new `Account` namespace to `messages/id.json`:

```json
"Account": {
  "title": "Akun",
  "deleteTitle": "Hapus akun",
  "deleteDescription": "Semua toko dan datamu ikut terhapus permanen. Tidak bisa dibatalkan.",
  "deleteWarning": "Akun <addr>{email}</addr> beserta semua toko, bahan, produk, biaya, inventaris, dan analisis AI akan dihapus. Ketik email-mu untuk melanjutkan.",
  "confirmLabel": "Ketik email-mu untuk konfirmasi",
  "confirmMismatch": "Email tidak cocok dengan akunmu.",
  "deleteSubmit": "Hapus akun saya",
  "deletePending": "Menghapus akun…",
  "deleteFailed": "Akun gagal dihapus. Coba lagi atau hubungi kami.",
  "deleted": "Akunmu sudah dihapus beserta semua datanya."
}
```

and to `messages/en.json`:

```json
"Account": {
  "title": "Account",
  "deleteTitle": "Delete account",
  "deleteDescription": "All your stores and data are deleted for good. This can't be undone.",
  "deleteWarning": "The account <addr>{email}</addr> and all its stores, materials, products, costs, equipment and AI analyses will be deleted. Type your email to continue.",
  "confirmLabel": "Type your email to confirm",
  "confirmMismatch": "That email doesn't match your account.",
  "deleteSubmit": "Delete my account",
  "deletePending": "Deleting account…",
  "deleteFailed": "The account couldn't be deleted. Try again or contact us.",
  "deleted": "Your account and all its data have been deleted."
}
```

Add a `Privacy` namespace (id):

```json
"Privacy": {
  "title": "Kebijakan privasi",
  "updated": "Terakhir diperbarui: 18 Oktober 2026",
  "intro": "Untungin membantu kamu menghitung HPP, harga, dan laba usaha. Halaman ini menjelaskan data apa yang kami simpan, untuk apa, dan bagaimana kamu menghapusnya.",
  "whoTitle": "Siapa kami",
  "whoBody": "Untungin dikelola oleh {name}. Pertanyaan atau permintaan soal datamu: <mail>{email}</mail>.",
  "dataTitle": "Data yang kami simpan",
  "dataAccount": "Akun: nama dan email dari akun Google yang kamu pakai untuk masuk, serta pilihan bahasa.",
  "dataStore": "Data usaha yang kamu isi: toko, bahan, produk, resep, harga, kanal penjualan, biaya, dan inventaris.",
  "dataAi": "Hasil analisis AI yang kamu minta, beserta ringkasan angka toko yang dikirim untuk analisis itu, dan catatan pemakaian kuota harian.",
  "useTitle": "Untuk apa",
  "useBody": "Hanya untuk menjalankan Untungin untukmu: menghitung, menyimpan, dan menampilkan datamu. Kami tidak menjual data dan tidak memakainya untuk iklan.",
  "thirdTitle": "Layanan pihak ketiga",
  "thirdSupabase": "Supabase menyimpan database dan mengurus proses masuk.",
  "thirdGoogle": "Google dipakai untuk masuk (Google Sign-In).",
  "thirdGemini": "Google Gemini menerima ringkasan angka tokomu (nama toko, produk, bahan, kanal, harga, dan biaya) hanya saat kamu menekan \"Analisis usahaku\". Google memproses data itu sesuai ketentuan Gemini API.",
  "thirdVercel": "Vercel menjalankan aplikasi ini.",
  "storageTitle": "Cookie dan penyimpanan di perangkat",
  "storageBody": "Cookie dipakai untuk menjaga kamu tetap masuk dan mengingat bahasa. Di perangkatmu kami juga menyimpan pilihan tema, tampilan grafik 3D/2D, dan tanda bahwa perayaan laba pertama sudah tampil. Tidak ada cookie iklan atau pelacak.",
  "deleteTitle": "Menghapus data",
  "deleteBody": "Kamu bisa menghapus satu toko atau seluruh akun kapan saja di Pengaturan toko. Menghapus akun menghapus semua toko dan datamu secara permanen.",
  "rightsTitle": "Hak kamu",
  "rightsBody": "Kamu berhak melihat, membetulkan, dan menghapus datamu, sesuai UU Pelindungan Data Pribadi. Sebagian besar bisa langsung kamu lakukan di aplikasi; untuk hal lain, hubungi <mail>{email}</mail>.",
  "link": "Kebijakan privasi"
}
```

and the same keys in `messages/en.json`:

```json
"Privacy": {
  "title": "Privacy policy",
  "updated": "Last updated: 18 October 2026",
  "intro": "Untungin helps you work out your cost of goods, prices and profit. This page explains what data we keep, why, and how you delete it.",
  "whoTitle": "Who we are",
  "whoBody": "Untungin is run by {name}. Questions or requests about your data: <mail>{email}</mail>.",
  "dataTitle": "Data we keep",
  "dataAccount": "Account: the name and email of the Google account you sign in with, and your language choice.",
  "dataStore": "Business data you enter: stores, materials, products, recipes, prices, sales channels, costs and equipment.",
  "dataAi": "AI analyses you ask for, with the summary of your store's numbers sent for each one, and a record of your daily quota use.",
  "useTitle": "What it's for",
  "useBody": "Only to run Untungin for you: calculating, saving and showing your data. We don't sell data or use it for ads.",
  "thirdTitle": "Third-party services",
  "thirdSupabase": "Supabase hosts the database and handles sign-in.",
  "thirdGoogle": "Google is used for sign-in (Google Sign-In).",
  "thirdGemini": "Google Gemini receives a summary of your store's numbers (store name, products, materials, channels, prices and costs) only when you press \"Analyze my business\". Google processes it under the Gemini API terms.",
  "thirdVercel": "Vercel runs this app.",
  "storageTitle": "Cookies and on-device storage",
  "storageBody": "Cookies keep you signed in and remember your language. On your device we also keep your theme, the 3D/2D chart view, and a note that the first-profit celebration has been shown. There are no ad or tracking cookies.",
  "deleteTitle": "Deleting data",
  "deleteBody": "You can delete a store or your whole account at any time in Store settings. Deleting the account permanently removes all your stores and data.",
  "rightsTitle": "Your rights",
  "rightsBody": "You can see, correct and delete your data, as Indonesia's Personal Data Protection Law provides. Most of it you can do in the app; for anything else, contact <mail>{email}</mail>.",
  "link": "Privacy policy"
}
```

Add to `Landing` (id/en): `"accountDeleted": "Akunmu sudah dihapus beserta semua datanya."` / `"accountDeleted": "Your account and all its data have been deleted."`.

- [ ] **Step 5: The privacy page**

Create `app/[locale]/privasi/page.tsx`:

```tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

const OPERATOR = { name: "Rycco Atika", email: "me@ryccoatika.com" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const mail = (chunks: React.ReactNode) => (
    <a href={`mailto:${OPERATOR.email}`} className="font-medium underline underline-offset-4">
      {chunks}
    </a>
  );
  const section = (title: string, children: React.ReactNode) => (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-sm leading-relaxed [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between gap-2">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("updated")}</p>
      </header>
      <p>{t("intro")}</p>
      {section(t("whoTitle"), <p>{t.rich("whoBody", { name: OPERATOR.name, email: OPERATOR.email, mail })}</p>)}
      {section(
        t("dataTitle"),
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("dataAccount")}</li>
          <li>{t("dataStore")}</li>
          <li>{t("dataAi")}</li>
        </ul>,
      )}
      {section(t("useTitle"), <p>{t("useBody")}</p>)}
      {section(
        t("thirdTitle"),
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("thirdSupabase")}</li>
          <li>{t("thirdGoogle")}</li>
          <li>{t("thirdGemini")}</li>
          <li>{t("thirdVercel")}</li>
        </ul>,
      )}
      {section(t("storageTitle"), <p>{t("storageBody")}</p>)}
      {section(t("deleteTitle"), <p>{t("deleteBody")}</p>)}
      {section(t("rightsTitle"), <p>{t.rich("rightsBody", { email: OPERATOR.email, mail })}</p>)}
    </main>
  );
}
```

`<mail>{email}</mail>` makes the address a `mailto:` link through `t.rich`. Keep the operator and email exactly as given.

Links to `/privasi` (`Link` from `@/i18n/navigation`, text `t("link")` from `Privacy`, `text-sm underline-offset-4 hover:underline`, at least 40px tall via `inline-flex min-h-10 items-center`):
- `app/[locale]/page.tsx`: a footer line under the features list.
- `app/[locale]/login/page.tsx`: under the Google button.
- `app/[locale]/s/[storeId]/analisis/page.tsx`: append the link after the privacy note (`Analysis.privacy`).
- Settings page "Akun" card description (Step 7).

- [ ] **Step 6: The delete-account action**

Create `app/[locale]/s/[storeId]/pengaturan/account-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { rawValues, type FormState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfirmationMatches } from "@/lib/validation/account";

/**
 * Deletes the signed-in user's account and everything it owns (profile → stores → all store data,
 * AI analyses and usage cascade). The session is verified first; the secret key is used only for
 * the auth admin call. The browser is then signed out.
 */
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = rawValues(formData, ["confirmEmail"]);
  const t = await getTranslations("Account");
  const { supabase, userId, email } = await requireUser();
  if (!email || !emailConfirmationMatches(values.confirmEmail ?? "", email)) {
    return { fieldErrors: { confirmEmail: [t("confirmMismatch")] }, values };
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error(`Account deletion failed: ${error.message}`);
    return { message: t("deleteFailed"), values };
  }
  // The user no longer exists; clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  revalidatePath("/", "layout");
  return redirect({ href: "/?akun=dihapus", locale: await getLocale() });
}
```

Create `app/[locale]/s/[storeId]/pengaturan/delete-account-form.tsx`, mirroring `delete-store-form.tsx` (same `useActionState`, `FieldError`, `SubmitButton variant="destructive"`), with:
- warning text `t.rich("deleteWarning", { email, addr: (chunks) => <span className="font-medium text-foreground [overflow-wrap:anywhere]">{chunks}</span> })` (same pattern as the store form; the `<addr>` tag wraps the address);
- input `id="confirmEmail" name="confirmEmail" type="email" autoComplete="off"`, label `t("confirmLabel")`;
- submit `t("deleteSubmit")` / pending `t("deletePending")`.

It receives `email: string` as a prop (the settings page gets it from `requireUser()`).

In `app/[locale]/s/[storeId]/pengaturan/page.tsx`, after the store-delete card, add an "Akun" card (`border-destructive/40`) with title `Account.deleteTitle`, description `Account.deleteDescription` plus a link to `/privasi`, and `<DeleteAccountForm email={email} />` (`const { email } = await requireUser();` — if `email` is null, show `Account.deleteFailed` instead of the form).

In `app/[locale]/page.tsx`, read `searchParams` (`Promise<Record<string, string | string[] | undefined>>`) and, when `akun === "dihapus"`, render `<p role="status" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">{t("accountDeleted")}</p>` above the hero.

- [ ] **Step 7: e2e**

Append to `tests/e2e/finishing.spec.ts` (add `createStoreViaOnboarding`, `storeUrl`, `adminClient` and `userIdByEmail` to the helper imports; `signIn` returns the email):

```ts
test("the privacy page is public, in both languages, and linked from the landing and login pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Kebijakan privasi" }).click();
  await expect(page).toHaveURL(/\/privasi$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kebijakan privasi" })).toBeVisible();
  await expect(page.getByText("Rycco Atika")).toBeVisible();
  await expect(page.getByRole("link", { name: "me@ryccoatika.com" }).first()).toHaveAttribute("href", "mailto:me@ryccoatika.com");
  await expect(page.getByText(/Google Gemini/)).toBeVisible();
  await page.goto("/en/privasi");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Kebijakan privasi" })).toBeVisible();
});

test("a wrong email deletes nothing; the right one deletes the account and signs out", async ({ page }) => {
  const email = await signIn(page);
  await createStoreViaOnboarding(page, "Toko Akun");
  await page.goto(storeUrl(page, "pengaturan"));

  await page.getByLabel("Ketik email-mu untuk konfirmasi").fill("orang-lain@test.local");
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page.getByText("Email tidak cocok dengan akunmu.")).toBeVisible();
  expect(await userIdByEmail(email)).toBeTruthy();

  await page.getByLabel("Ketik email-mu untuk konfirmasi").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  await expect(page).toHaveURL(/\/\?akun=dihapus$|\/id\?akun=dihapus$/);
  await expect(page.getByRole("status").filter({ hasText: "Akunmu sudah dihapus" })).toBeVisible();
  await expect(userIdByEmail(email)).rejects.toThrow(/No user/);

  await page.goto("/toko");
  await expect(page).toHaveURL(/\/login/);
});
```

Adapt the URL regex to the app's actual unprefixed default-locale behaviour (look at how other specs assert landing URLs).

- [ ] **Step 8: Spec notes**

In the spec §10, under item 7, add:

```
   Phase 7 notes: the sample store is "Kedai Kopi Contoh" / "Sample Coffee Shop" (a numbered name if it already exists), seeded with the user's client and removed again if any insert fails; account deletion lives in Store settings, is confirmed by typing the account email, deletes the auth user (everything cascades) and signs out; anon has no table access and authenticated has no TRUNCATE/TRIGGER/REFERENCES; Rupiah inputs show grouped digits after leaving the field; the privacy page names Rycco Atika (me@ryccoatika.com) as operator.
```

- [ ] **Step 9: Verify and commit**

Run unit, typecheck, lint, test:rls, build, e2e `tests/e2e/finishing.spec.ts tests/e2e/settings.spec.ts tests/e2e/landing.spec.ts tests/e2e/auth.spec.ts`, then the full suite. Screenshot `/privasi` at 360 and 1280 (light, dark) and the settings page with both danger cards; look at them.

```bash
git add "app/[locale]" lib/auth/require-user.ts lib/validation/account.ts messages tests docs/superpowers/specs/2026-10-16-untungin-design.md
git commit -m "feat(privacy): privacy page and self-service account deletion"
```

---

### Task 4: Polish — Rupiah inputs, dashboard hierarchy, AI wording, deploy checklist

**Files:**
- Create: `components/forms/money-input.tsx`, `tests/unit/money.test.ts`, `docs/deploy.md`
- Modify: `lib/validation/number.ts`, `lib/format.ts`, `app/[locale]/s/[storeId]/bahan/material-form.tsx`, `app/[locale]/s/[storeId]/biaya/expense-form.tsx`, `app/[locale]/s/[storeId]/kanal/channel-form.tsx`, `app/[locale]/s/[storeId]/inventaris/asset-form.tsx`, `app/[locale]/s/[storeId]/produk/[productId]/price-form.tsx`, `app/[locale]/s/[storeId]/dashboard/page.tsx`, `lib/ai/prompt.ts`, `tests/unit/ai-output.test.ts`, `README.md`, `tests/e2e/finishing.spec.ts`

**Interfaces:**
- Produces: `parseWholeNumber(value: string): number | undefined` (NaN for invalid), `groupDigits(raw: string | number | undefined | null, locale: AppLocale): string`, `<MoneyInput … />` (same props as `Input`).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { groupDigits } from "@/lib/format";
import { parseWholeNumber } from "@/lib/validation/number";

describe("parseWholeNumber", () => {
  it.each([
    ["18000", 18000],
    ["18.000", 18000],
    ["18,000", 18000],
    ["Rp 18.000", 18000],
    ["rp18.000", 18000],
    ["1.250.000", 1250000],
    ["0", 0],
  ])("%j → %d", (input, expected) => {
    expect(parseWholeNumber(input)).toBe(expected);
  });

  it("returns undefined for blank and NaN for anything else", () => {
    expect(parseWholeNumber("  ")).toBeUndefined();
    for (const bad of ["15.5", "-1", "1.2.3", "abc", "18.00", "1,000.5"]) expect(parseWholeNumber(bad)).toBeNaN();
  });
});

describe("groupDigits", () => {
  it("groups whole Rupiah in the locale", () => {
    expect(groupDigits("18000", "id")).toBe("18.000");
    expect(groupDigits("18000", "en")).toBe("18,000");
    expect(groupDigits(1250000, "id")).toBe("1.250.000");
    expect(groupDigits("Rp 18.000", "en")).toBe("18,000");
    expect(groupDigits("950", "id")).toBe("950");
  });

  it("leaves blank and unreadable input exactly as typed", () => {
    expect(groupDigits("", "id")).toBe("");
    expect(groupDigits(undefined, "id")).toBe("");
    expect(groupDigits("15.5", "id")).toBe("15.5");
    expect(groupDigits("abc", "en")).toBe("abc");
  });
});
```

Add to the `prompt` describe in `tests/unit/ai-output.test.ts`:

```ts
  it("asks for Rupiah formatting and explains every unit", () => {
    const id = systemInstruction("id");
    expect(id).toContain("Rp80.000");
    expect(systemInstruction("en")).toContain("Rp80,000");
    for (const field of ["totalCapital", "fixedFee", "totalUnits"]) expect(id).toContain(field);
    expect(id).toMatch(/totalCapital[^.]*one-off/);
  });
```

Run: `npx vitest run tests/unit/money.test.ts tests/unit/ai-output.test.ts` → FAIL.

- [ ] **Step 2: Shared parser and formatter**

In `lib/validation/number.ts`, extract the body of `wholeNumber`'s preprocess into an exported function and use it:

```ts
/** "15000", "15.000", "15,000", "Rp 15.000" → 15000; blank → undefined; anything else → NaN. */
export function parseWholeNumber(value: string): number | undefined {
  const s = value.trim().replace(/^rp\.?\s*/i, "");
  if (s === "") return undefined;
  if (/^\d+$/.test(s)) return Number(s);
  if (THOUSANDS.some((pattern) => pattern.test(s))) return Number(s.replace(/[., ]/g, ""));
  return Number.NaN;
}

export function wholeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => (typeof value === "string" ? parseWholeNumber(value) : value), inner);
}
```

(keep the existing doc comment on `wholeNumber`; `THOUSANDS` must be declared above `parseWholeNumber`). The existing `number.test.ts` must keep passing unchanged.

In `lib/format.ts`:

```ts
import { parseWholeNumber } from "@/lib/validation/number";

/** A Rupiah field's value with the locale's thousands separator ("18.000" id, "18,000" en); unreadable input is returned unchanged. */
export function groupDigits(raw: string | number | undefined | null, locale: AppLocale): string {
  if (raw === undefined || raw === null) return "";
  const text = String(raw);
  const value = typeof raw === "number" ? raw : parseWholeNumber(text);
  if (value === undefined || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return text;
  return formatNumber(value, locale, 0);
}
```

If importing from `lib/validation/number.ts` into `lib/format.ts` creates a cycle or pulls zod into client bundles in a problematic way, move `parseWholeNumber` + `THOUSANDS` to `lib/whole-number.ts` and import it from both.

- [ ] **Step 3: `MoneyInput`**

Create `components/forms/money-input.tsx`:

```tsx
"use client";

import type { ComponentProps, FocusEvent } from "react";
import { useLocale } from "next-intl";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/routing";
import { groupDigits } from "@/lib/format";

/** Rupiah field: shows "18.000" after leaving the field; accepts everything the server's wholeNumber accepts. */
export function MoneyInput({ defaultValue, onBlur, ...props }: ComponentProps<typeof Input>) {
  const locale = useLocale() as AppLocale;
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    event.currentTarget.value = groupDigits(event.currentTarget.value, locale);
    onBlur?.(event);
  };
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      {...props}
      defaultValue={defaultValue === undefined ? undefined : groupDigits(defaultValue as string | number, locale)}
      onBlur={handleBlur}
    />
  );
}
```

Replace the plain `Input` with `MoneyInput` for: `purchasePrice` (material-form.tsx), `amount` (expense-form.tsx), `fixedFee` (channel-form.tsx), `unitPrice` (asset-form.tsx), `price` and `competitorPrice` (price-form.tsx). Keep `id`, `name`, `placeholder` and refs (React 19 passes `ref` as a prop; `priceRef` keeps working). In price-form.tsx, where "Pakai harga rekomendasi" sets the value (`priceRef.current.value = String(recommendation.price)`), set `groupDigits(recommendation.price, locale)` instead, and keep whatever event it dispatches so the live preview updates. Any live preview that parses the field must keep parsing grouped values (they use the same zod/`wholeNumber` rules — verify).

- [ ] **Step 4: Dashboard hierarchy**

In `app/[locale]/s/[storeId]/dashboard/page.tsx`, swap the two action links so "Analisis usahaku" comes first with the default (filled) variant and "Coba simulasi" second with `variant: "outline"`.

- [ ] **Step 5: AI wording**

In `lib/ai/prompt.ts`:
- extend the units line with: `totals.totalCapital is a one-off Rupiah amount (what the equipment cost), not per month; channels[].fixedFee is Rupiah per order; totals.totalUnits is units sold per month.`
- add a rule: `- Write money the way the user reads it: "Rp80.000" in Indonesian or "Rp80,000" in English, never bare digits like 80000.` Render the example per locale (pick by `locale`), so the id prompt contains "Rp80.000" and the en prompt "Rp80,000".

- [ ] **Step 6: Run the unit tests**

Run: `npx vitest run tests/unit/money.test.ts tests/unit/ai-output.test.ts tests/unit/number.test.ts` → PASS.

- [ ] **Step 7: Deploy checklist**

Create `docs/deploy.md` with these sections, written as numbered steps:

```markdown
# Production deploy checklist

Run in order. Every value marked *secret* goes only into Vercel's environment settings, never into code, chat or `NEXT_PUBLIC_*`.

## 1. Supabase (production project)
1. Create the project (region: Singapore, closest to Indonesia).
2. Link and push the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Confirm every file in `supabase/migrations/` is listed as applied.
3. Check the AI tables and grants (SQL editor):
   `select grantee, privilege_type from information_schema.role_table_grants where table_name in ('ai_usage','ai_analyses','stores') and grantee in ('anon','authenticated') order by 1,2;`
   Expect: no `anon` rows; `authenticated` without TRUNCATE/TRIGGER/REFERENCES.
4. Auth → Providers: enable **Google** (client id + *secret* from step 2 below); **disable Email**.
5. Auth → URL configuration: Site URL `https://untungin.ryccoatika.com`; Redirect URLs `https://untungin.ryccoatika.com/**` (add `https://<project>-*.vercel.app/**` only if you use preview deployments).
6. Note the project URL, the publishable key and the *secret* key.

## 2. Google Cloud (OAuth client)
1. Credentials → OAuth client (Web): authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback` (keep `http://127.0.0.1:54321/auth/v1/callback` for local development).
2. OAuth consent screen: app name Untungin, support email me@ryccoatika.com, privacy policy URL `https://untungin.ryccoatika.com/privasi`.

## 3. Gemini
1. Create an API key in Google AI Studio (aistudio.google.com/apikey) — it enables the Gemini API for its project.
2. Decide the tier: on the free tier Google may use prompts to improve its products; a paid-tier key avoids that (the privacy page says Google processes the data under the Gemini API terms).

## 4. Vercel
1. Import the GitHub repo; framework Next.js.
2. Environment variables (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (*secret*, server only)
   - `GEMINI_API_KEY` (*secret*, server only); optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`)
   - never set `NEXT_PUBLIC_ENABLE_DEV_LOGIN`
3. Domain: add `untungin.ryccoatika.com` and the DNS record Vercel shows.

## 5. Smoke test after deploy
1. `/` loads with the 3D hero (or the static drawing on reduced motion); `/privasi` loads signed out.
2. Sign in with Google → onboarding → "Coba dengan data contoh" → dashboard shows profit.
3. `/s/<id>/analisis` → "Analisis usahaku" returns a result; pressing again says the data hasn't changed.
4. Settings → delete the sample store; then delete a throwaway account and confirm you're signed out.
5. Supabase Auth logs show no email sign-ins (Email provider off).
```

Link it from `README.md` (a "Deploying" section with one sentence and the link).

- [ ] **Step 8: e2e**

Append to `tests/e2e/finishing.spec.ts`:

```ts
test("Rupiah fields show grouped digits and still save", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Rupiah");
  await page.goto(storeUrl(page, "bahan"));
  const price = page.getByLabel("Harga beli");
  await price.fill("15000");
  await price.blur();
  await expect(price).toHaveValue("15.000");
  await price.fill("15.5");
  await price.blur();
  await expect(price).toHaveValue("15.5"); // unreadable input is left for the validation message
});

test("with priced products, AI analysis is the main dashboard action", async ({ page }) => {
  await signIn(page, undefined, "/onboarding");
  await page.getByRole("button", { name: "Coba dengan data contoh" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const analysis = page.getByRole("link", { name: "Analisis usahaku" });
  const simulation = page.getByRole("link", { name: "Coba simulasi" });
  await expect(analysis).toBeVisible();
  const [a, s] = await Promise.all([analysis.boundingBox(), simulation.boundingBox()]);
  expect(a!.y * 10000 + a!.x).toBeLessThan(s!.y * 10000 + s!.x); // analysis comes first
});
```

Use the material price field's real label (check `Materials` messages) and adapt the dashboard link order assertion if the buttons wrap.

- [ ] **Step 9: Verify and commit**

Run unit, typecheck, lint, build, e2e `tests/e2e/finishing.spec.ts tests/e2e/materials.spec.ts tests/e2e/pricing.spec.ts tests/e2e/expenses.spec.ts tests/e2e/assets.spec.ts tests/e2e/channels.spec.ts`, then the FULL suite. Screenshot a material form, the price form (after "Pakai harga rekomendasi") and the dashboard actions at 360; look at them.

```bash
git add components/forms/money-input.tsx lib/validation/number.ts lib/format.ts "app/[locale]/s/[storeId]" lib/ai/prompt.ts tests docs/deploy.md README.md
git commit -m "feat: grouped Rupiah inputs, AI analysis as the main action, Rupiah-formatted AI advice, deploy checklist"
```
