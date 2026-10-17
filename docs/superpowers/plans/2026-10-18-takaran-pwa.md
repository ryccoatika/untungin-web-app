# Household Units and Installable App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Let sellers write recipes in the household measures they actually use: sdm (tablespoon), sdt (teaspoon) and gelas (glass).
- Make Untungin installable on a phone's home screen, with an offline page.

**Architecture:**
- **Household units are recipe-only units.** Purchases stay in g/ons/kg/ml/l/pcs/lusin; `UNITS` is unchanged.
  - A new `RECIPE_UNITS` adds sdm (15 ml), sdt (5 ml) and gelas (250 ml).
  - For materials bought by volume, they convert directly.
  - For materials bought by weight, they convert through a new optional per-material value, "berat 1 sdm" (`grams_per_sdm`). A teaspoon is ⅓ of it and a glass is 250⁄15 of it.
  - Count materials (pcs/lusin) cannot use household units.
- **PWA:**
  - A completed manifest (id, scope, start URL, maskable icon) and iOS meta.
  - A tiny hand-written service worker. It caches only `offline.html` and the icons, and falls back to `offline.html` when a page navigation fails. Store data and auth are never cached.
  - An "install the app" entry on the Lainnya page.

**Tech Stack:** Next.js 16.4, Supabase (Postgres check constraints), zod 4, next-intl 4, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-untungin-design.md` — §4.1 (units), §12 (household units was out of scope for v1; now in), §5.2 (Lainnya page). The user skipped design questions; the calls below are the controller's, stated to the user.

**Base branch:** `feat/takaran-pwa` from `master` (d7de15e, all phases merged).

## Global Constraints

- Read `AGENTS.md` (Next.js 16.4). Code comments, README and docs in English. Every user-facing string comes from `messages/id.json` and `messages/en.json` with identical keys, edited as text.
- `lib/calc` stays pure (no next/react/supabase imports). Every quantity the calc converts must be finite; an impossible conversion is a `CalcError`, never NaN.
- Existing data keeps working unchanged: no migration may alter existing rows' values.
- Migrations: `npx supabase migration up --local` (never `db:reset`), then `npm run db:types`. New constraints are written so `supabase db push` works on a fresh database.
- The service worker never caches HTML pages, API responses, Supabase requests or anything user-specific. It caches only `offline.html` and the icons. It is registered only in production builds.
- Mobile first: tap targets ≥ 40px, no horizontal scroll at 360px, light and dark mode.
- Tests: `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, `npm run build`, and e2e against a production build (`npx next start -p 3100` in the background capturing its PID; stop only that PID; never touch port 3000; never read `.env.local`; never click "Analisis usahaku").
- Commit messages are conventional and end with the Co-Authored-By trailer of the committing agent's harness.

## Review Focus

1. **A weight material used with sdm loses its "berat 1 sdm"** (cleared on edit), or its unit changes to pcs. The edit must be refused with a clear message instead of breaking the product's cost. — Tests in Task 1 (validation) and Task 2 (e2e).
2. **A recipe uses sdm on a weight material that never had a spoon weight** (legacy, or data edited elsewhere). The product page and dashboard show the existing "fix this product" error, never NaN. — Unit test in Task 1.
3. **Decimal spoon amounts** ("1,5 sdm", "0,5 gelas") cost exactly what grams/ml would. — Unit tests in Task 1.
4. **Offline:** a page the user never visited, or any navigation while offline, shows the offline page in their language. Coming back online and reloading works normally; no stale signed-in page is ever served from cache. — e2e in Task 3.
5. **Installing on iPhone** (no install prompt there) still shows how to add the app to the home screen; on a device where the app is already installed, the install entry is hidden. — e2e/unit in Task 3.

## Rulings (controller's calls)

