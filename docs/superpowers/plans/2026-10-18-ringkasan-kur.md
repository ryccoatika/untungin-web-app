# Loan Summary (KUR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller can produce a one-page summary of their business to take to a bank for a KUR (small-business loan). The summary covers:
- the business profile;
- monthly revenue, costs and net profit;
- products;
- equipment and capital;
- break-even and payback;
- an instalment check.

It is printable or savable as a PDF, and downloadable as a spreadsheet (CSV).

**Architecture:**
- `lib/report/loan-summary.ts` is pure: it builds a structured, unformatted summary from `StoreData` and `StoreAnalysis`, using the same numbers as the dashboard.
- `lib/report/installment.ts` computes an annuity instalment.
- `lib/report/csv.ts` turns the summary into an Excel-friendly CSV.
- The `ringkasan` page (Server Component) renders the summary as an A4 print layout. It has a small client toolbar ("Cetak / Simpan PDF" via `window.print()`, "Unduh Excel (CSV)") and an instalment calculator.
- A route handler `ringkasan/csv` returns the CSV, reading data with the user's own client, so RLS applies.

**Tech Stack:** Next.js 16.4 (Server Components, Route Handlers), next-intl, Tailwind 4 `print:` variant, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-16-untungin-design.md` — §12 listed "PDF/Excel export" as out of scope for v1; this adds it. The user skipped design questions; the calls below are the controller's, stated to the user.

**Base branch:** `feat/ringkasan-kur`, created from `feat/takaran-pwa` (PR #9 open; both touch the Lainnya page).

## Global Constraints

- Read `AGENTS.md` (Next.js 16.4: `params`/`searchParams` are Promises; Route Handlers in `app/**/route.ts`). Code comments, README and docs in English. Every user-facing string comes from `messages/id.json` and `messages/en.json` with identical keys, edited as text.
- Numbers come only from `lib/calc` (`analyzeStore`): the summary never recomputes profit differently from the dashboard. Money uses `formatRupiah`, percentages use `formatPercent`, dates use `formatDateTime` / Asia/Jakarta.
- The summary states clearly that the figures are the owner's own estimates entered in Untungin and are not an audited financial statement.
- The instalment check is an estimate with a user-editable rate, not financial advice. There are no pass/fail verdicts.
- Store data is read only with the user's own Supabase client (RLS). The CSV route verifies the session like any page (`requireUser`) and returns 404 for a store the user can't read.
- Print: A4 portrait on one page for a typical store (up to about 8 products and 6 assets). Light colours on paper whatever the theme; app chrome (sidebar, header, bottom nav, toolbar, calculator inputs) is hidden when printing.
- Mobile first: tap targets ≥ 40px, no horizontal scroll at 360px (tables scroll inside their own container on screen), light and dark mode on screen.
- No new dependencies.
- Tests: `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, `npm run build`, e2e on a production build (`npx next start -p 3100` in the background capturing its PID; stop only that PID; never port 3000; never read `.env.local`; never click "Analisis usahaku"; never modify the user's own account ryccoatika@gmail.com).
- Commit messages are conventional and end with the Co-Authored-By trailer of the committing agent's harness.

## Review Focus

1. **A store whose numbers can't be summarised** (no priced products, no sales estimate, a CalcError, no assets, a loss) still gets a readable page that says what is missing. It never shows NaN, "Rp-0" or an empty table. — Unit tests in Task 1, e2e in Task 2.
2. **Names with commas, semicolons, quotes or line breaks** (products, materials, assets, the store name) must not break the CSV columns in Excel. — Unit test in Task 1.
3. **Instalment edge cases:** a 0% rate, a 1-month tenor, a very large loan, blank or invalid input, and a net profit ≤ 0 (no ratio) give sensible output or a clear message. — Unit tests in Task 1, e2e in Task 2.
4. **Printing from a phone or desktop** shows only the summary, on one A4 page for the sample store, legible in black-on-white even in dark mode. — e2e with print media emulation in Task 2.
5. **Another user's store id** in the page or CSV URL returns not-found, never data. — e2e/RLS in Task 2.

## Rulings (controller's calls)

- **Route:** `/s/[storeId]/ringkasan`. Navigation label "Ringkasan pinjaman" / "Loan summary", icon `FileText`. It goes in the sidebar after "Analisis AI" and on the Lainnya page after "Analisis AI".
- **Content order:**
  1. header (store, business type, target market, owner name from `profiles.full_name` when set, date made);
  2. monthly summary (omzet, material costs, gross profit, fixed costs by category, depreciation, net profit, net margin);
  3. products (product, channel, price, HPP, margin, estimated sales per month);
  4. equipment and capital (asset, quantity, value, useful life, total capital);
  5. break-even per day/month and payback months;
  6. instalment check (only when filled in);
  7. footnote.
- **Instalment:**
  - It is a standard annuity: monthly rate = annual ÷ 12; `P·r / (1 − (1+r)^−n)`, or `P / n` when the rate is 0. The result is rounded to whole Rupiah.
  - The default rate is 6% a year, the KUR rate the government sets. The user can edit it.
  - Inputs: loan amount (Rupiah, `wholeNumber` rules), tenor in months (1–60), and rate % (0–30, decimals allowed).
  - The output shows the monthly instalment, the total repaid, and "cicilan = X% dari laba bersih per bulan" when net profit > 0, otherwise "Laba bersih belum positif".
  - The values live in the URL (`?pinjaman=…&tenor=…&bunga=…`), so print and CSV include them and a reload keeps them.
- **CSV:**
  - UTF-8 with BOM, first line `sep=;` (so Excel in Indonesian and English locales splits columns), `;` separator.
  - Plain integers for Rupiah (no grouping), percentages with one decimal and a `.` decimal point.
  - Each section has a title row and a header row, with a blank line between sections.
  - File name: `ringkasan-<store-slug>-<YYYY-MM-DD>.csv`.
- **PDF:** the browser's print to PDF. No server-side PDF generation and no new library.

## File Structure

```
lib/report/installment.ts     monthlyInstallment, parseInstallmentParams
lib/report/loan-summary.ts    LoanSummary type, buildLoanSummary
lib/report/csv.ts             loanSummaryCsv, csvEscape
app/[locale]/s/[storeId]/ringkasan/page.tsx             print layout (Server Component)
app/[locale]/s/[storeId]/ringkasan/report-toolbar.tsx   print + CSV buttons (client)
app/[locale]/s/[storeId]/ringkasan/installment-form.tsx instalment inputs → URL (client)
app/[locale]/s/[storeId]/ringkasan/csv/route.ts         CSV download
lib/nav.ts, app/[locale]/s/[storeId]/layout.tsx (print:hidden chrome), messages
tests/unit/report.test.ts  tests/e2e/ringkasan.spec.ts
```

---

### Task 1: Summary data, instalment and CSV (pure)

**Files:** Create `lib/report/installment.ts`, `lib/report/loan-summary.ts`, `lib/report/csv.ts`, `tests/unit/report.test.ts`.

**Interfaces:**
- Produces:
  - `monthlyInstallment(principal: number, annualRatePct: number, months: number): number` (whole Rupiah)
  - `type InstallmentInput = { principal: number; months: number; annualRatePct: number }`
  - `parseInstallmentParams(query: Record<string, string | string[] | undefined>): { input: InstallmentInput | null; errors: ("principal" | "months" | "rate")[] }` — no params gives `{ input: null, errors: [] }`; defaults rate 6 when blank but principal and months are set
  - `DEFAULT_KUR_RATE_PCT = 6`, `MAX_TENOR_MONTHS = 60`, `MAX_RATE_PCT = 30`
  - `type LoanSummary`:

    ```
    {
      store: { name; businessType; targetMarket: string | null; ownerName: string | null; operatingDaysPerMonth };
      monthly: { grossRevenue; materialCosts; grossProfit; fixedCostsByCategory: { category: ExpenseCategory; amount: number }[]; depreciation; fixedCostsTotal; netProfit; netMarginPct: number | null };
      products: { product; channel; price; fullCost: number | null; materialCost; marginPct: number | null; estMonthlySales }[];
      assets: { name; qty; value; usefulLifeMonths }[]; totalCapital;
      breakEven: { unitsMonthly: number | null; unitsDaily: number | null }; paybackMonths: number | null;
      installment: { principal; months; annualRatePct; monthly; totalRepaid; shareOfNetProfitPct: number | null } | null;
      missing: ("products" | "salesEstimate" | "assets")[];
    }
    ```

  - `buildLoanSummary(data: StoreData, analysis: StoreAnalysis, info: { businessType: string; targetMarket: string | null; ownerName: string | null }, installment: InstallmentInput | null): LoanSummary`
  - `csvEscape(value: string | number | null): string`, `loanSummaryCsv(summary: LoanSummary, labels: CsvLabels): string`, where `CsvLabels` is a flat record of translated column and section titles passed in by the caller (so lib stays free of next-intl)

- [ ] **Step 1: Write the failing tests** (`tests/unit/report.test.ts`):
  - **`monthlyInstallment`:**
    - (10_000_000, 6, 12) → 860_664 (verify with the formula; if Node computes a different whole Rupiah, the formula is the authority and the test uses its value);
    - (12_000_000, 0, 12) → 1_000_000;
    - (1_000_000, 6, 1) → 1_005_000;
    - large: (2_000_000_000, 6, 60) is finite and positive.
  - **`parseInstallmentParams`:**
    - none → `{ input: null, errors: [] }`;
    - `{ pinjaman: "10.000.000", tenor: "12" }` → rate 6;
    - `bunga: "6,5"` → 6.5;
    - `tenor: "0"` / `"61"` → months error;
    - `pinjaman: "abc"` → principal error;
    - `bunga: "31"` → rate error;
    - arrays take the first value.
  - **`buildLoanSummary`:**
    - With the sample store (`buildDemoStore("id")` + `demoAsStoreData` + `analyzeStore`), its net profit equals `analysis.netProfit`, and it has products and assets.
    - The fixed costs per category sum to `fixedCostsTotal − depreciation` within 1 Rupiah.
    - The instalment share = monthly ÷ netProfit × 100 (1 decimal).
    - A store with no prices gives `missing` containing "products" and no NaN anywhere (walk all numbers with `Number.isFinite` or null).
    - Net profit ≤ 0 gives a null share.
  - **`csvEscape` / `loanSummaryCsv`:**
    - The output starts with BOM + `sep=;`.
    - A name `Kopi "Senja"; susu, gula\nbaru` is quoted and quotes are doubled, so the line count matches.
    - Rupiah values are plain integers.
    - Every section title appears once.
- [ ] **Step 2:** Run `npx vitest run tests/unit/report.test.ts` → FAIL.
- [ ] **Step 3: Implement the three modules.**
  - `buildLoanSummary` reads everything from `analysis` (lines, fixedCosts, totals) and `data` (names, assets). Per-category monthly expenses use `monthlyAmount` from `lib/calc`, grouped by `ExpenseCategory` in `EXPENSE_CATEGORIES` order, skipping zeros.
  - The asset value is `qty × unitPrice`.
  - `paybackMonths` is null when total capital is 0, as on the dashboard.
- [ ] **Step 4:** Run the file, then the full `npm test`, `npm run typecheck`, `npm run lint` → PASS.
- [ ] **Step 5:** Commit: `feat(report): loan summary data, instalment and CSV`.

---

### Task 2: The ringkasan page, CSV download, print and navigation

**Files:**
- Create: `app/[locale]/s/[storeId]/ringkasan/{page.tsx,report-toolbar.tsx,installment-form.tsx}`, `app/[locale]/s/[storeId]/ringkasan/csv/route.ts`, `tests/e2e/ringkasan.spec.ts`.
- Modify: `lib/nav.ts`, `tests/unit/nav.test.ts`, `app/[locale]/s/[storeId]/layout.tsx` (and nav components: `print:hidden` on sidebar, header, bottom nav), `app/globals.css` (print rules), `messages/id.json`, `messages/en.json`, `tests/e2e/store-shell.spec.ts`, the spec (§12 and a post-v1 note).

**Interfaces:**
- Consumes Task 1 (`buildLoanSummary`, `parseInstallmentParams`, `loanSummaryCsv`, `DEFAULT_KUR_RATE_PCT`).
- Produces nav key `"report"` (path `ringkasan`).

- [ ] **Step 1: Navigation (TDD).** Update `tests/unit/nav.test.ts`:
  - sidebar order: dashboard, products, materials, channels, expenses, assets, simulation, analysis, report, settings;
  - Lainnya list: channels, expenses, assets, simulation, analysis, report, settings.

  Implement `report: { path: "ringkasan", icon: FileText }`. Messages:
  - `StoreShell.nav.report`: "Ringkasan pinjaman" / "Loan summary"
  - `moreDescriptions.report`: "Ringkasan usaha untuk pengajuan KUR ke bank" / "A business summary for a bank loan (KUR) application"

  Update the store-shell e2e list.
- [ ] **Step 2: Messages.** A new `Report` namespace, with keys in both files covering:
  - title "Ringkasan usaha" / "Business summary", subtitle "Untuk pengajuan pinjaman (KUR)" / "For a loan (KUR) application";
  - section titles, every column label and the empty-state texts;
  - toolbar: "Cetak / Simpan PDF" / "Print / Save as PDF", "Unduh Excel (CSV)" / "Download spreadsheet (CSV)";
  - instalment labels: "Jumlah pinjaman", "Tenor (bulan)", "Bunga per tahun (%)", "Hitung", "Cicilan per bulan", "Total dibayar", "Cicilan = {pct} dari laba bersih per bulan", "Laba bersih belum positif, jadi kemampuan bayar belum bisa dihitung.", and the hint "Bunga KUR yang ditetapkan pemerintah biasanya 6% per tahun; tanyakan angka pastinya ke bank.";
  - footnote: "Angka di ringkasan ini adalah perkiraan yang diisi pemilik usaha di Untungin, bukan laporan keuangan yang diaudit." / "The figures in this summary are the owner's own estimates entered in Untungin, not an audited financial statement.";
  - "Dibuat {date}" / "Made {date}".
- [ ] **Step 3: Page.** `page.tsx` (Server Component):
  - loads store, data and profile (`full_name`), then `tryAnalyzeStore` and `parseInstallmentParams(await searchParams)`;
  - CalcError → the existing calc-error message with a link to the product;
  - no priced products → an EmptyState pointing to Produk;
  - otherwise renders the sections from `buildLoanSummary`.

  Layout:
  - On screen: a card-like A4 sheet (`max-w-[210mm]`). Tables scroll inside their own container at 360px.
  - Above the sheet: `ReportToolbar` (client), with a "Cetak / Simpan PDF" button calling `window.print()` and an "Unduh Excel (CSV)" link to `ringkasan/csv` plus the current query.
  - `InstallmentForm` (client): three inputs (Rupiah via `MoneyInput`; tenor; rate with default 6) and "Hitung", which updates the URL with `router.replace`, so the Server Component re-renders the instalment section. Invalid values show field errors from `parseInstallmentParams`.
  - Status colour is never the only signal.
- [ ] **Step 4: Print styles.**
  - `@page { size: A4; margin: 12mm; }`.
  - In print: force light tokens on the sheet (white background, near-black text). Hide the sidebar, header, bottom nav, toolbar and calculator inputs (`print:hidden`), but keep the instalment result.
  - Avoid page breaks inside rows and sections (`break-inside: avoid`).
  - Use 10–11pt base type for print. The sample store must fit one page.
- [ ] **Step 5: CSV route.** `ringkasan/csv/route.ts`:
  - `GET`, `requireUser`-equivalent for route handlers: a redirect to login is fine, otherwise 401;
  - load with the user's client: store missing or not owned → 404;
  - build the summary with the query's instalment, then call `loanSummaryCsv` with translated labels (`getTranslations` for the request locale);
  - respond with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="ringkasan-<slug>-<date>.csv"` (ASCII slug from the store name; date in Asia/Jakarta).
- [ ] **Step 6: e2e** (`tests/e2e/ringkasan.spec.ts`):
  1. **Sample store:** onboarding "Coba dengan data contoh" → Ringkasan pinjaman (via nav) shows "Kedai Kopi Contoh", the net profit matching the dashboard metric (`metric-netProfit` text), the products table and the assets table.
  2. **Instalment:** fill 10.000.000 / 12 / 6 → "Hitung" → monthly instalment "Rp860.664" (or the formula's value) and a percentage line. Reload: the values persist from the URL. Rate "31" → field error.
  3. **CSV:** `page.request.get(csvUrl)` → 200, `text/csv`, attachment filename, and the body contains `sep=;`, "Kedai Kopi Contoh" and the net profit as a plain integer.
  4. **Print:** `page.emulateMedia({ media: "print" })` → sidebar or bottom nav and toolbar not visible; the summary heading visible.
  5. **Empty store:** a new store without products shows the empty state, not a broken summary.
  6. **Another user's store:** signing in as user B and requesting user A's `ringkasan` and `ringkasan/csv` → not-found or 404.
  7. **360px:** no horizontal overflow.
- [ ] **Step 7: Spec.** In §12 remove "PDF/Excel export". Add the post-v1 note: "Ringkasan pinjaman (KUR): printable A4 summary, browser print to PDF, CSV with `sep=;`, instalment check with an editable rate (default 6%)."
- [ ] **Step 8: Verify and commit.**
  - Run unit, typecheck, lint, test:rls and build; then e2e on `ringkasan`, `store-shell`, then the full suite.
  - Screenshot the ringkasan page at 360 and 1280 (light and dark), and the print emulation at A4 width; look at them.
  - Commit `feat(report): printable loan summary (KUR) with CSV and an instalment check`.
