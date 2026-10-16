# BusinessNote — Design Spec (v1)

Date: 2026-10-16
Status: Approved (v1); updated during Phase 1

## 1. Goals

A web app for people who are **just starting to sell** (F&B and processed products such as soap, candles, crafts) so they can calculate COGS (HPP), operating costs, selling price, profit, break-even point (BEP), and payback period **without any accounting knowledge**.

v1 success criteria:
- A new user can log in with Google, create a store, and see the estimated monthly profit after entering at least 1 material + 1 product + a price.
- All numbers come from tested deterministic formulas (`lib/calc`), not from AI.
- The user gets warnings about common beginner mistakes: products that lose money, margin below target, owner salary not yet counted, platform commission not yet counted, price far from competitors.
- The app is comfortable to use on mid-to-low-end Android phones.

### Agreed decisions

| Topic | Decision |
|---|---|
| Profit mode | v1 = **projection** (sales estimate). Actual recording = phase 2 (outside this spec). |
| Business type | F&B + processed products. General UI labels: "Produk" ("Product") & "Komposisi" ("Composition"). Services & resellers are outside v1. |
| User–store | 1 user can have many stores. All data carries a `store_id`. Multiple members are outside v1. |
| Business model | Freemium is prepared (`plan` column, per-plan limits), payment gateway is outside v1. |
| Calculation architecture | Pure TypeScript module `lib/calc`, used on the server and in the browser. |
| AI | Google Gemini, default model **Gemini 3.5 Flash-Lite** (exact ID verified during implementation), via env var. |
| Language | UI available in **Indonesian (`id`, default) and English (`en`)**. Locale is always in the URL prefix (`/id/...`, `/en/...`). Detection order: saved choice (cookie / `profiles.locale`) → browser `Accept-Language` → `id`. Code comments, README, and docs are in English. |
| Visual | Three.js (vanilla, using the `cloudai-x/threejs-skills` skill) for the landing page, 3D dashboard chart (with a 2D toggle), certain moments, empty states. Form pages stay 2D. |

## 2. Stack

- Next.js (App Router, latest stable version at implementation time), TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth (Google OAuth), RLS; `@supabase/ssr`; SQL migrations via Supabase CLI in `supabase/migrations`
- zod (input & AI output validation)
- `next-intl` v4 (i18n routing, messages, number/currency formatting)
- `@google/genai` (Gemini SDK)
- three (vanilla Three.js)
- Vitest (unit/integration), Playwright (e2e)
- Deploy: Vercel

The UI is bilingual (Indonesian default, English) — see §5.4. Currency is always Rupiah without decimals; number formatting follows the active locale. Mobile-first.

## 3. Data Model

