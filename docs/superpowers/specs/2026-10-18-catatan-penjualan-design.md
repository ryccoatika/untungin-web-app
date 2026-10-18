# Sales & Purchase Records ("Catat") — Design

Date: 2026-10-18
Status: Draft for approval (builder check done)
Extends: `docs/superpowers/specs/2026-10-16-untungin-design.md` (v1 spec; this is its "phase 2: recording actual sales & purchases", listed in §12 as out of scope for v1)

## 1. Intent

Until now every number in Untungin is a projection built from the seller's own estimates (`est_monthly_sales`). This feature lets a seller record what actually happened, so the app can answer one question plainly:

> **"Did I actually make a profit this month?"**

The answer is shown as one sentence ("Bulan ini kamu untung Rp2.140.000" / "…rugi Rp…"), next to what the plan expected, with the reason for the biggest gap.

Users are first-time F&B sellers on mid-to-low-end Android phones. Their records come from many places (cash drawer, GoFood/GrabFood merchant app daily totals, a notebook, memory), so entry must be a quick **end-of-day recap**, not a cashier flow.

### Success looks like
- Recording a typical day (3–10 products, 1–3 channels) takes under a minute on a phone.
- The monthly answer is correct, deterministic and consistent with the existing formulas in `lib/calc` (same HPP, same commission maths, same fixed-cost normalisation).
- A seller who forgets days is reminded until every day is filled in, so the monthly answer isn't silently based on missing data.

### Non-goals
- A cashier / point-of-sale app (no per-transaction entry, no receipts, no payment methods).
- Stock / inventory counting.
- Bookkeeping or tax reports.
- Importing sales from GoFood, GrabFood, ShopeeFood or banks.
- Offline entry (the PWA stays offline-fallback only; entry needs a connection).
- Changing the AI analysis or the loan summary (KUR) to use actual numbers. Both keep using estimates for now (possible later work).

### Anti-goals (would be a failure even if it technically works)
- The seller has to type Rupiah amounts for sales.
- Mid-month, the report shows a "loss" only because a full month of rent and salary was subtracted from half a month of sales.
- Changing a material price later silently rewrites last month's profit.
- Missing days are silently treated as zero sales.

## 2. Decisions made with the project owner

| Topic | Decision |
|---|---|
| Purpose | Answer "did I actually make a profit this month?" |
| Sales entry | End-of-day recap: **counts per product per channel**. Prices and commissions come from the existing setup. |
| Entry layout | **One channel at a time** (tabs per channel; each tab is a short product list with − / number / + steppers). Chosen over a single combined list. |
| Ingredient cost in profit | **Recipe cost of what was sold** (units sold × HPP bahan for that product and channel), not what was spent on shopping that month. |
| Purchases | Recording a purchase **updates the material's price**, so HPP and suggested prices follow real prices. Purchases do not enter the profit calculation. |
| Days without an entry | **Keep asking until filled in.** Unfilled past days are flagged on the report and the entry screen. A day can be marked "shop closed" (counts as filled, zero sales). |

## 3. Decisions made by the designer (the owner may override)