- **Volumes:** sdm = 15 ml, sdt = 5 ml, gelas = 250 ml (common Indonesian kitchen measures).
- **Weight materials:** one optional number per material, "Berat 1 sdm (gram)", accepting 0 < value ≤ 1000 with decimals ("12,5"). The form hint gives examples: gula pasir ± 12 g, tepung terigu ± 8 g, garam ± 18 g. Count materials never use household units.
- **Units by material:**
  - The composition editor offers sdm/sdt/gelas for volume materials and for weight materials.
  - A weight material without a spoon weight gets a clear validation message pointing to the Bahan page; the option stays visible so sellers learn it exists.
- **PWA start URL:** `/mulai`. Signed in, it goes straight to the store; signed out, the existing redirect sends you to login. Scope `/`, display `standalone`, theme `#047857`.
- **Offline page:** one static bilingual `public/offline.html`. It shows Indonesian by default and English when the browser's language starts with `en`. It doesn't depend on the app's JS or cookies.
- **Install entry:** a "Pasang aplikasi" card on the Lainnya page.
  - Chromium: a button using `beforeinstallprompt`.
  - iOS Safari: short instructions (Bagikan → Tambah ke Layar Utama).
  - Hidden when running standalone.

---

### Task 1: Household units in the data model and calc

**Files:**
- Create: `supabase/migrations/20261018000003_household_units.sql`
- Modify: `lib/calc/units.ts`, `lib/calc/types.ts`, `lib/calc/products.ts`, `lib/calc/index.ts` (exports), `lib/data/store-data.ts`, `lib/validation/material.ts`, `lib/validation/composition.ts`, `app/[locale]/s/[storeId]/produk/actions.ts`, `app/[locale]/s/[storeId]/bahan/actions.ts`, `lib/supabase/database.types.ts`
- Test: `tests/unit/calc/units.test.ts` (or the existing calc test files), `tests/unit/entity-validation.test.ts`, `tests/rls/domain.test.ts` (or a new `tests/rls/household.test.ts`)

**Interfaces:**
- Produces:
  - `HOUSEHOLD_UNITS = ["sdm", "sdt", "gelas"] as const`, `type HouseholdUnit`, `RECIPE_UNITS = [...UNITS, ...HOUSEHOLD_UNITS] as const`, `type RecipeUnit`
  - `ML_PER_HOUSEHOLD: Record<HouseholdUnit, number> = { sdm: 15, sdt: 5, gelas: 250 }`
  - `isHouseholdUnit(u): u is HouseholdUnit`, `isRecipeUnit(value: string): value is RecipeUnit`
  - `recipeUnitsFor(material: { purchaseUnit: Unit }): RecipeUnit[]` (same-dimension units, plus household units for mass/volume)
  - `recipeQtyInBase(qty: number, unit: RecipeUnit, material: { purchaseUnit: Unit; gramsPerSdm?: number | null }): number` — throws `CalcError` (see below) when impossible
  - `CalcMaterial.gramsPerSdm?: number | null`; `CalcCompositionRow.unit: RecipeUnit`
  - `CalcErrorCode` gains `"SPOON_WEIGHT_MISSING"`
  - `compositionUnitError(material: { purchaseUnit: Unit; gramsPerSdm: number | null }, unit: RecipeUnit): string | null` → `"composition.unitDimension"` | `"composition.spoonWeightMissing"` | null
  - material schema: `gramsPerSdm` optional (blank → null), `localeNumber`, > 0, ≤ 1000; new keys `material.spoonWeightNumber`, `material.spoonWeightRange`, `material.spoonWeightInUse`

- [ ] **Step 1: Migration (and RED RLS/DB test)**

Write the test first in `tests/rls/household.test.ts`. As a signed-in owner (`createTestUser`, `createStore`):
- insert a weight material with `grams_per_sdm: 12.5` → OK;
- insert `grams_per_sdm: 0` and `2000` → constraint error;
- insert a composition row with `unit: "sdm"` → OK; with `unit: "sendok"` → constraint error.

Run `npm run test:rls -- tests/rls/household.test.ts` → FAIL.

Create `supabase/migrations/20261018000003_household_units.sql`:

