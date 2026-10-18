# Sales & Purchase Records ("Catat") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sellers record daily sales (counts per product per channel) and purchases (which update material prices), and a monthly report answers "did I actually make a profit this month?".

**Architecture:** Three new tables (`sales_days`, `sales_lines`, `purchases`) under the existing RLS pattern, written only through `security invoker` Postgres functions so each save is atomic. Each sales line stores a snapshot (price, net per unit, HPP per unit) taken from `analyzeStore` at save time; the monthly report is a pure function in `lib/records` over those snapshots plus the current fixed costs, prorated over the recording window. Pages: `catat` (Penjualan / Belanja tabs) and `laporan`, plus a dashboard card.

**Tech Stack:** Next.js 16.4 App Router, React 19, Supabase (Postgres 17, RLS), next-intl 4, zod 4, Tailwind 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-catatan-penjualan-design.md` (extends `docs/superpowers/specs/2026-10-16-untungin-design.md`). Read both.

## Global Constraints

- Read `AGENTS.md`: Next.js 16.4, `params`/`searchParams` are Promises; Server Actions with `useActionState`; shadcn on Base UI (no `asChild`, use `render`).
- Every user-facing string lives in `messages/id.json` and `messages/en.json` with identical keys, edited as text (never re-serialise the files). Indonesian is the default; code, comments and docs in English.
- The server uses `getClaims()` (via `requireUser`), never `getSession()`. User data is read and written only with the user's RLS client. A foreign or invalid `storeId` gives 404 (`isUuid` + RLS).
- Numbers come from `lib/calc` (`analyzeStore` / `tryAnalyzeStore`); never re-derive HPP, net price or fixed costs. Money uses `formatRupiah`; dates use the Asia/Jakarta day.
- Migrations: new file under `supabase/migrations/`, applied with `npx supabase migration up --local` (never `db:reset`), then `npm run db:types`. New tables repeat the least-privilege pattern (`20261018000001_least_privilege.sql`, `20261018000002_explicit_app_grants.sql`): revoke all from anon; revoke truncate, trigger, references from authenticated; grant select, insert, update, delete to authenticated; functions `revoke execute … from public, anon` and `grant execute … to authenticated`.
- Mobile first: tap targets ≥ 40px, no horizontal scroll at 360px, light and dark mode.
- No new dependencies.
- Tests: `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, `npm run build`, e2e on a production build (`npx next start -p 3100` in the background, capture its PID, stop only that PID; never port 3000; never kill by name or pattern; never read `.env.local`; never click "Analisis usahaku"; never modify the owner's account ryccoatika@gmail.com).
- Commit messages are conventional and end with the committing agent's Co-Authored-By trailer.

## Review Focus

- **A day recorded long ago or by mistake far back** — earliest recordable date is today − `MAX_BACKFILL_DAYS` (92); the database refuses older or future dates, and the entry banner lists missing days from the last 31 days only (Task 1, Task 3 tests).
- **Saving a day while the setup has a calc error** (e.g. a weight material without spoon weight used in sdm) — save is refused with the CalcError message, nothing half-saved (Task 3 test).
- **Editing an old day after a product was deleted** — its line survives, is listed read-only and still counts (Task 1 RLS test, Task 3 e2e).
- **Two purchases of the same material on the same date, or a back-dated receipt** — only the latest by (date, saved_at) changes the price (Task 1 RLS test, Task 4 e2e).
- **A month where the store started recording mid-month, viewed during and after that month** — fixed costs and plan prorated from the first recorded day (Task 2 unit tests).

---

### Task 1: Database tables, save functions and RLS tests

**Files:**
- Create: `supabase/migrations/20261018000004_sales_records.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated with `npm run db:types`)
- Test: `tests/rls/records.test.ts`

**Interfaces:**
- Produces tables:
  - `sales_days(id uuid pk, store_id uuid → stores cascade, date date, closed boolean default false, created_at, updated_at)`, unique (`store_id`, `date`), unique (`id`, `store_id`).
  - `sales_lines(id uuid pk, store_id, day_id → sales_days(id, store_id) cascade, product_id uuid null, channel_id uuid null, product_name text 1–80, channel_name text 1–80, qty integer > 0 and ≤ 9999, unit_price integer ≥ 0, net_unit numeric, hpp_unit numeric ≥ 0, created_at, updated_at)`; composite FKs `(product_id, store_id) → products` and `(channel_id, store_id) → sales_channels` with `on delete set null (product_id)` / `(channel_id)`; unique (`day_id`, `product_id`, `channel_id`).
  - `purchases(id uuid pk, store_id, material_id uuid null, material_name text 1–80, date date, qty numeric > 0, unit text in ('g','ons','kg','ml','l','pcs','lusin'), total_paid integer ≥ 0, saved_at timestamptz, created_at)`; FK `(material_id, store_id) → materials on delete set null (material_id)`; index (`store_id`, `date`), index (`material_id`, `date`).
  - RLS on all three through `public.is_store_owner(store_id)` (select/insert/update/delete policies, same as the domain tables), grants per Global Constraints.
- Produces functions (all `language plpgsql security invoker set search_path = ''`, raise `42501` when `auth.uid()` is null):
  - `public.save_sales_day(p_store_id uuid, p_date date, p_lines jsonb) returns void`. `p_lines` is an array of `{product_id, channel_id, product_name, channel_name, qty, unit_price, net_unit, hpp_unit}`. Upserts the day with `closed = false`; for each element with `qty = 0` deletes that (day, product, channel) line; with `qty > 0` upserts it, updating the snapshot columns **only when qty changed**; lines not mentioned are untouched. If the day ends with no lines, the day row is deleted.
  - `public.close_sales_day(p_store_id uuid, p_date date) returns void`: upserts the day with `closed = true` and deletes all its lines.
  - `public.delete_sales_line(p_line_id uuid) returns void`: deletes the line; deletes its day when no lines remain and it is not closed.
  - `public.save_purchase(p_store_id uuid, p_purchase_id uuid, p_material_id uuid, p_date date, p_qty numeric, p_unit text, p_total_paid integer, p_new_price integer) returns boolean`: inserts (`p_purchase_id` null) or updates the purchase, sets `saved_at = now()` and `material_name` from the material; then, if no other purchase of that material has a later `(date, saved_at)`, sets `materials.purchase_price = p_new_price` and returns true; otherwise returns false.
  - The three sales functions and `save_purchase` raise errcode `UT002` when `p_date` is after `(now() at time zone 'Asia/Jakarta')::date` or before it minus 92 days.

- [ ] **Step 1: Write the failing RLS tests** in `tests/rls/records.test.ts` (use `createTestUser`, `createStore` from `tests/rls/helpers.ts`; build a store with one product, the default channel, a price row and one material via the owner client):
  - `owner saves a day and reads it back` — `save_sales_day` with one line qty 10 → one `sales_days` row (closed false), one line with the snapshot values.
  - `qty 0 removes only that pair; other lines stay` — save two pairs, then save one pair with qty 0 → one line left.
  - `snapshot is kept when qty is unchanged` — save qty 10 with `hpp_unit` 6200, save again qty 10 with `hpp_unit` 7000 → still 6200; save qty 11 with 7000 → 7000.
  - `removing the last line deletes the day`.
  - `close_sales_day clears lines and marks closed`; a later `save_sales_day` sets `closed` false.
  - `deleting a product keeps its line with product_id null and the name snapshot`.
  - `future date and date older than 92 days are refused` with code `UT002`.
  - `another user can neither read nor write` — other user's select returns 0 rows; their `save_sales_day` on the owner's store fails; anon has no access to the three tables.
  - `purchase updates the material price` — `save_purchase(…, date today, new price 17000)` returns true, material `purchase_price` 17000.
  - `back-dated purchase does not change the price` — second purchase dated yesterday returns false, price stays 17000.
  - `editing the latest purchase re-applies the price` — update the first purchase with new price 16000 → true, price 16000.
  - `same date: the one saved last wins`.
- [ ] **Step 2: Run** `npm run test:rls -- tests/rls/records.test.ts`. Expected: FAIL (relations/functions do not exist).
- [ ] **Step 3: Write the migration** `supabase/migrations/20261018000004_sales_records.sql` per the Interfaces block; apply with `npx supabase migration up --local`; regenerate types with `npm run db:types`.
- [ ] **Step 4: Run** `npm run test:rls`. Expected: all RLS tests pass (existing ones included). Also `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(records): tables and atomic save functions for sales and purchases`.

### Task 2: Pure record calculations (`lib/records`)

**Files:**
- Create: `lib/records/dates.ts`, `lib/records/snapshot.ts`, `lib/records/month-report.ts`, `lib/records/purchase-price.ts`, `lib/records/index.ts`
- Test: `tests/unit/records.test.ts`

**Interfaces:**
- Consumes: `StoreAnalysis`, `MetricsLine`, `StoreData`, `toBase`, `sameDimension`, `Unit`, `CalcMaterial` from `@/lib/calc`.
- Produces (`@/lib/records`):
  - `MAX_BACKFILL_DAYS = 92`, `MISSING_BANNER_DAYS = 31`, `MAX_DAY_QTY = 9999`.
  - `type IsoDate = string` (`YYYY-MM-DD`), `type IsoMonth = string` (`YYYY-MM`).
  - `jakartaToday(now: Date): IsoDate`; `addDays(date: IsoDate, n: number): IsoDate`; `daysInMonth(month: IsoMonth): number`; `monthOf(date: IsoDate): IsoMonth`; `isIsoDate(v: unknown): v is IsoDate`; `isIsoMonth(v: unknown): v is IsoMonth`; `earliestRecordable(today: IsoDate): IsoDate`.
  - `type SalesCount = { productId: string; channelId: string; qty: number }`.
  - `type SalesLineSnapshot = { productId: string; channelId: string; productName: string; channelName: string; qty: number; unitPrice: number; netUnit: number; hppUnit: number }`.
  - `snapshotLines(data: StoreData, analysis: StoreAnalysis, counts: SalesCount[]): SalesLineSnapshot[]` — values from the matching `MetricsLine` (`price`, `netPrice`, `materialCost`); throws `Error` for a pair with no `MetricsLine` (the action never sends one).
  - `type SalesDayRecord = { date: IsoDate; closed: boolean }`; `type SalesLineRecord = { id: string; date: IsoDate; productId: string | null; channelId: string | null; productName: string; channelName: string; qty: number; unitPrice: number; netUnit: number; hppUnit: number }`.
  - `missingDates(firstRecord: IsoDate | null, today: IsoDate, filled: Set<IsoDate>, from: IsoDate, to: IsoDate): IsoDate[]` — dates in `[max(from, firstRecord), min(to, today − 1)]` not in `filled`; empty when `firstRecord` is null.
  - `type DayState = "recorded" | "closed" | "missing" | "future" | "before"` (`before` = before the first record).
  - `type MonthReport = { month: IsoMonth; window: { start: IsoDate; end: IsoDate; days: number } | null; daysInMonth: number; omzet: number; channelFees: number; materialCosts: number; grossProfit: number; fixedCosts: number; netProfit: number; plannedNetProfit: number | null; biggestGap: { productName: string; channelName: string; pct: number; rupiah: number } | null; calendar: { date: IsoDate; state: DayState }[]; missing: IsoDate[] }`.
  - `monthReport(input: { month: IsoMonth; today: IsoDate; firstRecord: IsoDate | null; days: SalesDayRecord[]; lines: SalesLineRecord[]; analysis: StoreAnalysis; data: StoreData }): MonthReport` — all money rounded to whole Rupiah so that `omzet − channelFees − materialCosts === grossProfit` and `grossProfit − fixedCosts === netProfit` exactly. Window = `[max(month start, firstRecord), min(month end, today)]`, null when the month is entirely before the first record or after today. `fixedCosts = analysis.fixedCosts.total × window.days / daysInMonth`; `plannedNetProfit = analysis.netProfit × window.days / daysInMonth` (null without a window). Biggest gap: over current `analysis.lines` with `estMonthlySales > 0` or actual qty > 0, expected = `estMonthlySales × window.days / daysInMonth`, `rupiah = (actual − expected) × contribution`, pick the largest `|rupiah|` (tie: earlier in `analysis.lines`), `pct = round((actual − expected) / expected × 100)` (null pair skipped when expected is 0).
  - `newPurchasePrice(material: Pick<CalcMaterial, "purchaseQty" | "purchaseUnit">, qty: number, unit: Unit, totalPaid: number): number` — `round(totalPaid / toBase(qty, unit) × toBase(purchaseQty, purchaseUnit))`; throws on a different dimension.

- [ ] **Step 1: Write failing tests** in `tests/unit/records.test.ts`:
  - `jakartaToday(new Date("2026-10-17T18:30:00Z"))` → `"2026-10-18"`; `jakartaToday(new Date("2026-10-17T16:59:59Z"))` → `"2026-10-17"`; `daysInMonth("2026-02")` → 28; `daysInMonth("2028-02")` → 29; `earliestRecordable("2026-10-18")` → `"2026-07-18"`.
  - `missingDates("2026-10-01", "2026-10-17", filled{1–7, 9–11, 13–16}, "2026-10-01", "2026-10-31")` → `["2026-10-08", "2026-10-12"]` (today not flagged); with `firstRecord` null → `[]`; first record `2026-10-10` → only `["2026-10-12"]`.
  - `snapshotLines` on a fixture (product price 22.000 offline 0%, 27.000 GoFood 20% + Rp1.000, HPP bahan 6.200 offline / 6.700 GoFood): GoFood line → `unitPrice 27000, netUnit 20600, hppUnit 6700`.
  - `monthReport` for `2026-10`, today `2026-10-17`, first record `2026-10-01`, lines kopi offline 10 × (22000, 22000, 6200) + kopi GoFood 5 × (27000, 20600, 6700), `fixedCosts.total` 3.100.000: `omzet 355000, channelFees 32000, materialCosts 95500, grossProfit 227500, window.days 17, fixedCosts 1700000, netProfit −1472500`.
  - same with first record `2026-10-15` → `window {start "2026-10-15", end "2026-10-17", days 3}`, `fixedCosts 300000`, `netProfit −72500`.
  - past month `2026-09`, today `2026-10-17`, first record `2026-09-10` → `window.days 21`, `fixedCosts 2170000`.
  - month entirely before the first record → `window null`, `fixedCosts 0`, `plannedNetProfit null`, every calendar day `before`.
  - calendar states for the October fixture include `recorded`, `closed` (a closed day), `missing` (8 Oct), `future` (18 Oct).
  - reconciliation with fractional snapshots (`netUnit 20599.6`, `hppUnit 6213.33`): the two identities hold exactly.
  - biggest gap picks the line with the largest Rupiah shortfall and reports a negative `pct`.
  - `newPurchasePrice({1,kg}, 2, "kg", 34000)` → 17000; `({1,kg}, 500, "g", 9000)` → 18000; `({50,pcs}, 2, "lusin", 18000)` → 37500; `({1,l}, 2, "kg", 1)` throws.
- [ ] **Step 2: Run** `npx vitest run tests/unit/records.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the modules per Interfaces. `jakartaToday` uses `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })`; date arithmetic on UTC dates built from the ISO parts (no local-time `Date` parsing).
- [ ] **Step 4: Run** `npx vitest run tests/unit/records.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(records): snapshot, month report and purchase price calculations`.

### Task 3: Catat → Penjualan page, navigation

**Files:**
- Create: `app/[locale]/s/[storeId]/catat/page.tsx`, `app/[locale]/s/[storeId]/catat/sales-entry.tsx` (client), `app/[locale]/s/[storeId]/catat/actions.ts`, `app/[locale]/s/[storeId]/catat/record-tabs.tsx` (Penjualan / Belanja links), `lib/data/records.ts`
- Modify: `lib/nav.ts`, `tests/unit/nav.test.ts`, `messages/id.json`, `messages/en.json`
- Test: `tests/e2e/catat.spec.ts`

**Interfaces:**
- Consumes: Task 1 functions; Task 2 `snapshotLines`, `jakartaToday`, `earliestRecordable`, `missingDates`, `MISSING_BANNER_DAYS`, `MAX_DAY_QTY`, `isIsoDate`.
- Produces:
  - `lib/data/records.ts` (server-only, user client, `cache` per request): `loadSalesDay(storeId: string, date: IsoDate): Promise<{ closed: boolean; lines: SalesLineRecord[] } | null>`; `loadSalesRange(storeId: string, from: IsoDate, to: IsoDate): Promise<{ days: SalesDayRecord[]; lines: SalesLineRecord[] }>`; `loadFirstRecordDate(storeId: string): Promise<IsoDate | null>`.
  - Server Actions in `catat/actions.ts`: `saveSalesDayAction(storeId: string, date: string, counts: SalesCount[]): Promise<SalesSaveResult>`, `closeSalesDayAction(storeId: string, date: string): Promise<SalesSaveResult>`, `deleteSalesLineAction(storeId: string, lineId: string): Promise<SalesSaveResult>` where `type SalesSaveResult = { ok: true; message: string } | { ok: false; message: string }`. Each calls `requireUser()` first, validates ids (`isUuid`), date (`isIsoDate`, within `[earliestRecordable(today), today]`), counts (whole numbers 0–`MAX_DAY_QTY`, pairs that exist as `analysis.lines`); `saveSalesDayAction` runs `tryAnalyzeStore` and refuses with the CalcError message when it fails; maps `UT002` to a date message; `revalidateStore()` on success.
  - `lib/nav.ts`: `NavLabelKey` gains `"records"` (path `catat`, icon `NotebookPen`) and `"monthly"` (path `laporan`, icon `CalendarCheck`). Sidebar order: dashboard, records, monthly, products, materials, channels, expenses, assets, simulation, analysis, report, settings. Bottom bar: dashboard, records, monthly, products, more. `MORE_KEYS`: materials, channels, expenses, assets, simulation, analysis, report, settings. Messages `StoreShell.nav.records` "Catat"/"Record", `StoreShell.nav.monthly` "Laporan"/"Report".
  - Messages namespace `Records` (all copy for Tasks 3–5).

- [ ] **Step 1: Update** `tests/unit/nav.test.ts` to the orders above; run `npx vitest run tests/unit/nav.test.ts`. Expected: FAIL. Implement `lib/nav.ts`; expected: PASS.
- [ ] **Step 2: Write the failing e2e** `tests/e2e/catat.spec.ts` (sign in a fresh user with `signIn`, seed the sample store through "Coba dengan data contoh" as `ringkasan.spec.ts` does, or build a small store with the helpers):
  - `records a day per channel and shows the live summary` — open Catat (bottom bar at 360px and sidebar on desktop), set Es kopi susu offline to 10 via + and by typing, switch to the GoFood tab, set 5; the tab label shows "5 terjual"; the summary shows Omzet and Laba kotor; Simpan → success message; reload keeps the counts.
  - `editing keeps other channels` — reopen the day, change only offline, save; GoFood count unchanged.
  - `all zeros asks whether the shop was closed` — a new date, Simpan with zeros → the "Toko tutup hari ini?" confirm; confirming marks the day closed (the page shows the closed state).
  - `missing-days banner links to the day` — record two days with one gap between, the banner names the gap date and its link opens that date.
  - `date picker refuses future dates` — `?tanggal=` tomorrow shows today's entry with a notice (no save of a future day possible).
  - `deleted product's line stays read-only` — record a day, delete that product (on the product page), reopen the day: the line appears under "Tercatat sebelumnya" with its name; remove button deletes it.
  - `calc error blocks saving` — a store whose recipe uses sdm on a weight material without spoon weight: Simpan shows the CalcError message.
  - `another user's store is 404` for `/catat`.
  - `no horizontal scroll at 360px`; steppers ≥ 40px.
- [ ] **Step 3: Run** the spec against your own build. Expected: FAIL.
- [ ] **Step 4: Implement** the page per spec §4.1 and the actions. The page loads `loadStoreData`, `tryAnalyzeStore`, `loadSalesDay`, `loadFirstRecordDate`, missing dates in the last `MISSING_BANNER_DAYS`; renders channel tabs from `data.channels` (only channels that have at least one active product price), product rows from `analysis.lines` of active products, `<input type="date" min max>` for the date (navigates with `?tanggal=`), the missing-days banner (at most 5 date links plus "dan N lainnya"), the edit-history note for a past day, and the "Tercatat sebelumnya" read-only list (lines whose pair is not shown). The live summary computes from `analysis.lines` on the client using the same values `snapshotLines` uses.
- [ ] **Step 5: Run** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then `tests/e2e/catat.spec.ts` and `tests/e2e/store-shell.spec.ts` (nav changed). Expected: PASS.
- [ ] **Step 6: Commit** `feat(records): record daily sales per channel`.

### Task 4: Catat → Belanja (purchases)

**Files:**
- Create: `app/[locale]/s/[storeId]/catat/belanja/page.tsx`, `app/[locale]/s/[storeId]/catat/belanja/purchase-form.tsx` (client), `app/[locale]/s/[storeId]/catat/belanja/actions.ts`, `lib/validation/purchase.ts`
- Modify: `lib/data/records.ts`, `messages/id.json`, `messages/en.json`
- Test: `tests/e2e/belanja.spec.ts`, `tests/unit/entity-validation.test.ts` (purchase schema cases)

**Interfaces:**
- Consumes: Task 1 `save_purchase`; Task 2 `newPurchasePrice`, `jakartaToday`, `earliestRecordable`; `unitsOf`, `dimensionOf`, `MoneyInput`, `parseForm`.
- Produces:
  - `lib/data/records.ts` additions: `loadPurchases(storeId: string, from: IsoDate, to: IsoDate): Promise<PurchaseRecord[]>` with `type PurchaseRecord = { id: string; materialId: string | null; materialName: string; date: IsoDate; qty: number; unit: Unit; totalPaid: number }`; `loadLatestPurchaseDates(storeId: string): Promise<Map<string, { id: string; date: IsoDate }>>` (latest per material by date, saved_at).
  - `lib/validation/purchase.ts`: `purchaseInputSchema` (zod) with `materialId` uuid, `qty` > 0 (accepts "1,5"), `unit` in `UNITS`, `totalPaid` integer ≥ 0 (MoneyInput digits), `date` ISO; message keys via the existing validation translator pattern.
  - Server Actions: `savePurchaseAction(storeId: string, purchaseId: string | null, _prev: FormState, formData: FormData): Promise<FormState>`; `deletePurchaseAction(storeId: string, purchaseId: string): Promise<FormState>`. `requireUser()` first; unit must be in the material's dimension (`fieldErrors.unit`); date in range; calls `save_purchase` with `newPurchasePrice(...)`; success message says whether the price changed ("Harga Gula sekarang Rp17.000 per 1 kg" / "Belanja dicatat. Harga tidak berubah karena ada belanja yang lebih baru (12 Okt)").

- [ ] **Step 1: Write failing tests**: schema cases in `tests/unit/entity-validation.test.ts` (qty "1,5" → 1.5; qty 0 rejected; unknown unit rejected; household unit "sdm" rejected); e2e `tests/e2e/belanja.spec.ts`:
  - `purchase updates the material price` — Belanja tab, pick a 1 kg material at Rp15.000, 2 kg, "34.000"; the preview reads "Rp15.000 → Rp17.000 per 1 kg"; save; the Bahan page shows Rp17.000.
  - `back-dated purchase leaves the price` — a purchase dated 3 days ago: preview says the price won't change and names the newer date; after saving the price is unchanged.
  - `editing a typo fixes the price` — edit the latest purchase from "340.000" to "34.000"; price follows.
  - `unit list follows the material` — a pcs material offers only pcs/lusin.
  - `deleting a purchase keeps the price`.
  - `this month's purchases are listed`.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** per spec §4.2; the preview is computed on the client with `newPurchasePrice` and the latest-purchase map passed from the page (excluding the purchase being edited).
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `tests/e2e/belanja.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(records): record purchases that update material prices`.

### Task 5: Laporan, dashboard card, sample data, privacy and spec

**Files:**
- Create: `app/[locale]/s/[storeId]/laporan/page.tsx`, `app/[locale]/s/[storeId]/laporan/month-calendar.tsx`
- Modify: `app/[locale]/s/[storeId]/dashboard/page.tsx` (+ a small `records-card.tsx`), `lib/seed/demo-store.ts`, `tests/unit/demo-store.test.ts`, `tests/rls/seed.test.ts`, `app/[locale]/privasi/page.tsx` (or its messages), `docs/superpowers/specs/2026-10-16-untungin-design.md` (§12 and a pointer), `messages/id.json`, `messages/en.json`
- Test: `tests/e2e/laporan.spec.ts`

**Interfaces:**
- Consumes: Task 2 `monthReport`, `isIsoMonth`, `monthOf`, `jakartaToday`; Task 3 loaders; Task 4 `loadPurchases`, `deletePurchaseAction`.
- Produces: `/s/[storeId]/laporan?bulan=YYYY-MM` (invalid or future month falls back to the current month); dashboard `RecordsCard`; sample store with records.

- [ ] **Step 1: Write failing tests**:
  - `tests/unit/demo-store.test.ts`: the demo spec has 14 sales days ending yesterday relative to a given `today`, exactly one closed day and one missing day among them, and two purchases.
  - `tests/rls/seed.test.ts`: seeding creates the sales days, lines and purchases under RLS for the seeding user.
  - `tests/e2e/laporan.spec.ts` on the sample store: the answer card says "Untung" or "Rugi" with a Rupiah amount; the five lines add up (parse the Rupiah text: Omzet − Potongan kanal − Biaya bahan − Biaya tetap = Laba bersih); the fixed-cost label shows "N dari M hari"; the missing-day warning names the missing date and its link opens Catat on that date; the calendar marks the closed day; previous month navigation works and the next-month control is disabled on the current month; the purchases list shows the sample purchases; the dashboard shows "Bulan ini sebenarnya" linking to Laporan; an empty store shows the empty state with "Catat penjualan pertamamu"; another user's store gives 404; no horizontal scroll at 360px.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the Laporan page per spec §4.3 (loads the month's days/lines/purchases, first record, `tryAnalyzeStore`; a CalcError shows the existing CalcError state), the dashboard card and "Catat penjualan hari ini" nudge per spec §3, the sample-store records (dates relative to `jakartaToday` at seed time, snapshots via `snapshotLines` on the demo analysis, inserted with `save_sales_day` / `close_sales_day` / `save_purchase` under the user client), the privacy line, and the v1 spec update (remove "Recording actual sales & purchases" from §12, add a pointer to the Catat design under §1 "Agreed decisions" Profit mode).
- [ ] **Step 4: Run** the full suite: `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, `npm run build`, full e2e. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(records): monthly report, dashboard card and sample records`.