- **Snapshot per saved line.** Each sales line stores, at save time: unit price, net revenue per unit (after commission % and fixed fee), and HPP bahan per unit for that product × channel. Reports read only the snapshots. Editing a past day recomputes snapshots for the lines changed in that edit using the current setup (there is no price history to go back to); lines not touched keep theirs. The UI says so in one line when editing a day older than today.
- **Fixed costs are prorated by calendar days, from when recording started.** The counting window for a month starts at the later of the 1st and the store's first recorded day, and ends at today (current month, today included) or the month's last day (past months). Fixed costs = `biayaTetap × windowDays / daysInMonth`. So a seller who starts recording on 15 Oct sees 15 Oct onwards charged against 15 Oct onwards, in October and later; a full past month is charged in full. The line label shows the window: "Biaya tetap (17 dari 31 hari)". `biayaTetap` is the existing monthly figure from `lib/calc` (normalised operating expenses + depreciation), taken from the **current** setup, labelled "Biaya tetap (perkiraan bulanan)". No per-month fixed-cost recording in this version.
- **Plan comparison** uses the existing projection prorated over the same window: `estimated labaBersih × windowDays / daysInMonth`. The dashboard card uses the same window. The "biggest gap" hint names the product × channel whose actual units are furthest below (or above) its prorated `est_monthly_sales`, by contribution lost/gained in Rupiah. Deterministic, no AI.
- **Which days are "missing".** Days from the store's **first recorded day** (first sales day or closed day) up to yesterday that have neither sales nor a closed mark. Today is not flagged until it has passed. Days before the first record are never flagged, so a new user isn't greeted with weeks of "missing" days. Future dates cannot be recorded.
- **Day boundary:** Asia/Jakarta, as everywhere else in the app.
- **Products and channels:** only active products appear in the entry list. A product or channel added mid-month simply appears from then on. If a product or channel is later deleted, its recorded lines remain (they keep a name snapshot) and still count in reports.
- **Purchases update the price in the material's existing pack.** "2 kg gula for Rp34.000" on a material priced per 1 kg sets `purchase_price` to Rp17.000 for its existing `purchase_qty`/`purchase_unit`; the form shows "Gula: Rp15.000 → Rp17.000 per 1 kg". The purchase unit must be in the same dimension as the material (weight / volume / count); household units are not offered for purchases. `waste_pct` is unchanged.
- **Only the latest purchase sets the price.** A purchase updates the material price only if it is the material's latest purchase by date (same date: the one saved last). Logging an older receipt records it without changing the price, and the preview says "Harga tidak berubah: ada belanja yang lebih baru (12 Okt)".
- **Editing a purchase re-applies the price** through the same rule, so fixing a typo (Rp340.000 → Rp34.000) also fixes the material price, with the same preview on the edit form. Deleting a purchase does not roll the price back; the material page remains the place to correct a price by hand.
- **Navigation (phone bottom bar):** Dashboard, **Catat**, **Laporan**, Produk, Lainnya. "Bahan" moves into Lainnya. Desktop sidebar: Catat and Laporan added after Dashboard.
  - `catat` page has two tabs: **Penjualan** (default) and **Belanja**.
  - `laporan` page shows the month's answer and the month's purchases list.
- **Dashboard** keeps showing estimates and gains one small card: "Bulan ini sebenarnya: untung Rp…" linking to Laporan, shown once the store has at least one record. A setup-checklist-style nudge "Catat penjualan hari ini" appears when today isn't recorded yet (after the store has its first record).
- **Sample store** ("Coba dengan data contoh") gets the last 14 days of plausible sales (with one closed day and one deliberately missing day) and two purchases, so the report and reminders are visible in a demo.
- **Privacy page** (`/privasi`) gains a line that daily sales and purchases are stored per store and deleted with the store or account.
- **No plan limits** on records in this version.

## 4. Screens