```sql
-- Household recipe units (sdm, sdt, gelas). Purchases keep their units; only recipes gain these.
-- Weight materials need their spoon weight to convert: grams in one level tablespoon.
alter table public.materials
  add column grams_per_sdm numeric check (grams_per_sdm > 0 and grams_per_sdm <= 1000);

alter table public.product_materials drop constraint product_materials_unit_check;
alter table public.product_materials add constraint product_materials_unit_check
  check (unit in ('g', 'ons', 'kg', 'ml', 'l', 'pcs', 'lusin', 'sdm', 'sdt', 'gelas'));
```

Verify the existing constraint name first:

```
docker exec supabase_db_untungin psql -U postgres -tAc "select conname from pg_constraint where conrelid='public.product_materials'::regclass and contype='c'"
```

Use the real name. Apply it (`npx supabase migration up --local`), regenerate types and run the test → PASS. New columns on `materials` inherit the table grants, so no grant change is needed; confirm with `npm run test:rls`.

- [ ] **Step 2: Calc (TDD)**

Unit tests (put them in the existing calc units/products test files):
- `recipeQtyInBase`:
  - `(2, "sdm", { purchaseUnit: "l" })` → 30 (ml).
  - `(1, "gelas", { purchaseUnit: "ml" })` → 250.
  - `(1.5, "sdt", { purchaseUnit: "l" })` → 7.5.
  - `(2, "sdm", { purchaseUnit: "kg", gramsPerSdm: 12 })` → 24 (g).
  - `(3, "sdt", { purchaseUnit: "g", gramsPerSdm: 12 })` → 12.
  - `(1, "gelas", { purchaseUnit: "kg", gramsPerSdm: 12 })` → 200, because 250⁄15 × 12 = 200.
  - `(1, "sdm", { purchaseUnit: "kg" })` → throws a `CalcError` with code `SPOON_WEIGHT_MISSING`.
  - `(1, "sdm", { purchaseUnit: "pcs" })` → throws `UNIT_DIMENSION_MISMATCH`.
  - Every existing unit is unchanged: `(200, "g", { purchaseUnit: "kg" })` → 200.
  - `(1, "kg", { purchaseUnit: "l" })` → throws `UNIT_DIMENSION_MISMATCH`.
- `recipeUnitsFor`:
  - kg → [g, ons, kg, sdm, sdt, gelas]
  - l → [ml, l, sdm, sdt, gelas]
  - pcs → [pcs, lusin]
- `materialCostPerUnit` / `analyzeStore`: a product using "2 sdm" of gula (1 kg Rp15.000, gramsPerSdm 12) costs the same as "24 g".

Implement in `lib/calc/units.ts`. Add the household constants and helpers, and make `recipeQtyInBase` the single conversion used by `products.ts`. It replaces the `sameDimension` + `toBase` pair there. `CalcError` is thrown with the product id and material id as today; the conversion helper gets a small wrapper in `products.ts` that adds those ids. `CalcMaterial.gramsPerSdm` is optional, so existing fixtures still compile.

- [ ] **Step 3: Loader, validation, actions (TDD for validation)**