All tables have `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, and (except `profiles`/`stores`) `store_id uuid not null references stores(id) on delete cascade`. Money is stored as `integer` (Rupiah). Quantities as `numeric`.

### 3.1 Accounts & stores

**`profiles`**
- `id uuid pk references auth.users(id) on delete cascade`
- `full_name text`
- `plan text not null default 'free' check (plan in ('free','pro'))`
- `locale text null check (locale in ('id','en'))` — the user's saved UI language; `null` = not chosen yet
- Created automatically by a trigger `on auth.users insert`.

**`stores`**
- `owner_id uuid not null references profiles(id) on delete cascade`
- `name text not null`
- `business_type text not null` — `check in ('makanan','minuman','kue_roti','katering','produk_olahan','lainnya')`
- `target_margin_pct numeric not null default 40` — `check (target_margin_pct >= 0 and target_margin_pct < 100)`
- `operating_days_per_month integer not null default 26` — `check between 1 and 31`
- `target_market text null` — `check in ('menengah_bawah','menengah','menengah_atas')`; used only as AI context.
- Unique index `(owner_id, lower(name))`: one user cannot have two stores with the same name (this also prevents duplicate stores caused by double clicks).

### 3.2 Materials

**`materials`**
- `name text not null`
- `category text not null` — `check in ('bahan','kemasan')`
- `purchase_qty numeric not null check (> 0)`
- `purchase_unit text not null` — one of the units in §4.1
- `purchase_price integer not null check (>= 0)`
- `waste_pct numeric not null default 0 check (>= 0 and < 100)`

### 3.3 Products & composition

**`products`**
- `name text not null`
- `category text null`
- `yield_qty numeric not null default 1 check (> 0)` — how many units/portions one recipe/batch produces
- `target_margin_pct numeric null check (>= 0 and < 100)` — overrides the store target if filled
- `is_active boolean not null default true`

**`product_materials`**
- `product_id uuid not null` — composite FK `(product_id, store_id) → products(id, store_id)` `on delete cascade`
- `material_id uuid not null` — composite FK `(material_id, store_id) → materials(id, store_id)` with `on delete no action` (deleting a material that is in use is rejected; deleting a store still works because the check happens at the end of the statement)
- `qty numeric not null check (> 0)`
- `unit text not null` — must be in the same dimension as `materials.purchase_unit`
- `basis text not null default 'batch'` — `check in ('batch','unit')`. `batch` = amount for one recipe (divided by `yield_qty`); `unit` = amount per portion/unit (for example 1 cup, 1 bag). UI default: `batch` for the `bahan` category, `unit` for the `kemasan` category.
- `channel_id uuid null references sales_channels(id) on delete cascade` — `null` = used in all channels; filled = only for that channel (for example bubble wrap only for online).

### 3.4 Sales channels & prices

**`sales_channels`**
- `name text not null`
- `commission_pct numeric not null default 0 check (>= 0 and < 100)`
- `fixed_fee integer not null default 0 check (>= 0)` — fixed fee per transaction/unit
- `sort_order integer not null default 0`
- When a store is created, the channel **"Offline – Tunai"** ("Offline – Cash") (0%, 0) is created automatically.

Channel templates (file `lib/config/channel-templates.ts`, not a table): Offline – QRIS, GoFood, GrabFood, ShopeeFood, Shopee, Tokopedia, TikTok Shop. The default commission values in the template are verified during implementation and marked in the UI as "perkiraan, cek di dashboard merchant kamu" ("estimate, check in your merchant dashboard"). Users can always edit them.

**`product_channel_prices`**
- `product_id uuid not null references products(id) on delete cascade`
- `channel_id uuid not null references sales_channels(id) on delete cascade`
- `price integer not null check (>= 0)`
- `est_monthly_sales integer not null default 0 check (>= 0)`
- `competitor_price integer null check (>= 0)`
- `unique (product_id, channel_id)`

### 3.5 Operating expenses

**`operating_expenses`**
- `name text not null`
- `category text not null` — `check in ('sewa','listrik_air','internet_pulsa','gaji_karyawan','gaji_pemilik','transportasi','pemasaran','lainnya')`
- `amount integer not null check (>= 0)`
- `frequency text not null` — `check in ('harian','mingguan','bulanan','tahunan')`

One-time marketing costs (for example an endorsement) are entered with the frequency `tahunan` or divided manually by the user; the UI explains this.

### 3.6 Inventory / assets

**`assets`**
- `name text not null`
- `category text not null` — `check in ('peralatan','furnitur','elektronik','kendaraan','renovasi','perizinan','lainnya')`
- `qty integer not null default 1 check (>= 1)`
- `unit_price integer not null check (>= 0)`
- `useful_life_months integer not null check (>= 1)`

The total asset value is used as the **initial capital** for the payback period calculation.

### 3.7 AI

**`ai_analyses`**
- `user_id uuid not null references profiles(id) on delete cascade`
- `model text not null`
- `snapshot_hash text not null`
- `input_snapshot jsonb not null`
- `output jsonb not null`
- Index: `(user_id, created_at)`, `(store_id, created_at desc)`

### 3.8 Security (RLS)

- RLS is enabled on all tables.
- Function `public.is_store_owner(sid uuid) returns boolean` (`security definer`, `stable`): `exists (select 1 from stores where id = sid and owner_id = auth.uid())`.
- `profiles`: select/update only `id = auth.uid()`. The `authenticated` role is only granted `grant update (full_name, locale)`, so the `plan` column cannot be changed by users.
- `stores`: all operations only `owner_id = auth.uid()`; inserts are limited by the number of stores per plan (checked in the Server Action as a friendly message, and enforced in the database by the trigger `stores_enforce_limit` that mirrors `lib/config/plans.ts`, SQLSTATE `BN001`; RLS still guarantees ownership).
- Tables with `store_id`: all operations `is_store_owner(store_id)`.
- `product_materials` and `product_channel_prices` also have `store_id` (denormalized) to keep policies simple; the **composite FK** `(x_id, store_id) → table(id, store_id)` ensures the referenced product, material, and channel come from the same store.
- `ai_analyses`: no insert/update/delete policies for users; inserts are done by the Server Action using the client secret key (`SUPABASE_SECRET_KEY`) (after verifying the session + store ownership). Select: `is_store_owner(store_id)`.
- Path to multiple members later: add `store_members`, change the body of `is_store_owner`.

### 3.9 Per-plan limits

`lib/config/plans.ts`:

| Plan | Max stores | AI analyses per day |
|---|---|---|
| free | 2 | 3 |
| pro | 10 | 20 |

The plan is changed manually through the database in v1.

The store limit is also enforced by a database trigger (`supabase/migrations/20261016000003_store_limit.sql`); the numbers must always match `lib/config/plans.ts`.

## 4. Calculation (`lib/calc`)

Validation note (Phase 2): `localeNumber` treats "." as a decimal when there is no comma. Rupiah input needs a separate integer parser that strips thousand-separator dots ("15.000" → 15000).

Pure functions, no database/network access. Input = a complete store data object (`StoreData`); output = a result object (`StoreMetrics`). Used in Server Components (dashboard) and Client Components (live product page, simulation).

### 4.1 Units

| Dimension | Base unit | Supported units |
|---|---|---|
| mass | g | g, ons (=100 g), kg (=1000 g) |
| volume | ml | ml, l (=1000 ml) |
| count | pcs | pcs, lusin (=12 pcs) |

`toBase(qty, unit)` and `sameDimension(unitA, unitB)`. Household units (sdm, sdt, gelas) are not supported in v1.

### 4.2 Formulas

Notation: `m` = material, `p` = product, `c` = channel, `D` = `operating_days_per_month`.

1. **Material cost per base unit**
   `unitCost(m) = purchase_price / (toBase(purchase_qty, purchase_unit) × (1 − waste_pct/100))`

2. **Material HPP per product unit per channel**
   Composition rows that apply to channel `c`: `channel_id is null or channel_id = c`.
   `hppBahan(p, c) = Σ_batchRows(toBase(qty, unit) × unitCost(m)) / yield_qty + Σ_unitRows(toBase(qty, unit) × unitCost(m))`
   A row whose unit is in a different dimension from its material = validation error (rejected on save; if it still exists in the data, `lib/calc` throws a structured error instead of calculating silently).

3. **Monthly fixed costs**
   Cost normalization: `harian × D`, `mingguan × 52/12`, `bulanan × 1`, `tahunan / 12`.
   `penyusutanBulanan = Σ (qty × unit_price / useful_life_months)`
   `biayaTetap = Σ normalized costs + penyusutanBulanan`

4. **Full HPP per unit**
   `totalUnit = Σ_{p,c} est_monthly_sales` (active products only)
   `overheadPerUnit = biayaTetap / totalUnit` (if `totalUnit = 0` → `null`, the UI shows "—" + a hint to fill in the sales estimate)
   `hppPenuh(p, c) = hppBahan(p, c) + overheadPerUnit`

5. **Net revenue & contribution per unit**
   `net(p, c) = price × (1 − commission_pct/100) − fixed_fee`
   `kontribusi(p, c) = net(p, c) − hppBahan(p, c)`

6. **Monthly profit**
   - `omzetKotor = Σ price × est`
   - `omzetBersih = Σ net × est`
   - `biayaBahan = Σ hppBahan × est`
   - `labaKotor = omzetBersih − biayaBahan`
   - `labaBersih = labaKotor − biayaTetap`
   - `marginBersihPct = labaBersih / omzetKotor × 100` (if revenue is 0 → `null`)

7. **Break-even point (BEP)**
   - `kontribusiRataRata = Σ(kontribusi × est) / Σ est`
   - If `Σ est = 0` → BEP `null` ("isi estimasi penjualan" ("fill in the sales estimate")).
   - If `kontribusiRataRata ≤ 0` → BEP `null` + warning "Setiap penjualan rugi" ("Every sale loses money").
   - `bepUnitBulanan = ceil(biayaTetap / kontribusiRataRata)`; `bepUnitHarian = ceil(bepUnitBulanan / D)`

8. **Payback period**
   `totalModal = Σ qty × unit_price` (assets)
   `bulanBalikModal = totalModal / labaBersih` if `labaBersih > 0`, otherwise `null`.

9. **Price recommendation per product per channel**
   `margin = (products.target_margin_pct ?? stores.target_margin_pct) / 100`
   `k = commission_pct / 100`
   If `k + margin ≥ 1` → `null` + message "Komisi + target margin ≥ 100%, tidak ada harga yang memenuhi" ("Commission + target margin ≥ 100%, no price satisfies this").
   If `hppPenuh` is `null` → use `hppBahan` and mark "belum termasuk biaya operasional" ("does not yet include operating costs").
   `hargaRekomendasi = ceilTo500((hppPenuh + fixed_fee) / (1 − k − margin))`
   Margin here = profit as a percentage of the selling price (not markup). The UI explains the difference.

### 4.3 Status & warnings (deterministic)

Per `(p, c)`:
- **red**: `kontribusi < 0`
- **yellow**: actual margin `(net − hppPenuh) / price < target` (or `hppBahan` if `hppPenuh` is null)
- **green**: actual margin ≥ target

Store warnings (`StoreMetrics.warnings`):
- `NO_OWNER_SALARY`: no cost of category `gaji_pemilik` → "Laba terlihat lebih besar karena gajimu sendiri belum dihitung." ("Profit looks bigger because your own salary has not been counted.")
- `LOSS_PRODUCTS`: there are red products
- `BELOW_TARGET`: there are yellow products
- `NEGATIVE_CONTRIBUTION`: average contribution ≤ 0
- `NO_SALES_ESTIMATE`: `Σ est = 0`
- `COMPETITOR_GAP`: `|price − competitor_price| / competitor_price > 0.25`
- `NET_LOSS`: `labaBersih < 0`

### 4.4 What-if simulation

`applyOverrides(data: StoreData, o: Overrides): StoreData`, then recalculated with the same functions.

```ts
type Overrides = {
  materialPricePct?: Record<string /* materialId | 'all' */, number>; // +50 = up 50%
  salesMultiplier?: number;                                          // 1.2 = up 20%
  prices?: Record<`${string}:${string}` /* productId:channelId */, number>;
};
```

Not saved to the database. The simulation page shows the "Sekarang" ("Now") and "Simulasi" ("Simulation") metrics side by side along with the difference. Overrides can be filled from the query string (used by the "Coba di simulasi" ("Try in simulation") button from the AI).

## 5. Flow & Pages

### 5.1 Auth & onboarding
All routes below live under the locale prefix `/{locale}` (`/id` or `/en`); paths are shown without it.

1. `/` landing: 3D hero, short explanation, "Masuk dengan Google" ("Sign in with Google") button.
2. `/login` → Supabase Google OAuth → `/auth/callback` (exchange the code for a session).
3. No store yet → `/onboarding`, a 2-step wizard:
   - store name, business type, target market (optional)
   - operating days per month, target margin (default + explanation of margin vs markup)
   - The store is created + a default cash channel named in the locale active at creation time: "Offline – Tunai" (`id`) or "Offline – Cash" (`en`). After creation it is the user's own data (not re-translated when the language changes; can be renamed). `create_store` receives the name from the app via `p_default_channel_name`. The same rule applies to later app-generated data (channel templates, sample data).
   - Alternative: a **"Coba dengan data contoh"** ("Try with sample data") button creates a demo store (coffee shop) complete with materials, packaging, products, channels (including GoFood + online-only packaging), costs (including owner salary), assets, and competitor prices. Implementation: a single seed function on the server.
4. Enter the dashboard.

### 5.2 Store pages (`/s/[storeId]/...`)

| Route | Content |
|---|---|
| `dashboard` | Cards: net profit, revenue, BEP/day, payback period. Warnings. Product chart (3D, 2D toggle). Product table with color status. **Setup checklist** while incomplete: Materials → Products → Operating costs → **"Gaji kamu sendiri"** ("Your own salary") → Inventory → Online channels (optional). |
| `bahan` | Material list + form; cost per base unit shown live. |
| `produk` | Product list + status. |
| `produk/[id]` | Composition editor (material, amount, unit, batch/unit basis, channel), live HPP per channel, price + sales estimate + competitor price per channel, comparison of your price vs recommendation vs competitor, "Pakai harga rekomendasi" ("Use recommended price") button. |
| `biaya` | Operating costs per category, monthly total. |
| `inventaris` | Assets, monthly depreciation, total capital. |
| `kanal` | Sales channels + add from template. |
| `simulasi` | Slider/input overrides, comparison of Now vs Simulation. |
| `analisis` | "Analisis usahaku" ("Analyze my business") button, latest result, history, remaining quota, privacy note. |
| `pengaturan` | Edit store data, delete store (confirm by typing the store name). |

Others: `/toko` (store list, switch, add new), `/privasi` (privacy policy).

Navigation: bottom nav on phones (Dashboard, Produk, Bahan, Lainnya), sidebar on desktop, store picker in the header.

### 5.3 Mutations & errors
- All mutations go through Server Actions; input is validated with zod; schemas return message keys, and the Server Action translates them into the active locale before returning per-field errors.
- Deleting a material used by a product is rejected (FK `restrict`) with the message "Dipakai di: <daftar produk>" ("Used in: <product list>").
- Proxy (`proxy.ts`, Next.js 16): routes `/{locale}/s/*`, `/{locale}/onboarding`, `/{locale}/toko`, `/{locale}/mulai` require a session (the locale prefix is stripped before matching); the server uses `auth.getClaims()`, not `getSession()`. A `storeId` that does not belong to the user → 404 (RLS returns empty).
- Empty state in every list: explanation + example + action button.

### 5.4 Internationalization (i18n)
- Library: `next-intl` v4 with locales `['id', 'en']`, default `id`, `localePrefix: 'always'`. All pages live in `app/[locale]/…`. Exception: `app/auth/callback` stays outside `[locale]` so the OAuth redirect URI never changes; it redirects to `next`, which already carries the locale prefix.
- `proxy.ts` refreshes the Supabase session first (refreshed cookies are written into the request so next-intl forwards them), then runs the `next-intl` middleware (locale detection, redirect `/x` → `/{locale}/x`). A next-intl redirect is returned as-is (the follow-up request is checked); otherwise auth redirects are matched on the decoded, locale-stripped path next-intl will render (its rewrite target, which has TAB/LF/CR stripped and `//` collapsed), never on the raw URL. The Supabase cookies and no-store headers are applied to whatever response is returned.
- Locale resolution for a path without a prefix: cookie `NEXT_LOCALE` → `Accept-Language` (first supported of `id`/`en`) → `id`. Unsupported browser languages fall back to `id`.
- Signed-in users: after login, if `profiles.locale` is set and differs from the URL locale, redirect to the saved locale and sync the cookie.
- Language switcher: an "ID | EN" toggle in the store header, landing, login, onboarding, and `/toko`. It navigates to the same path with the other prefix; for signed-in users a Server Action also saves `profiles.locale`.
- Messages: `messages/id.json` and `messages/en.json`, namespaced per feature (`Auth`, `Onboarding`, `Store`, `Settings`, `Landing`, `Errors`, `Validation`, ...). A unit test asserts both files have exactly the same keys. No user-facing string is hardcoded in components.
- Labels for enums (business type, target market, categories, frequencies, units) come from messages.
- Formatting: percentages and numbers use the active locale (`12,5%` in `id`, `12.5%` in `en`); currency is always Rupiah. Number input accepts both `,` and `.` as the decimal separator (as `localeNumber` does today).
- `<html lang>` follows the active locale.
- AI output (Phase 5) is generated in the user's active locale.

## 6. AI Feature

### 6.1 Flow
1. The user presses "Analisis usahaku".
2. Server Action: check session + store ownership; count the user's analyses today (00:00–24:00 Asia/Jakarta) from `ai_analyses`; reject if ≥ the plan limit. Note: counting from `ai_analyses` also resets when a store is deleted (cascade). Phase 5 must count usage independently of store deletion (e.g. a usage ledger per `user_id`, or a nullable `store_id` with `on delete set null`).
3. `buildSnapshot(storeData, metrics)` → compact JSON: store info (including `target_market`), per product per channel (hppBahan, hppPenuh, price, competitor, net, contribution, margin, status, est), totals (revenue, profit, fixed costs per category, depreciation), BEP, payback period, `warnings`.
4. `snapshot_hash = sha256(canonicalJSON(snapshot))`. If it equals this store's latest analysis → return the old result, do not call the AI, do not deduct quota.
5. `lib/ai/analyze.ts` calls Gemini with structured output (response JSON schema), 30-second timeout.
6. Validate the output with zod. Failure/timeout/invalid → error "Analisis gagal, coba lagi" ("Analysis failed, try again"), not saved, quota not deducted.
7. Save to `ai_analyses`, display.

### 6.2 Output schema

```ts
{
  summary: string;                       // 2–4 sentences
  highlights: string[];                  // things that are already good
  issues: {
    title: string;
    explanation: string;
    related_product_ids: string[];
    priority: 'tinggi' | 'sedang' | 'rendah';
  }[];
  recommendations: {
    action: string;
    reason: string;
    simulation?:
      | { type: 'change_price'; product_id: string; channel_id: string; new_price: number }
      | { type: 'change_material_price'; material_id: string; pct: number }
      | { type: 'change_sales_volume'; multiplier: number };
  }[];
}
```

Referenced IDs are validated against the snapshot; a recommendation with an unknown ID loses its `simulation` (the text is still shown). `simulation` is mapped to `Overrides` (§4.4) and opened through the **"Coba di simulasi"** button.

### 6.3 Prompt rules
- Only quote numbers that exist in the snapshot; creating new numbers is forbidden. The impact of figures is calculated by `lib/calc` through simulation.
- Simple language in the user's active locale (Indonesian or English), no accounting jargon.
- Must address the warnings in `warnings`, especially `NO_OWNER_SALARY` and `LOSS_PRODUCTS`.
- Uses `competitor_price` and `target_market` as context for price advice.

### 6.4 Configuration & privacy
- Env: `GEMINI_API_KEY`, `GEMINI_MODEL`.
- All Gemini access only on the server (`lib/ai`, `server-only`).
- The analysis page and `/privasi` state that store data is sent to Google Gemini for analysis.

## 7. 3D Visuals

- Library: vanilla `three`, wrapped in a Client Component that creates/removes the renderer in `useEffect`; loaded with `next/dynamic` `{ ssr: false }`.
- Locations:
  - Landing: interactive 3D hero.
  - Dashboard: 3D product chart (profit/contribution bars per product) with **number labels**; 3D/2D toggle; the choice is saved in `localStorage` (try/catch).
  - Moments: animation when onboarding finishes and when net profit first becomes > 0.
  - Empty state: lightweight 3D illustration.
- Fallback to 2D/static if: `prefers-reduced-motion: reduce`, WebGL is unavailable, or the device is weak (`navigator.hardwareConcurrency ≤ 4` or `deviceMemory ≤ 4` when available).
- Renderer: `pixelRatio` capped at ≤ 2; the render loop stops when the canvas is not visible (IntersectionObserver) or the tab is hidden; geometry/materials are disposed on unmount.
- Form pages (materials, products, costs, inventory, channels) do not load Three.js.

## 8. Code Structure

```
app/
  auth/callback/route.ts          (outside [locale]: stable OAuth redirect URI)
  [locale]/
    page.tsx                      landing
    privasi/page.tsx
    login/page.tsx
    onboarding/page.tsx
    toko/page.tsx
    mulai/page.tsx
    s/[storeId]/
    layout.tsx                    nav + store picker + load StoreData
      dashboard/ bahan/ produk/ produk/[id]/ biaya/ inventaris/ kanal/ simulasi/ analisis/ pengaturan/
i18n/          routing.ts request.ts navigation.ts
messages/      id.json en.json
lib/
  calc/        units.ts materials.ts products.ts expenses.ts assets.ts metrics.ts pricing.ts warnings.ts overrides.ts index.ts
  ai/          analyze.ts schema.ts snapshot.ts prompt.ts
  supabase/    server.ts client.ts proxy.ts
  i18n/        paths.ts translate.ts server.ts saved-locale.ts save-locale.ts
  data/        load-store-data.ts (query Supabase → StoreData)
  validation/  zod schema per entity
  config/      plans.ts channel-templates.ts
  seed/        demo-store.ts
components/
  ui/          (shadcn)
  three/       HeroScene.tsx ProfitChart3D.tsx Celebration.tsx useWebGLSupport.ts
  ...
supabase/
  migrations/
tests/
  unit/ rls/ e2e/
proxy.ts                         (Next.js 16: replaces middleware.ts)
```

## 9. Testing

- **`lib/calc`** (most critical): table-driven unit tests with manually calculated examples, covering: unit conversion; materials with waste; batch vs unit composition; channel-specific packaging; frequency normalization; depreciation; overhead with `totalUnit = 0`; profit; BEP (normal, `Σ est = 0`, contribution ≤ 0); payback period (profit ≤ 0); price recommendation (normal, product margin override, `k + margin ≥ 1`, Rp500 rounding); every warning code; overrides.
- **RLS**: integration tests against local Supabase — user A cannot select/insert/update/delete user B's store data in every table; a user cannot change `plan`.
- **Validation**: zod schema tests for each entity (including mismatched unit dimension).
- **AI**: Gemini is mocked; tests for `buildSnapshot`, stable hash, cache hit, quota (including the WIB day boundary), valid output, broken output, unknown IDs.
- **i18n**: unit test for message key parity; e2e for `Accept-Language: en` → `/en`, unsupported language → `/id`, the switcher changing text and path, the saved choice surviving sign-out/sign-in, `/en/s/...` staying protected, and the default channel name following the locale at creation. Existing e2e tests run in `id` (Playwright locale `id-ID`).
- **E2E (Playwright)**: onboarding → add material → add product + price → dashboard shows profit. E2E/dev login uses email/password through the "Masuk (dev)" ("Sign in (dev)") form, which only appears if `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` (local only).

## 10. Implementation Phases

Every phase can be deployed. One implementation plan per phase.

1. **Foundation**: scaffold Next.js, Tailwind, shadcn; database schema + RLS + profile trigger; Google login; middleware; onboarding (without sample data); `/toko`; layout + navigation.
1b. **i18n**: `next-intl`, `app/[locale]` routing, message catalogs (id + en), language switcher, `profiles.locale`, localized validation and formatting, English README/spec.
2. **HPP core**: `lib/calc` (TDD); materials page, products + composition, operating costs, inventory; 2D dashboard (cards, warnings, table, checklist).
3. **Channels & pricing**: channels + templates; price/estimate/competitor per channel; channel-specific packaging; price recommendation.
4. **What-if simulation**.
5. **AI analysis**: `lib/ai`, quota, cache, history, "Coba di simulasi".
6. **3D visuals**: install threejs-skills; landing hero; 3D chart + toggle; moment animations; 3D empty state; fallback.
7. **Finishing**: sample data, privacy page, polish, production deploy.

## 11. Manual Setup (done by the project owner)

- Create a Supabase project (production) and note the URL + publishable key + secret key.
- Create an OAuth Client in Google Cloud Console; redirect URI to the Supabase callback; enable the Google provider in Supabase Auth; add the Vercel URL to the Supabase Redirect URLs.
- Create a Gemini API key in Google AI Studio.
- Set env in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `GEMINI_API_KEY`, `GEMINI_MODEL`. Never set `NEXT_PUBLIC_ENABLE_DEV_LOGIN` in Vercel.
- In Supabase production: disable the Email provider (Google only).
- Local dev: Docker + Supabase CLI (`supabase start`).

## 12. Out of Scope for v1

- Recording actual sales & purchases (phase 2)
- Multiple store members & roles
- Payment gateway / Pro subscription
- Service businesses & resellers as a dedicated product type
- Household units (sdm, sdt, gelas)
- PDF/Excel export
- Native mobile app