### 4.1 Catat → Penjualan (`/s/[storeId]/catat?tanggal=YYYY-MM-DD`)
Mockup agreed: layout B.
- Header: "Catat penjualan" + a date chip (default today, Asia/Jakarta). Tapping it opens a date picker limited to today and earlier; unfilled days are marked in the picker.
- If there are unfilled days: a banner "2 hari belum dicatat (8 dan 12 Okt)" with a link per day.
- Channel tabs, each showing "N terjual" for the day. Inside a tab: active products with their price for that channel and a stepper (− / number / +); tapping the number allows typing (0–9999, whole numbers). A product with no price for that channel is not listed in that tab.
- Live summary: "Omzet hari ini" and "Laba kotor (setelah bahan & komisi)" for the whole day across all tabs.
- "Simpan" saves all channels for the day at once: it updates the product × channel pairs shown on the screen (a count of 0 removes that pair's line) and leaves every other line of that day untouched. Lines the screen can't show (deleted or inactive product, deleted channel, price removed) are listed read-only under "Tercatat sebelumnya" with their name snapshot, each with a remove button; they keep counting in reports.
- Saving with every count at 0 and no other lines: the app asks whether the shop was closed ("Toko tutup hari ini?") instead of saving an empty day. A secondary action "Toko tutup hari ini" marks the day closed and clears all of that day's lines, including read-only ones, after a confirm if there were any.
- Tap targets ≥ 40px; no horizontal scroll at 360px; light and dark mode.

### 4.2 Catat → Belanja (`/s/[storeId]/catat/belanja`)
- Form: material (select), quantity + unit (units of the material's dimension), total paid (MoneyInput, "34.000"), date (default today).
- Live preview of the price change before saving: "Gula: Rp15.000 → Rp17.000 per 1 kg".
- Saving records the purchase and updates the material's `purchase_price` (one transaction).
- Below the form: the latest purchases of this month.

### 4.3 Laporan (`/s/[storeId]/laporan?bulan=YYYY-MM`)
Mockup agreed in principle (first guess, owner said to go ahead).
- Month switcher (previous / next; no future months).
- Answer card: "Untung Rp2.140.000" / "Rugi Rp…" / "Impas", with "Sampai hari ini (1–17 Okt)" for the current month, "dari penjualan yang kamu catat".
- Unfilled-days warning with links to fill them in.
- Lines that add up: Omzet; Potongan kanal (komisi & biaya); Biaya bahan (HPP yang terjual); Biaya tetap (N dari M hari, perkiraan bulanan); Laba bersih.
- Plan vs actual: two bars (Rencana / Nyata) plus the biggest-gap sentence.
- Month calendar: recorded (green), closed (grey with a mark), missing (amber), future (muted). Tapping a past day opens Catat for that date.
- Purchases of the month: list (date, material, qty, total) with edit / delete.
- Empty month: explanation + "Catat penjualan pertamamu" button.

### 4.4 Dashboard card
"Bulan ini sebenarnya: untung Rp…" (or rugi), small, under the existing cards, linking to Laporan.

## 5. Data (outline; the builder finalises the migration)

New tables, all with `store_id`, RLS through `is_store_owner`, and grants in line with `20261018000001_least_privilege.sql` / `20261018000002_explicit_app_grants.sql` (authenticated DML, anon nothing). Apply locally with `npx supabase migration up --local` (never `db:reset`).

- `sales_days` — one row per store per date: `store_id`, `date` (date), `closed` boolean, timestamps; unique (`store_id`, `date`). Marks a day as filled (with sales or closed).
- `sales_lines` — `store_id`, `day_id` → `sales_days` (cascade), `product_id` (nullable, `on delete set null`), `channel_id` (nullable, `on delete set null`), `product_name` and `channel_name` snapshots, `qty` integer > 0, `unit_price`, `net_unit` (numeric), `hpp_unit` (numeric); unique (`day_id`, `product_id`, `channel_id`).
- `purchases` — `store_id`, `material_id` (nullable, `on delete set null`), `material_name` snapshot, `date`, `qty` numeric > 0, `unit`, `total_paid` integer ≥ 0, timestamps.
- Saving a day (upsert visible pairs, delete pairs set to 0) and saving or editing a purchase (write + conditional material price update) must each be atomic (a Postgres function called with the user's client, or an equivalent that cannot half-apply), still under RLS.

## 6. Calculation

Pure functions in `lib/calc` (or a sibling `lib/records`), unit-tested, no I/O:
- Snapshot for one line from the current `StoreData` + analysis: `unit_price`, `net_unit = price × (1 − commission/100) − fixed_fee`, `hpp_unit = hppBahan(p, c)`; reuse existing functions, do not re-derive.
- Month report from lines + days + first recorded day + current analysis + "today": `omzet = Σ qty × unit_price`, `potonganKanal = omzet − Σ qty × net_unit`, `biayaBahan = Σ qty × hpp_unit`, `labaKotor`, prorated `biayaTetap`, `labaBersih`; the line items must add up exactly (unit test, as in the loan summary). Missing-day list; plan-vs-actual and biggest gap.
- A `CalcError` in the current setup (e.g. a recipe unit problem) blocks saving a sales day with a clear message, rather than storing a broken snapshot.
- Money is rounded only for display, consistent with the existing formatting (`formatRupiah`).

## 7. Constraints (from the existing project)
- Next.js 16.4 App Router conventions (Promise params/searchParams), Server Actions with zod; Route Handlers only if needed.
- All user-facing strings in `messages/id.json` and `messages/en.json` with identical keys (Indonesian default, English toggle); code, comments and docs in English.
- Server uses `getClaims()`; user data read and written only with the user's RLS client; a foreign or invalid `storeId` → 404.
- No new dependencies unless clearly necessary.
- Mobile first, comfortable on mid-to-low-end Android; light and dark mode.
- Tests: unit (Vitest), RLS tests for the new tables, Playwright e2e on a production build (port 3100, own PID only; never port 3000; never `db:reset`; never click "Analisis usahaku"; never modify the owner's own account).

## 8. Left to the builder
- Exact migration, function and index design; how atomic saves are implemented.
- Component structure; date picker implementation (native input is fine).
- Exact copy beyond the phrases quoted here (keep them plain and friendly).
- Calendar visual details within the existing design language.
- Updating the v1 spec: move "Recording actual sales & purchases" out of §12 and add a pointer to this document.