- `lib/data/store-data.ts`: map `grams_per_sdm` to `gramsPerSdm: row.grams_per_sdm === null ? null : Number(row.grams_per_sdm)`. Use `isRecipeUnit` for composition rows; add a `recipeUnit()` guard like the existing `unit()`.
- `lib/validation/material.ts`: add `gramsPerSdm` (blank → null, `localeNumber`, > 0, ≤ 1000) with the new keys. Map it to the `grams_per_sdm` column in the existing column mapper.
- `lib/validation/composition.ts`: the unit enum uses `RECIPE_UNITS`, and `compositionUnitError(material, unit)` follows the interface above. Update `produk/actions.ts` `rowErrors` to select `purchase_unit, grams_per_sdm` and pass both.
- `bahan/actions.ts`: the existing "unit in use" guard (changing a material's dimension while recipes use it) must also refuse two more cases, with `material.spoonWeightInUse` ("Bahan ini dipakai dengan sdm/sdt/gelas di resep. Isi berat 1 sdm atau ubah resepnya dulu."):
  - clearing `grams_per_sdm` on a weight material whose rows use household units;
  - changing the material to a count unit while rows use household units.
- Tests in `tests/unit/entity-validation.test.ts`:
  - spoon weight blank → null, "12,5" → 12.5, "0" and "1001" → range key, "abc" → number key;
  - `compositionUnitError` returns the right key for each case above.

Add the new validation keys to both message files under `Validation` with Indonesian and English text.

- [ ] **Step 4: Verify and commit**

`npm test`, `npm run typecheck` (paste exit status), `npm run lint`, `npm run test:rls`, `npm run build`, and the FULL e2e suite (nothing user-facing changed yet, but the loader and actions did).

```bash
git add supabase/migrations lib tests "app/[locale]/s/[storeId]/produk/actions.ts" "app/[locale]/s/[storeId]/bahan/actions.ts" messages
git commit -m "feat(calc): household recipe units (sdm, sdt, gelas) with per-material spoon weight"
```

---

### Task 2: Household units in the forms

**Files:**
- Modify: `app/[locale]/s/[storeId]/bahan/material-form.tsx`, `app/[locale]/s/[storeId]/produk/[productId]/composition-editor.tsx`, `messages/id.json`, `messages/en.json`, `docs/superpowers/specs/2026-10-16-untungin-design.md`
- Test: `tests/e2e/household.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`recipeUnitsFor`, `RECIPE_UNITS`, `gramsPerSdm`, validation keys).

- [ ] **Step 1: Messages**

- `UnitShort` and the long unit labels (wherever `tUnits(unit)` reads from; check the namespace) gain:
  - `sdm`: "sdm" / "tbsp"
  - `sdt`: "sdt" / "tsp"
  - `gelas`: "gelas" / "glass"
- Long labels where a long form exists:
  - "sdm (sendok makan, 15 ml)" / "tbsp (tablespoon, 15 ml)"
  - "sdt (sendok teh, 5 ml)" / "tsp (teaspoon, 5 ml)"
  - "gelas (250 ml)" / "glass (250 ml)"
- Materials namespace:
  - `spoonWeight`: "Berat 1 sdm (gram)" / "Weight of 1 tbsp (grams)"
  - `spoonWeightHint`: "Isi kalau resep memakai sdm, sdt, atau gelas. Contoh: gula pasir ± 12 g, tepung terigu ± 8 g, garam ± 18 g." / "Fill this in if recipes use tbsp, tsp or glasses. For example: sugar ± 12 g, flour ± 8 g, salt ± 18 g."
  - `spoonWeightShown`: "1 sdm = {grams} g" / "1 tbsp = {grams} g", for the material list if it shows details.

- [ ] **Step 2: Material form**

Add the field below "Jumlah beli / Satuan":
- `id="material-spoon-weight"`, `name="gramsPerSdm"`, `inputMode="decimal"`, placeholder "12".
- Shown only while the selected purchase unit is a weight unit (g/ons/kg). Use the form's existing state for the unit select, or a small controlled state.
- When hidden, keep the existing value in a hidden input, so switching units back and forth doesn't lose it. The server ignores it for non-weight units.

Edit forms prefill it from the material, and echoed values survive validation errors.

- [ ] **Step 3: Composition editor**

Replace `unitsOf(dimensionOf(material.purchaseUnit))` with `recipeUnitsFor(material)`. The select shows household units with their long labels. The live cost preview must use `recipeQtyInBase`; where the preview currently computes with `toBase`, switch it over.

When it would throw `SPOON_WEIGHT_MISSING`, show the validation message from Task 1 inline instead of a cost, with a link to the Bahan page:
- id: "Isi dulu berat 1 sdm untuk {material} di halaman Bahan."
- en: "First fill in the weight of 1 tbsp for {material} on the Materials page."

- [ ] **Step 4: Sample store unchanged**

Leave `lib/seed/demo-store.ts` as it is, so the sample store's numbers and tests stay stable.

- [ ] **Step 5: e2e**

Create `tests/e2e/household.spec.ts` using the helpers (`signIn`, `createStoreViaOnboarding`, `addMaterial`, `addProduct`, `addCompositionRow`, `setPrice`, `storeUrl`). Check the helpers' parameters for unit selection and, if needed, extend `addCompositionRow` to accept any `RecipeUnit`.

1. **Volume material:** "Susu" 1 l Rp18.000. Product "Kopi susu" (yield 1) with "10 sdm" of Susu. The row cost shows Rp2.700 (150 ml × Rp18/ml).
2. **Weight material without spoon weight:** "Gula" 1 kg Rp15.000. Adding "2 sdm" Gula shows the "Isi dulu berat 1 sdm untuk Gula…" message. Set "Berat 1 sdm" to 12 on the Bahan page; adding "2 sdm" now costs Rp360 (24 g × Rp15).
3. **Guard:** clearing Gula's spoon weight while a recipe uses sdm is refused with "Bahan ini dipakai dengan sdm/sdt/gelas di resep…".
4. **360px:** the material form with the spoon field has no horizontal overflow.

- [ ] **Step 6: Spec update**

In the spec:
- §4.1 Units: add one paragraph on recipe-only household units, with the volumes and the spoon-weight conversion.
- §12: remove "Household units (sdm, sdt, gelas)".
- §10: add a "Post-v1 notes" line.

- [ ] **Step 7: Verify and commit**

Run unit, typecheck, lint, test:rls and build. Then run e2e `tests/e2e/household.spec.ts tests/e2e/materials.spec.ts tests/e2e/composition.spec.ts`, and then the full suite. Screenshot the material form (weight unit, 360, light and dark) and the composition editor with an sdm row, and look at them.

```bash
git add "app/[locale]/s/[storeId]" messages docs/superpowers/specs tests/e2e
git commit -m "feat(recipes): sdm, sdt and gelas in recipes; spoon weight on materials"
```

---

### Task 3: Installable app (PWA) with an offline page

**Files:**
- Create: `public/sw.js`, `public/offline.html`, `public/icon-maskable-512.png`, `components/pwa/register-service-worker.tsx`, `components/pwa/install-card.tsx`, `tests/e2e/pwa.spec.ts`, `tests/unit/pwa.test.ts`
- Modify: `app/manifest.ts`, `app/[locale]/layout.tsx` (or the root layout that holds `metadata`), `app/[locale]/s/[storeId]/lainnya/page.tsx`, `next.config.ts`, `messages/id.json`, `messages/en.json`, `README.md`

**Interfaces:**
- Produces: `installHint(ua: string, standalone: boolean): "prompt" | "ios" | "hidden"` in `lib/pwa.ts` (pure, unit-tested); `<RegisterServiceWorker />`; `<InstallCard />`.

- [ ] **Step 1: Maskable icon**

Create `public/icon-maskable-512.png`: the existing icon centred on the brand green `#047857` with about 20% safe padding, at 512×512. On macOS use `sips`; there are no new dependencies. For example, scale `public/icon-512.png` to 320×320 into a temp file, then pad to 512×512 with `--padColor 047857`. Look at the result. The logo must sit fully inside the inner 80% circle.

- [ ] **Step 2: Manifest and iOS meta**

`app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Untungin",
    short_name: "Untungin",
    description: "Hitung HPP, harga jual, laba, dan balik modal usahamu.",
    start_url: "/mulai",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#047857",
    lang: "id",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

In the layout's `metadata`, add `appleWebApp: { capable: true, title: "Untungin", statusBarStyle: "default" }`. In `viewport`, add `themeColor` if it's not already set. Check the current layout for an existing `viewport` export and extend it.

- [ ] **Step 3: Service worker and offline page**

`public/offline.html`:
- self-contained, with inline CSS, light and dark via `prefers-color-scheme`, and no external requests;
- content: the logo (inline SVG copied from `app/icon.svg`) and the headline "Kamu sedang offline" / "You're offline";
- body: "Untungin butuh internet untuk menghitung dan menyimpan datamu. Sambungkan lagi lalu coba muat ulang." / "Untungin needs the internet to calculate and save your data. Reconnect, then try again.";
- a "Muat ulang" / "Try again" button running `location.reload()`;
- a 5-line inline script picks English when `navigator.language` starts with "en", by toggling `hidden` on two blocks;
- tap target at least 40px; no horizontal scroll at 360px.

`public/sw.js`:

```js
// Untungin service worker: offline fallback only. It never caches pages, API responses or user data.
const CACHE = "untungin-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else goes straight to the network
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
});
```

`next.config.ts`: add headers for `/sw.js`:
- `Cache-Control: no-cache, no-store, must-revalidate`;
- `Content-Type: application/javascript; charset=utf-8`;
- `Service-Worker-Allowed: /`.

Keep the existing config. The proxy matcher already skips paths with a dot (`.*\\..*`); confirm `/sw.js` and `/offline.html` are served signed out.

`components/pwa/register-service-worker.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/** Registers the offline-fallback service worker in production builds only. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
```

Render it once in the root/locale layout body.

- [ ] **Step 4: Install card (TDD for the pure helper)**

Write `tests/unit/pwa.test.ts` first:
- `installHint(<iPhone Safari UA>, false)` → "ios"
- `installHint(<iPad Safari UA>, false)` → "ios"
- `installHint(<Android Chrome UA>, false)` → "prompt"
- `installHint(<desktop Chrome UA>, false)` → "prompt"
- `installHint(<any UA>, true)` → "hidden"
- `installHint(<iPhone Chrome "CriOS" UA>, false)` → "ios" (on iOS every browser installs through Share)

Implement `lib/pwa.ts`.

`components/pwa/install-card.tsx` (client):
- **Standalone check:** `matchMedia("(display-mode: standalone)")` or `navigator.standalone`; when true, render nothing.
- **"prompt" (Chromium):**
  - listen for `beforeinstallprompt`, `preventDefault()` and keep the event;
  - show a "Pasang aplikasi" button that calls `prompt()`;
  - before the event arrives, show the card with the button disabled and a hint "Buka lewat Chrome untuk memasang";
  - after `appinstalled`, hide the card.
- **"ios":** show steps with the share icon: "Ketuk tombol Bagikan, lalu pilih Tambah ke Layar Utama."

Messages go in a new `Install` namespace, id and en:
- title: "Pasang Untungin di HP" / "Install Untungin on your phone"
- body: "Buka seperti aplikasi, langsung dari layar utama." / "Open it like an app, straight from your home screen."
- button: "Pasang aplikasi" / "Install app"
- iOS steps: as above, in both languages.
- unsupported hint: as above, in both languages.

Render `<InstallCard />` at the top of the Lainnya page.

- [ ] **Step 5: e2e**

`tests/e2e/pwa.spec.ts`:
- `GET /manifest.webmanifest`: JSON with `start_url` "/mulai", `display` "standalone", and a `maskable` icon.
- `GET /sw.js` and `GET /offline.html`: 200 signed out; sw.js has a no-cache header.
- **Offline fallback:** visit `/` and wait for `navigator.serviceWorker.ready`, then `context.setOffline(true)`. `page.goto("/s/xyz/dashboard")` (or any route) shows "Kamu sedang offline". Then `setOffline(false)` and reload: the real page comes back (login redirect or landing).
- **Lainnya:** signed in on the mobile project, the "Pasang Untungin di HP" card is visible. With the emulated display-mode standalone, use `page.emulateMedia` if supported, or inject `matchMedia` via `addInitScript`; the card is hidden.

The service worker only registers in production, and e2e runs `next start`, so this works.

- [ ] **Step 6: README**

Add a short "Install on a phone" note describing what the service worker does and does not cache.

- [ ] **Step 7: Verify and commit**

Run unit, typecheck, lint, build, then e2e `tests/e2e/pwa.spec.ts`, then the full suite. Chrome DevTools-style check: run Lighthouse's installability criteria with Playwright if practical; otherwise verify the manifest fields and service-worker registration in e2e. Screenshot `offline.html` at 360 in light and dark, and the Lainnya install card; look at them.

```bash
git add public app components lib/pwa.ts next.config.ts messages tests README.md
git commit -m "feat(pwa): installable app with an offline page"
```
