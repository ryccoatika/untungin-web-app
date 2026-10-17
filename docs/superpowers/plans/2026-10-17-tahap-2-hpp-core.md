# Phase 2 — HPP Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller can record materials, products with their composition, a price and sales estimate, operating costs and inventory, and see COGS (HPP), monthly profit, break-even and payback on a 2D dashboard with warnings and a setup checklist.

**Architecture:** A pure TypeScript module `lib/calc` (no Next/Supabase/React imports) turns a `StoreData` object into `StoreMetrics` + warnings; it is built test-first from hand-calculated examples. `lib/data/store-data.ts` loads `StoreData` from Supabase (RLS-scoped) once per request. Every page under `/[locale]/s/[storeId]/` is a Server Component that reads `StoreData`; every mutation is a Server Action validated with zod schemas that return message keys. Live previews (material cost, price margin) run `lib/calc` in Client Components.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript strict, Supabase (`@supabase/ssr`, RLS), zod 4, next-intl 4, Tailwind 4 + shadcn (Base UI), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-untungin-design.md` — §3.2–3.6 (tables), §4.1–4.3 (units, formulas, status & warnings), §5.2 (store pages), §5.3 (mutations & errors), §5.4 (i18n), §8 (code structure), §9 (testing), §10 item 2.

**Base branch:** create `feat/tahap-2-hpp` from `feat/tahap-1-fondasi` (PR #1). If PR #1 is already merged, branch from `master` instead; the trees are identical.

## Global Constraints

- Read `AGENTS.md`: this is Next.js 16.4 — check `node_modules/next/dist/docs/` before using an API you are unsure of. Page `params` are `Promise<…>`.
- Code comments, README, and docs in English. Every user-facing string comes from `messages/id.json` and `messages/en.json`; both files must keep exactly the same keys (`tests/unit/messages.test.ts`). Indonesian is the default locale.
- Enum labels (units, categories, frequencies, basis, statuses) come from messages, never from code.
- Money is an `integer` in Rupiah; display with `formatRupiah` (Task 1). Quantities are `numeric`.
- Server code authenticates with `requireUser()` (uses `auth.getClaims()`), never `getSession()`.
- All mutations are Server Actions; input validated with zod; schemas return message keys under `Validation`; actions translate them with `getValidationTranslator()` + `translateFieldErrors()` and echo raw `values` so forms can refill (React 19 resets uncontrolled forms after an action).
- After a successful mutation call `revalidateStore()` (Task 8), i.e. `revalidatePath("/[locale]/s/[storeId]", "layout")` — route patterns, not concrete paths.
- Links and redirects: `Link`, `redirect`, `useRouter` from `@/i18n/navigation` with unprefixed paths; `redirect({ href, locale: await getLocale() })` on the server.
- shadcn on Base UI: style links as buttons with `buttonVariants(...)` on `<Link>`; never `asChild`.
- Mobile first: tap targets at least 40px (`h-10`), pages work at 360px wide with no horizontal scroll; selects are native (`NativeSelect`, Task 8).
- Every list has an empty state: explanation + example + action (spec §5.3).
- `lib/calc` imports nothing from `next`, `react`, `@supabase/*`, or `@/lib/data`.
- No new runtime dependencies.
- Tests: `npm test` (unit), `npm run test:rls` (needs local Supabase), e2e against a production build: `npm run build && (npx next start -p 3100 &) && npx playwright test` (the dev server's manifest race makes random e2e tests fail). Existing e2e tests run in `id` (Playwright locale `id-ID`). Stop the server you started afterwards.
- Commit after each task with a conventional message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Rupiah amounts and counts typed with thousand separators ("15.000", "Rp 15.000", "15,000", "1.000.000") must be read as fifteen thousand / one million, never 15 or 1; decimals in Rupiah ("15.5") must be rejected, not rounded. — Tests in Task 1 and Task 7.
2. Changing a material's purchase unit to another dimension (kg → pcs) while a product's composition uses it must be rejected with a message; `lib/calc` must never see a mismatched row from the app. — Test in Task 14 (the guard itself is built in Task 10).
3. Deleting data that other data depends on: a material used in a composition is refused with "Dipakai di: <products>"; deleting a product removes its composition and prices and the dashboard updates. — Tests in Task 14 and Task 16.
4. A store with nothing filled in, no sales estimates, a price of 0, or only inactive products must render every number as a value or "—" with a hint — never `NaN`, `Infinity`, or a crash. — Tests in Task 5 and Task 16.
5. Long names (80 characters) and large amounts (Rp1.000.000.000) on a 360px phone must not cause horizontal scrolling on the lists or the dashboard table. — Tests in Task 10 and Task 16.

## Rulings (scope against spec §10)

- **Price in Phase 2, channels in Phase 3.** The spec's v1 success criterion and its e2e flow need "add product + price → dashboard shows profit", so Phase 2 lets the user set a price and a monthly sales estimate for every channel that exists (until Phase 3 that is only the default "Offline – Tunai" channel). Phase 3 adds the channel page and templates, competitor price input, channel-specific packaging rows (`channel_id`), and the price recommendation. `lib/calc` already handles `channel_id` rows and `competitor_price` (the warning `COMPETITOR_GAP`), because the data model has them.
- **Deferred `lib/calc` files.** `pricing.ts` (price recommendation, §4.2 item 9) moves to Phase 3 and `overrides.ts` (§4.4) to Phase 4, next to the UI that uses them.
- **Checklist.** The "Products" step is done when an active product has a composition **and** a price with a sales estimate above 0 (otherwise the dashboard cannot show profit). The "Online channels (optional)" step arrives with the channel page in Phase 3.
- **Navigation.** Phones: bottom nav Dashboard, Produk, Bahan, Lainnya (spec §5.2); "Lainnya" is a page linking Biaya, Inventaris, Pengaturan. Desktop sidebar lists every page.
- **Identifiers.** Code uses English names for the spec's formula terms: `materialCost` = hppBahan, `fullCost` = hppPenuh, `netPrice` = net, `contribution` = kontribusi, `grossRevenue` = omzetKotor, `netRevenue` = omzetBersih, `materialCosts` = biayaBahan, `grossProfit` = labaKotor, `netProfit` = labaBersih, `netMarginPct` = marginBersihPct, `avgContribution` = kontribusiRataRata, `bepUnitsMonthly`/`bepUnitsDaily` = bepUnitBulanan/bepUnitHarian, `totalCapital` = totalModal, `paybackMonths` = bulanBalikModal.

## File Structure

```
lib/calc/                     pure calculation module (spec §4)
  units.ts                    units, dimensions, toBase, sameDimension
  types.ts                    StoreData and entity types, enum value lists
  materials.ts                unitCost
  products.ts                 CalcError, mapById, rowsFor, materialCostPerUnit
  expenses.ts                 monthlyAmount, monthlyExpenses
  assets.ts                   assetValue, monthlyDepreciation, totalCapital
  metrics.ts                  computeMetrics, lineStatus, StoreMetrics
  warnings.ts                 computeWarnings, WARNING_CODES
  index.ts                    barrel + analyzeStore
lib/dashboard/checklist.ts    setupChecklist (pure)
lib/validation/
  number.ts                   + wholeNumber (Rupiah and counts)
  common.ts                   requiredName, MAX_AMOUNT, COMMON_VALIDATION_KEYS
  material.ts product.ts composition.ts price.ts expense.ts asset.ts
lib/data/
  store-data.ts               fetchStoreData(client, storeId) → StoreData | null
  load-store-data.ts          loadStoreData(storeId) (server-only, cached)
  revalidate.ts               revalidateStore()
lib/format.ts                 + formatNumber, formatRupiah
lib/forms.ts                  + rawValues
lib/nav.ts                    sidebar, bottom and "more" nav items
components/forms/
  native-select.tsx form-message.tsx use-remount-key.ts delete-button.tsx
app/[locale]/s/[storeId]/
  lainnya/page.tsx
  bahan/{page,actions,material-form}.tsx(.ts)  bahan/[materialId]/page.tsx
  biaya/{page,actions,expense-form}            biaya/[expenseId]/page.tsx
  inventaris/{page,actions,asset-form}         inventaris/[assetId]/page.tsx
  produk/{page,actions,product-form}           produk/[productId]/{page,composition-editor,price-panel}.tsx
  dashboard/page.tsx (rewritten)
tests/unit/calc/*.test.ts tests/unit/entity-validation.test.ts tests/unit/checklist.test.ts
tests/rls/store-data.test.ts
tests/e2e/{materials,expenses,assets,products,dashboard}.spec.ts
```

## Shared test fixture (used by Tasks 3–6)

All `lib/calc` tests build on one coffee-shop store whose numbers were calculated by hand:

| Item | Data | Derived |
|---|---|---|
| Store | margin target 40%, 26 days/month | |
| Kopi (bahan) | 1 kg, Rp150.000 | 150 / g |
| Susu (bahan) | 1 l, Rp20.000 | 20 / ml |
| Cup (kemasan) | 1 lusin, Rp6.000 | 500 / pcs |
| Bubble wrap (kemasan) | 100 pcs, Rp20.000 | 200 / pcs |
| Es Kopi Susu | yield 10; kopi 200 g batch; susu 1 l batch; cup 1 pcs unit; bubble 1 pcs unit **online only** | materialCost offline 5.000 + 500 = **5.500**; online **5.700** |
| Channels | offline 0% + Rp0; online 20% + Rp1.000 | |
| Prices | offline Rp18.000 × 300/month; online Rp20.000 × 100/month, competitor Rp18.000 | |
| Expenses | sewa Rp1.500.000 bulanan; listrik Rp600.000 tahunan | 1.500.000 + 50.000 = 1.550.000 |
| Assets | mesin 1 × Rp6.000.000, 60 months | depreciation 100.000; capital 6.000.000 |

Derived metrics: fixed costs 1.650.000; total units 400; overhead 4.125/unit; fullCost offline 9.625, online 9.825; netPrice offline 18.000, online 15.000; contribution offline 12.500, online 9.300; margin offline 46,527…% (green), online 25,875% (yellow); gross revenue 7.400.000; net revenue 6.900.000; material costs 2.220.000; gross profit 4.680.000; net profit 3.030.000; net margin 40,945…%; avg contribution 11.700; BEP 142 units/month, 6/day; payback 1,9801… months. Warnings: `NO_OWNER_SALARY`, `BELOW_TARGET` (online).

The fixture file is created in Task 3 (`tests/unit/calc/fixture.ts`).

---

### Task 1: Whole-number parsing and Rupiah formatting

**Files:**
- Modify: `lib/validation/number.ts`
- Modify: `lib/format.ts`
- Test: `tests/unit/number.test.ts` (create), `tests/unit/format.test.ts` (extend)

**Interfaces:**
- Produces: `wholeNumber<T extends z.ZodType>(inner: T)` — zod preprocess for Rupiah amounts and counts; `formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2): string`; `formatRupiah(value: number, locale: AppLocale, maximumFractionDigits = 0): string`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/number.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { localeNumber, wholeNumber } from "@/lib/validation/number";

const amount = wholeNumber(z.number({ error: "nan" }).int("int").min(0, "min"));

describe("wholeNumber", () => {
  it.each([
    ["15000", 15000],
    ["15.000", 15000],
    ["15,000", 15000],
    ["15 000", 15000],
    ["Rp 15.000", 15000],
    ["rp15.000", 15000],
    ["Rp. 1.000.000", 1000000],
    ["1.000.000", 1000000],
    [" 0 ", 0],
  ])("reads %j as %d", (input, expected) => {
    expect(amount.parse(input)).toBe(expected);
  });

  it.each(["15.5", "15,50", "1.5.000", "15.00", "-500", "abc", "1.000,5"])("rejects %j", (input) => {
    const result = amount.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("nan");
  });

  it("treats blank input as missing", () => {
    expect(amount.safeParse("  ").error?.issues[0].message).toBe("nan");
  });

  it("passes numbers through", () => {
    expect(amount.parse(42)).toBe(42);
  });
});

describe("localeNumber (unchanged behaviour)", () => {
  const qty = localeNumber(z.number());
  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1.000,5", 1000.5],
  ])("reads %j as %d", (input, expected) => {
    expect(qty.parse(input)).toBe(expected);
  });
});
```

Append to `tests/unit/format.test.ts` (keep the existing tests; add the import names to the existing import from `@/lib/format`):

```ts
describe("formatNumber", () => {
  it("uses the locale's separators", () => {
    expect(formatNumber(1234.5, "id")).toBe("1.234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
  });

  it("limits fraction digits", () => {
    expect(formatNumber(1.98019, "id", 1)).toBe("2");
    expect(formatNumber(22.2222, "en", 2)).toBe("22.22");
  });
});

describe("formatRupiah", () => {
  it.each([
    [15000, "id", "Rp15.000"],
    [15000, "en", "Rp15,000"],
    [1000000000, "id", "Rp1.000.000.000"],
    [-500, "id", "-Rp500"],
    [-0.4, "id", "Rp0"],
    [5499.6, "id", "Rp5.500"],
  ] as const)("formats %d in %s as %s", (value, locale, expected) => {
    expect(formatRupiah(value, locale)).toBe(expected);
  });

  it("shows decimals when asked (cost per gram)", () => {
    expect(formatRupiah(22.2222, "id", 2)).toBe("Rp22,22");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/number.test.ts tests/unit/format.test.ts`
Expected: FAIL — `wholeNumber`, `formatNumber`, `formatRupiah` are not exported.

- [ ] **Step 3: Implement**

Append to `lib/validation/number.ts`:

```ts
const THOUSANDS = [/^\d{1,3}(\.\d{3})+$/, /^\d{1,3}(,\d{3})+$/, /^\d{1,3}( \d{3})+$/];

/**
 * Parses whole numbers such as Rupiah amounts and counts: "15000", "15.000", "15,000",
 * "Rp 15.000" → 15000. Separators must group thousands (1–3 digits, then groups of 3), so
 * decimals ("15.5"), negatives, and mixed separators become NaN and `inner` reports its
 * number message. Blank input becomes undefined.
 */
export function wholeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const s = value.trim().replace(/^rp\.?\s*/i, "");
    if (s === "") return undefined;
    if (/^\d+$/.test(s)) return Number(s);
    if (THOUSANDS.some((pattern) => pattern.test(s))) return Number(s.replace(/[., ]/g, ""));
    return Number.NaN;
  }, inner);
}
```

Append to `lib/format.ts`:

```ts
export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits }).format(value);
}

/** Rupiah with the locale's separators: "Rp15.000" (id), "Rp15,000" (en). No sign on values that round to 0. */
export function formatRupiah(value: number, locale: AppLocale, maximumFractionDigits = 0): string {
  const amount = formatNumber(Math.abs(value), locale, maximumFractionDigits);
  const negative = value < 0 && /[1-9]/.test(amount);
  return `${negative ? "-" : ""}Rp${amount}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/number.test.ts tests/unit/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/number.ts lib/format.ts tests/unit/number.test.ts tests/unit/format.test.ts
git commit -m "feat(format): parse whole numbers with thousand separators; format Rupiah"
```

---

### Task 2: `lib/calc` units, types and material cost

**Files:**
- Create: `lib/calc/units.ts`, `lib/calc/types.ts`, `lib/calc/materials.ts`
- Test: `tests/unit/calc/units.test.ts`, `tests/unit/calc/materials.test.ts`

**Interfaces:**
- Produces (units.ts): `UNITS` (`readonly ["g","ons","kg","ml","l","pcs","lusin"]`), `type Unit`, `type Dimension = "mass" | "volume" | "count"`, `BASE_UNIT: Record<Dimension, Unit>`, `isUnit(value: string): value is Unit`, `dimensionOf(unit: Unit): Dimension`, `toBase(qty: number, unit: Unit): number`, `sameDimension(a: Unit, b: Unit): boolean`, `unitsOf(dimension: Dimension): Unit[]`.
- Produces (types.ts): `MATERIAL_CATEGORIES`, `EXPENSE_CATEGORIES`, `FREQUENCIES`, `ASSET_CATEGORIES`, `BASES` (const arrays) and their union types `MaterialCategory`, `ExpenseCategory`, `Frequency`, `AssetCategory`, `Basis`; entity types `CalcMaterial`, `CalcProduct`, `CalcCompositionRow`, `CalcChannel`, `CalcPrice`, `CalcExpense`, `CalcAsset`; `StoreData`.
- Produces (materials.ts): `unitCost(material: Pick<CalcMaterial, "purchaseQty" | "purchaseUnit" | "purchasePrice" | "wastePct">): number`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/calc/units.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BASE_UNIT, dimensionOf, isUnit, sameDimension, toBase, unitsOf } from "@/lib/calc/units";

describe("units", () => {
  it.each([
    [2, "g", 2],
    [3, "ons", 300],
    [1.5, "kg", 1500],
    [250, "ml", 250],
    [2, "l", 2000],
    [4, "pcs", 4],
    [2, "lusin", 24],
  ] as const)("toBase(%d, %s) = %d", (qty, unit, expected) => {
    expect(toBase(qty, unit)).toBe(expected);
  });

  it("knows dimensions", () => {
    expect(dimensionOf("ons")).toBe("mass");
    expect(dimensionOf("l")).toBe("volume");
    expect(dimensionOf("lusin")).toBe("count");
    expect(sameDimension("kg", "g")).toBe(true);
    expect(sameDimension("kg", "ml")).toBe(false);
    expect(sameDimension("pcs", "lusin")).toBe(true);
  });

  it("lists units of a dimension and base units", () => {
    expect(unitsOf("mass")).toEqual(["g", "ons", "kg"]);
    expect(unitsOf("volume")).toEqual(["ml", "l"]);
    expect(unitsOf("count")).toEqual(["pcs", "lusin"]);
    expect(BASE_UNIT).toEqual({ mass: "g", volume: "ml", count: "pcs" });
  });

  it("validates unit strings", () => {
    expect(isUnit("kg")).toBe(true);
    expect(isUnit("sdm")).toBe(false);
  });
});
```

`tests/unit/calc/materials.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { unitCost } from "@/lib/calc/materials";

describe("unitCost", () => {
  it.each([
    ["1 kg sugar Rp15.000", { purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 }, 15],
    ["2 ons Rp10.000", { purchaseQty: 2, purchaseUnit: "ons", purchasePrice: 10000, wastePct: 0 }, 50],
    ["1 l milk Rp20.000, 10% waste", { purchaseQty: 1, purchaseUnit: "l", purchasePrice: 20000, wastePct: 10 }, 20000 / 900],
    ["1 lusin cups Rp6.000", { purchaseQty: 1, purchaseUnit: "lusin", purchasePrice: 6000, wastePct: 0 }, 500],
    ["free sample", { purchaseQty: 5, purchaseUnit: "pcs", purchasePrice: 0, wastePct: 0 }, 0],
  ] as const)("%s", (_label, material, expected) => {
    expect(unitCost(material)).toBeCloseTo(expected, 6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/calc`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/calc/units.ts`:

```ts
export const UNITS = ["g", "ons", "kg", "ml", "l", "pcs", "lusin"] as const;
export type Unit = (typeof UNITS)[number];
export type Dimension = "mass" | "volume" | "count";

const UNIT_INFO: Record<Unit, { dimension: Dimension; toBase: number }> = {
  g: { dimension: "mass", toBase: 1 },
  ons: { dimension: "mass", toBase: 100 },
  kg: { dimension: "mass", toBase: 1000 },
  ml: { dimension: "volume", toBase: 1 },
  l: { dimension: "volume", toBase: 1000 },
  pcs: { dimension: "count", toBase: 1 },
  lusin: { dimension: "count", toBase: 12 },
};

/** The unit every quantity of a dimension is converted to: g, ml, pcs. */
export const BASE_UNIT: Record<Dimension, Unit> = { mass: "g", volume: "ml", count: "pcs" };

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export function dimensionOf(unit: Unit): Dimension {
  return UNIT_INFO[unit].dimension;
}

export function toBase(qty: number, unit: Unit): number {
  return qty * UNIT_INFO[unit].toBase;
}

export function sameDimension(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b);
}

export function unitsOf(dimension: Dimension): Unit[] {
  return UNITS.filter((unit) => dimensionOf(unit) === dimension);
}
```

`lib/calc/types.ts`:

```ts
import type { Unit } from "./units";

export const MATERIAL_CATEGORIES = ["bahan", "kemasan"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const EXPENSE_CATEGORIES = [
  "sewa",
  "listrik_air",
  "internet_pulsa",
  "gaji_karyawan",
  "gaji_pemilik",
  "transportasi",
  "pemasaran",
  "lainnya",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const FREQUENCIES = ["harian", "mingguan", "bulanan", "tahunan"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const ASSET_CATEGORIES = [
  "peralatan",
  "furnitur",
  "elektronik",
  "kendaraan",
  "renovasi",
  "perizinan",
  "lainnya",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** `batch` = amount for one recipe (divided by yield); `unit` = amount per sold unit. */
export const BASES = ["batch", "unit"] as const;
export type Basis = (typeof BASES)[number];

export type CalcMaterial = {
  id: string;
  name: string;
  category: MaterialCategory;
  purchaseQty: number;
  purchaseUnit: Unit;
  purchasePrice: number;
  wastePct: number;
};

export type CalcProduct = {
  id: string;
  name: string;
  /** Display only; not used in calculations. */
  category?: string | null;
  yieldQty: number;
  /** Overrides the store target when not null. */
  targetMarginPct: number | null;
  isActive: boolean;
};

export type CalcCompositionRow = {
  id: string;
  productId: string;
  materialId: string;
  qty: number;
  unit: Unit;
  basis: Basis;
  /** null = used in every channel. */
  channelId: string | null;
};

export type CalcChannel = { id: string; name: string; commissionPct: number; fixedFee: number };

export type CalcPrice = {
  productId: string;
  channelId: string;
  price: number;
  estMonthlySales: number;
  competitorPrice: number | null;
};

export type CalcExpense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
};

export type CalcAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  qty: number;
  unitPrice: number;
  usefulLifeMonths: number;
};

/** Everything the calculations need for one store (spec §4). */
export type StoreData = {
  store: { id: string; name: string; targetMarginPct: number; operatingDaysPerMonth: number };
  materials: CalcMaterial[];
  products: CalcProduct[];
  composition: CalcCompositionRow[];
  channels: CalcChannel[];
  prices: CalcPrice[];
  expenses: CalcExpense[];
  assets: CalcAsset[];
};
```

`lib/calc/materials.ts`:

```ts
import type { CalcMaterial } from "./types";
import { toBase } from "./units";

/** Cost per base unit (g, ml, pcs) after waste: price / (qty in base units × (1 − waste/100)). */
export function unitCost(
  material: Pick<CalcMaterial, "purchaseQty" | "purchaseUnit" | "purchasePrice" | "wastePct">,
): number {
  const usable = toBase(material.purchaseQty, material.purchaseUnit) * (1 - material.wastePct / 100);
  return material.purchasePrice / usable;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc tests/unit/calc
git commit -m "feat(calc): units, store data types, material cost per base unit"
```

---

### Task 3: Material cost per product unit (hppBahan)

**Files:**
- Create: `lib/calc/products.ts`, `tests/unit/calc/fixture.ts`
- Test: `tests/unit/calc/products.test.ts`

**Interfaces:**
- Consumes: Task 2 (`unitCost`, `toBase`, `sameDimension`, types).
- Produces: `class CalcError extends Error { code: "UNIT_DIMENSION_MISMATCH" | "UNKNOWN_MATERIAL"; productId: string; materialId: string }`; `mapById<T extends { id: string }>(items: T[]): Map<string, T>`; `rowsFor(composition: CalcCompositionRow[], productId: string, channelId: string): CalcCompositionRow[]`; `materialCostPerUnit(product: CalcProduct, composition: CalcCompositionRow[], materials: Map<string, CalcMaterial>, channelId: string): number`.
- Produces (fixture): `fixture(): StoreData` returning the shared coffee-shop store with ids `"kopi" | "susu" | "cup" | "bubble"` (materials), `"eskopi"` (product), `"offline" | "online"` (channels).

- [ ] **Step 1: Create the fixture**

`tests/unit/calc/fixture.ts`:

```ts
import type { StoreData } from "@/lib/calc/types";

/** The hand-calculated coffee-shop store described in the Phase 2 plan. Returns a fresh copy. */
export function fixture(): StoreData {
  return {
    store: { id: "store", name: "Kedai Kopi", targetMarginPct: 40, operatingDaysPerMonth: 26 },
    materials: [
      { id: "kopi", name: "Kopi", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 150000, wastePct: 0 },
      { id: "susu", name: "Susu", category: "bahan", purchaseQty: 1, purchaseUnit: "l", purchasePrice: 20000, wastePct: 0 },
      { id: "cup", name: "Cup", category: "kemasan", purchaseQty: 1, purchaseUnit: "lusin", purchasePrice: 6000, wastePct: 0 },
      { id: "bubble", name: "Bubble wrap", category: "kemasan", purchaseQty: 100, purchaseUnit: "pcs", purchasePrice: 20000, wastePct: 0 },
    ],
    products: [{ id: "eskopi", name: "Es Kopi Susu", yieldQty: 10, targetMarginPct: null, isActive: true }],
    composition: [
      { id: "r1", productId: "eskopi", materialId: "kopi", qty: 200, unit: "g", basis: "batch", channelId: null },
      { id: "r2", productId: "eskopi", materialId: "susu", qty: 1, unit: "l", basis: "batch", channelId: null },
      { id: "r3", productId: "eskopi", materialId: "cup", qty: 1, unit: "pcs", basis: "unit", channelId: null },
      { id: "r4", productId: "eskopi", materialId: "bubble", qty: 1, unit: "pcs", basis: "unit", channelId: "online" },
    ],
    channels: [
      { id: "offline", name: "Offline – Tunai", commissionPct: 0, fixedFee: 0 },
      { id: "online", name: "GoFood", commissionPct: 20, fixedFee: 1000 },
    ],
    prices: [
      { productId: "eskopi", channelId: "offline", price: 18000, estMonthlySales: 300, competitorPrice: null },
      { productId: "eskopi", channelId: "online", price: 20000, estMonthlySales: 100, competitorPrice: 18000 },
    ],
    expenses: [
      { id: "e1", name: "Sewa kios", category: "sewa", amount: 1500000, frequency: "bulanan" },
      { id: "e2", name: "Listrik", category: "listrik_air", amount: 600000, frequency: "tahunan" },
    ],
    assets: [{ id: "a1", name: "Mesin kopi", category: "peralatan", qty: 1, unitPrice: 6000000, usefulLifeMonths: 60 }],
  };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/calc/products.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CalcError, mapById, materialCostPerUnit, rowsFor } from "@/lib/calc/products";
import { fixture } from "./fixture";

function costFor(channelId: string, data = fixture()) {
  return materialCostPerUnit(data.products[0], data.composition, mapById(data.materials), channelId);
}

describe("materialCostPerUnit", () => {
  it("splits batch rows by yield and adds per-unit rows", () => {
    // (200 g × 150 + 1000 ml × 20) / 10 + 1 × 500
    expect(costFor("offline")).toBeCloseTo(5500, 6);
  });

  it("adds channel-specific rows only for that channel", () => {
    expect(costFor("online")).toBeCloseTo(5700, 6);
  });

  it("converts the row unit to the material's base unit", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], qty: 0.2, unit: "kg" };
    expect(costFor("offline", data)).toBeCloseTo(5500, 6);
  });

  it("is 0 for a product without composition", () => {
    const data = fixture();
    data.composition = [];
    expect(costFor("offline", data)).toBe(0);
  });

  it("throws a structured error for a unit in another dimension", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    try {
      costFor("offline", data);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(CalcError);
      expect(error).toMatchObject({ code: "UNIT_DIMENSION_MISMATCH", productId: "eskopi", materialId: "kopi" });
    }
  });

  it("throws a structured error for a missing material", () => {
    const data = fixture();
    data.materials = data.materials.filter((m) => m.id !== "susu");
    expect(() => costFor("offline", data)).toThrow(expect.objectContaining({ code: "UNKNOWN_MATERIAL", materialId: "susu" }));
  });
});

describe("rowsFor", () => {
  it("keeps shared rows plus the channel's own rows", () => {
    const { composition } = fixture();
    expect(rowsFor(composition, "eskopi", "offline").map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(rowsFor(composition, "eskopi", "online").map((r) => r.id)).toEqual(["r1", "r2", "r3", "r4"]);
    expect(rowsFor(composition, "other", "offline")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/calc/products.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`lib/calc/products.ts`:

```ts
import { unitCost } from "./materials";
import type { CalcCompositionRow, CalcMaterial, CalcProduct } from "./types";
import { sameDimension, toBase } from "./units";

export type CalcErrorCode = "UNIT_DIMENSION_MISMATCH" | "UNKNOWN_MATERIAL";

/** Data the app should never have saved; thrown instead of calculating silently (spec §4.2 item 2). */
export class CalcError extends Error {
  constructor(
    readonly code: CalcErrorCode,
    readonly productId: string,
    readonly materialId: string,
  ) {
    super(`${code}: product ${productId}, material ${materialId}`);
    this.name = "CalcError";
  }
}

export function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Composition rows of a product that apply to a channel: shared rows plus that channel's own rows. */
export function rowsFor(composition: CalcCompositionRow[], productId: string, channelId: string): CalcCompositionRow[] {
  return composition.filter(
    (row) => row.productId === productId && (row.channelId === null || row.channelId === channelId),
  );
}

/** hppBahan: material and packaging cost of one product unit sold through `channelId`. */
export function materialCostPerUnit(
  product: CalcProduct,
  composition: CalcCompositionRow[],
  materials: Map<string, CalcMaterial>,
  channelId: string,
): number {
  let batch = 0;
  let perUnit = 0;
  for (const row of rowsFor(composition, product.id, channelId)) {
    const material = materials.get(row.materialId);
    if (!material) throw new CalcError("UNKNOWN_MATERIAL", product.id, row.materialId);
    if (!sameDimension(row.unit, material.purchaseUnit)) {
      throw new CalcError("UNIT_DIMENSION_MISMATCH", product.id, row.materialId);
    }
    const cost = toBase(row.qty, row.unit) * unitCost(material);
    if (row.basis === "batch") batch += cost;
    else perUnit += cost;
  }
  return batch / product.yieldQty + perUnit;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/calc/products.ts tests/unit/calc
git commit -m "feat(calc): material cost per product unit with batch/unit basis and channel rows"
```

---

### Task 4: Operating costs and assets

**Files:**
- Create: `lib/calc/expenses.ts`, `lib/calc/assets.ts`
- Test: `tests/unit/calc/expenses.test.ts`, `tests/unit/calc/assets.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces: `monthlyAmount(expense: Pick<CalcExpense, "amount" | "frequency">, operatingDaysPerMonth: number): number`; `monthlyExpenses(expenses: CalcExpense[], operatingDaysPerMonth: number): number`; `assetValue(asset: Pick<CalcAsset, "qty" | "unitPrice">): number`; `assetMonthlyDepreciation(asset: Pick<CalcAsset, "qty" | "unitPrice" | "usefulLifeMonths">): number`; `monthlyDepreciation(assets: CalcAsset[]): number`; `totalCapital(assets: CalcAsset[]): number`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/calc/expenses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { monthlyAmount, monthlyExpenses } from "@/lib/calc/expenses";
import { fixture } from "./fixture";

describe("monthlyAmount", () => {
  it.each([
    ["harian", 10000, 260000],
    ["mingguan", 12000, 52000],
    ["bulanan", 1500000, 1500000],
    ["tahunan", 600000, 50000],
  ] as const)("%s Rp%d → Rp%d per month (26 days)", (frequency, amount, expected) => {
    expect(monthlyAmount({ amount, frequency }, 26)).toBeCloseTo(expected, 6);
  });

  it("uses the store's operating days for daily costs", () => {
    expect(monthlyAmount({ amount: 10000, frequency: "harian" }, 30)).toBe(300000);
  });
});

describe("monthlyExpenses", () => {
  it("sums normalized costs", () => {
    expect(monthlyExpenses(fixture().expenses, 26)).toBeCloseTo(1550000, 6);
  });

  it("is 0 without costs", () => {
    expect(monthlyExpenses([], 26)).toBe(0);
  });
});
```

`tests/unit/calc/assets.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assetMonthlyDepreciation, assetValue, monthlyDepreciation, totalCapital } from "@/lib/calc/assets";
import type { CalcAsset } from "@/lib/calc/types";

const assets: CalcAsset[] = [
  { id: "a", name: "Meja", category: "furnitur", qty: 2, unitPrice: 1200000, usefulLifeMonths: 24 },
  { id: "b", name: "Freezer", category: "elektronik", qty: 1, unitPrice: 6000000, usefulLifeMonths: 60 },
];

describe("assets", () => {
  it("values an asset as qty × unit price", () => {
    expect(assetValue(assets[0])).toBe(2400000);
  });

  it("depreciates each asset evenly over its life", () => {
    expect(assetMonthlyDepreciation(assets[0])).toBe(100000);
    expect(monthlyDepreciation(assets)).toBe(200000);
  });

  it("totals the capital", () => {
    expect(totalCapital(assets)).toBe(8400000);
  });

  it("is 0 without assets", () => {
    expect(monthlyDepreciation([])).toBe(0);
    expect(totalCapital([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/calc`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/calc/expenses.ts`:

```ts
import type { CalcExpense } from "./types";

/** Normalizes a cost to one month: daily × open days, weekly × 52/12, yearly / 12. */
export function monthlyAmount(expense: Pick<CalcExpense, "amount" | "frequency">, operatingDaysPerMonth: number): number {
  switch (expense.frequency) {
    case "harian":
      return expense.amount * operatingDaysPerMonth;
    case "mingguan":
      return (expense.amount * 52) / 12;
    case "bulanan":
      return expense.amount;
    case "tahunan":
      return expense.amount / 12;
  }
}

export function monthlyExpenses(expenses: CalcExpense[], operatingDaysPerMonth: number): number {
  return expenses.reduce((sum, expense) => sum + monthlyAmount(expense, operatingDaysPerMonth), 0);
}
```

`lib/calc/assets.ts`:

```ts
import type { CalcAsset } from "./types";

export function assetValue(asset: Pick<CalcAsset, "qty" | "unitPrice">): number {
  return asset.qty * asset.unitPrice;
}

export function assetMonthlyDepreciation(asset: Pick<CalcAsset, "qty" | "unitPrice" | "usefulLifeMonths">): number {
  return assetValue(asset) / asset.usefulLifeMonths;
}

/** Straight-line depreciation of all assets per month (spec §4.2 item 3). */
export function monthlyDepreciation(assets: CalcAsset[]): number {
  return assets.reduce((sum, asset) => sum + assetMonthlyDepreciation(asset), 0);
}

/** Initial capital for the payback period (spec §3.6). */
export function totalCapital(assets: CalcAsset[]): number {
  return assets.reduce((sum, asset) => sum + assetValue(asset), 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/expenses.ts lib/calc/assets.ts tests/unit/calc
git commit -m "feat(calc): monthly operating costs, depreciation and capital"
```

---

### Task 5: Store metrics and line status

**Files:**
- Create: `lib/calc/metrics.ts`
- Test: `tests/unit/calc/metrics.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  ```ts
  export type LineStatus = "red" | "yellow" | "green";
  export type MetricsLine = {
    productId: string; channelId: string;
    price: number; estMonthlySales: number; competitorPrice: number | null;
    materialCost: number; fullCost: number | null; netPrice: number; contribution: number;
    marginPct: number | null; targetMarginPct: number; status: LineStatus;
  };
  export type StoreMetrics = {
    lines: MetricsLine[]; productsWithoutPrice: string[];
    fixedCosts: { expenses: number; depreciation: number; total: number };
    totalUnits: number; overheadPerUnit: number | null;
    grossRevenue: number; netRevenue: number; materialCosts: number; grossProfit: number; netProfit: number;
    netMarginPct: number | null; avgContribution: number | null;
    bepUnitsMonthly: number | null; bepUnitsDaily: number | null;
    totalCapital: number; paybackMonths: number | null;
  };
  export function lineStatus(contribution: number, marginPct: number | null, targetMarginPct: number): LineStatus;
  export function computeMetrics(data: StoreData): StoreMetrics;
  ```
  Lines exist only for price rows of **active** products whose channel exists, in the order of `data.prices`. `productsWithoutPrice` = ids of active products with no such line, in `data.products` order.

- [ ] **Step 1: Write the failing tests**

`tests/unit/calc/metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeMetrics, lineStatus } from "@/lib/calc/metrics";
import { fixture } from "./fixture";

/** Every number anywhere in a value (JSON.stringify would hide NaN as null). */
function allNumbers(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(allNumbers);
  return [];
}

function line(metrics: ReturnType<typeof computeMetrics>, channelId: string) {
  const found = metrics.lines.find((l) => l.channelId === channelId);
  if (!found) throw new Error(`no line for ${channelId}`);
  return found;
}

describe("computeMetrics — the coffee-shop fixture", () => {
  const m = computeMetrics(fixture());

  it("computes fixed costs, total units and overhead", () => {
    expect(m.fixedCosts.expenses).toBeCloseTo(1550000, 6);
    expect(m.fixedCosts.depreciation).toBeCloseTo(100000, 6);
    expect(m.fixedCosts.total).toBeCloseTo(1650000, 6);
    expect(m.totalUnits).toBe(400);
    expect(m.overheadPerUnit).toBeCloseTo(4125, 6);
  });

  it("computes each product-channel line", () => {
    expect(line(m, "offline")).toMatchObject({ price: 18000, estMonthlySales: 300, status: "green", targetMarginPct: 40 });
    expect(line(m, "offline").materialCost).toBeCloseTo(5500, 6);
    expect(line(m, "offline").fullCost).toBeCloseTo(9625, 6);
    expect(line(m, "offline").netPrice).toBeCloseTo(18000, 6);
    expect(line(m, "offline").contribution).toBeCloseTo(12500, 6);
    expect(line(m, "offline").marginPct).toBeCloseTo((8375 / 18000) * 100, 6);

    expect(line(m, "online")).toMatchObject({ status: "yellow", competitorPrice: 18000 });
    expect(line(m, "online").materialCost).toBeCloseTo(5700, 6);
    expect(line(m, "online").fullCost).toBeCloseTo(9825, 6);
    expect(line(m, "online").netPrice).toBeCloseTo(15000, 6);
    expect(line(m, "online").contribution).toBeCloseTo(9300, 6);
    expect(line(m, "online").marginPct).toBeCloseTo(25.875, 6);
  });

  it("computes monthly totals", () => {
    expect(m.grossRevenue).toBeCloseTo(7400000, 6);
    expect(m.netRevenue).toBeCloseTo(6900000, 6);
    expect(m.materialCosts).toBeCloseTo(2220000, 6);
    expect(m.grossProfit).toBeCloseTo(4680000, 6);
    expect(m.netProfit).toBeCloseTo(3030000, 6);
    expect(m.netMarginPct).toBeCloseTo((3030000 / 7400000) * 100, 6);
  });

  it("computes break-even and payback", () => {
    expect(m.avgContribution).toBeCloseTo(11700, 6);
    expect(m.bepUnitsMonthly).toBe(142);
    expect(m.bepUnitsDaily).toBe(6);
    expect(m.totalCapital).toBe(6000000);
    expect(m.paybackMonths).toBeCloseTo(6000000 / 3030000, 6);
    expect(m.productsWithoutPrice).toEqual([]);
  });
});

describe("computeMetrics — edge cases", () => {
  it("without sales estimates: no overhead, BEP, or margin from revenue; nothing is NaN", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    const m = computeMetrics(data);
    expect(m.totalUnits).toBe(0);
    expect(m.overheadPerUnit).toBeNull();
    expect(m.lines.every((l) => l.fullCost === null)).toBe(true);
    expect(line(m, "offline").marginPct).toBeCloseTo((12500 / 18000) * 100, 6); // falls back to materialCost
    expect(m.grossRevenue).toBe(0);
    expect(m.netMarginPct).toBeNull();
    expect(m.avgContribution).toBeNull();
    expect(m.bepUnitsMonthly).toBeNull();
    expect(m.bepUnitsDaily).toBeNull();
    expect(m.netProfit).toBeCloseTo(-1650000, 6);
    expect(m.paybackMonths).toBeNull();
    expect(allNumbers(m).every(Number.isFinite)).toBe(true);
  });

  it("an empty store gives zeros and nulls", () => {
    const m = computeMetrics({ ...fixture(), materials: [], products: [], composition: [], prices: [], expenses: [], assets: [] });
    expect(m).toMatchObject({
      lines: [],
      productsWithoutPrice: [],
      totalUnits: 0,
      overheadPerUnit: null,
      grossRevenue: 0,
      netProfit: 0,
      netMarginPct: null,
      avgContribution: null,
      bepUnitsMonthly: null,
      totalCapital: 0,
      paybackMonths: null,
    });
  });

  it("break-even is null when every sale loses money", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, price: 5000 }));
    const m = computeMetrics(data);
    expect(m.avgContribution).toBeLessThan(0);
    expect(m.bepUnitsMonthly).toBeNull();
    expect(m.bepUnitsDaily).toBeNull();
  });

  it("break-even is 0 without fixed costs", () => {
    const data = fixture();
    data.expenses = [];
    data.assets = [];
    expect(computeMetrics(data).bepUnitsMonthly).toBe(0);
  });

  it("does not round an exact break-even up because of floating point", () => {
    const data = fixture();
    data.expenses = [{ id: "e", name: "Sewa", category: "sewa", amount: 1170000, frequency: "bulanan" }];
    data.assets = [];
    expect(computeMetrics(data).bepUnitsMonthly).toBe(100); // 1.170.000 / 11.700
  });

  it("leaves inactive products out of lines and totals", () => {
    const data = fixture();
    data.products = [...data.products, { id: "old", name: "Lama", yieldQty: 1, targetMarginPct: null, isActive: false }];
    data.prices = [...data.prices, { productId: "old", channelId: "offline", price: 1000, estMonthlySales: 999, competitorPrice: null }];
    const m = computeMetrics(data);
    expect(m.lines).toHaveLength(2);
    expect(m.totalUnits).toBe(400);
    expect(m.productsWithoutPrice).toEqual([]);
  });

  it("lists active products without a price", () => {
    const data = fixture();
    data.products = [...data.products, { id: "baru", name: "Baru", yieldQty: 1, targetMarginPct: null, isActive: true }];
    expect(computeMetrics(data).productsWithoutPrice).toEqual(["baru"]);
  });

  it("a price of 0 has no margin and is red when it loses money", () => {
    const data = fixture();
    data.prices[0] = { ...data.prices[0], price: 0 };
    const offline = line(computeMetrics(data), "offline");
    expect(offline.marginPct).toBeNull();
    expect(offline.status).toBe("red");
  });

  it("uses the product's own target margin", () => {
    const data = fixture();
    data.products[0] = { ...data.products[0], targetMarginPct: 20 };
    const online = line(computeMetrics(data), "online");
    expect(online.targetMarginPct).toBe(20);
    expect(online.status).toBe("green");
  });
});

describe("lineStatus", () => {
  it.each([
    [-1, 50, 40, "red"],
    [0, 40, 40, "green"],
    [100, 39.9, 40, "yellow"],
    [100, null, 40, "yellow"],
    [0, null, 40, "yellow"],
  ] as const)("contribution %d, margin %s, target %d → %s", (contribution, margin, target, expected) => {
    expect(lineStatus(contribution, margin, target)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/calc/metrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`lib/calc/metrics.ts`:

```ts
import { monthlyDepreciation, totalCapital } from "./assets";
import { monthlyExpenses } from "./expenses";
import { mapById, materialCostPerUnit } from "./products";
import type { StoreData } from "./types";

export type LineStatus = "red" | "yellow" | "green";

/** One product sold through one channel (spec §4.2 items 2, 4, 5 and §4.3). */
export type MetricsLine = {
  productId: string;
  channelId: string;
  price: number;
  estMonthlySales: number;
  competitorPrice: number | null;
  /** hppBahan */
  materialCost: number;
  /** hppPenuh: materialCost + overhead; null when there are no sales estimates. */
  fullCost: number | null;
  /** net: price after commission and fixed fee. */
  netPrice: number;
  /** kontribusi: netPrice − materialCost. */
  contribution: number;
  /** (netPrice − (fullCost ?? materialCost)) / price × 100; null when the price is 0. */
  marginPct: number | null;
  targetMarginPct: number;
  status: LineStatus;
};

export type StoreMetrics = {
  lines: MetricsLine[];
  /** Active products that have no price in any channel yet. */
  productsWithoutPrice: string[];
  fixedCosts: { expenses: number; depreciation: number; total: number };
  totalUnits: number;
  overheadPerUnit: number | null;
  grossRevenue: number;
  netRevenue: number;
  materialCosts: number;
  grossProfit: number;
  netProfit: number;
  netMarginPct: number | null;
  avgContribution: number | null;
  bepUnitsMonthly: number | null;
  bepUnitsDaily: number | null;
  totalCapital: number;
  paybackMonths: number | null;
};

/** Rounds up, ignoring floating-point noise just above a whole number (141.0000000001 → 141). */
function ceilUnits(value: number): number {
  return Math.ceil(value - 1e-9);
}

export function lineStatus(contribution: number, marginPct: number | null, targetMarginPct: number): LineStatus {
  if (contribution < 0) return "red";
  if (marginPct === null || marginPct < targetMarginPct) return "yellow";
  return "green";
}

export function computeMetrics(data: StoreData): StoreMetrics {
  const days = data.store.operatingDaysPerMonth;
  const materials = mapById(data.materials);
  const channels = mapById(data.channels);
  const activeProducts = data.products.filter((product) => product.isActive);
  const products = mapById(activeProducts);
  const priceRows = data.prices.filter((row) => products.has(row.productId) && channels.has(row.channelId));

  const expenses = monthlyExpenses(data.expenses, days);
  const depreciation = monthlyDepreciation(data.assets);
  const fixedTotal = expenses + depreciation;
  const totalUnits = priceRows.reduce((sum, row) => sum + row.estMonthlySales, 0);
  const overheadPerUnit = totalUnits > 0 ? fixedTotal / totalUnits : null;

  const lines: MetricsLine[] = priceRows.map((row) => {
    const product = products.get(row.productId)!;
    const channel = channels.get(row.channelId)!;
    const materialCost = materialCostPerUnit(product, data.composition, materials, channel.id);
    const fullCost = overheadPerUnit === null ? null : materialCost + overheadPerUnit;
    const netPrice = row.price * (1 - channel.commissionPct / 100) - channel.fixedFee;
    const contribution = netPrice - materialCost;
    const marginPct = row.price > 0 ? ((netPrice - (fullCost ?? materialCost)) / row.price) * 100 : null;
    const targetMarginPct = product.targetMarginPct ?? data.store.targetMarginPct;
    return {
      productId: row.productId,
      channelId: row.channelId,
      price: row.price,
      estMonthlySales: row.estMonthlySales,
      competitorPrice: row.competitorPrice,
      materialCost,
      fullCost,
      netPrice,
      contribution,
      marginPct,
      targetMarginPct,
      status: lineStatus(contribution, marginPct, targetMarginPct),
    };
  });

  const sum = (pick: (line: MetricsLine) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const grossRevenue = sum((l) => l.price * l.estMonthlySales);
  const netRevenue = sum((l) => l.netPrice * l.estMonthlySales);
  const materialCosts = sum((l) => l.materialCost * l.estMonthlySales);
  const grossProfit = netRevenue - materialCosts;
  const netProfit = grossProfit - fixedTotal;
  const avgContribution = totalUnits > 0 ? sum((l) => l.contribution * l.estMonthlySales) / totalUnits : null;
  const bepUnitsMonthly = avgContribution !== null && avgContribution > 0 ? ceilUnits(fixedTotal / avgContribution) : null;
  const capital = totalCapital(data.assets);

  return {
    lines,
    productsWithoutPrice: activeProducts
      .filter((product) => !lines.some((line) => line.productId === product.id))
      .map((product) => product.id),
    fixedCosts: { expenses, depreciation, total: fixedTotal },
    totalUnits,
    overheadPerUnit,
    grossRevenue,
    netRevenue,
    materialCosts,
    grossProfit,
    netProfit,
    netMarginPct: grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : null,
    avgContribution,
    bepUnitsMonthly,
    bepUnitsDaily: bepUnitsMonthly === null ? null : ceilUnits(bepUnitsMonthly / days),
    totalCapital: capital,
    paybackMonths: netProfit > 0 ? capital / netProfit : null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc/metrics.ts tests/unit/calc/metrics.test.ts
git commit -m "feat(calc): store metrics, break-even, payback and line status"
```

---

### Task 6: Warnings and the `lib/calc` entry point

**Files:**
- Create: `lib/calc/warnings.ts`, `lib/calc/index.ts`
- Test: `tests/unit/calc/warnings.test.ts`

**Interfaces:**
- Consumes: Task 5.
- Produces: `WARNING_CODES` = `["NET_LOSS","LOSS_PRODUCTS","NEGATIVE_CONTRIBUTION","NO_OWNER_SALARY","BELOW_TARGET","COMPETITOR_GAP","NO_SALES_ESTIMATE"] as const` (display order, most serious first); `type WarningCode`; `type LineRef = { productId: string; channelId: string }`; `type StoreWarning = { code: WarningCode; lines: LineRef[] }`; `COMPETITOR_GAP_RATIO = 0.25`; `computeWarnings(data: StoreData, metrics: StoreMetrics): StoreWarning[]`; from `@/lib/calc`: everything above plus `type StoreAnalysis = StoreMetrics & { warnings: StoreWarning[] }` and `analyzeStore(data: StoreData): StoreAnalysis`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/calc/warnings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyzeStore, type StoreData } from "@/lib/calc";
import { fixture } from "./fixture";

const codes = (data: StoreData) => analyzeStore(data).warnings.map((w) => w.code);

describe("warnings", () => {
  it("flags the fixture: no owner salary, online below target", () => {
    expect(analyzeStore(fixture()).warnings).toEqual([
      { code: "NO_OWNER_SALARY", lines: [] },
      { code: "BELOW_TARGET", lines: [{ productId: "eskopi", channelId: "online" }] },
    ]);
  });

  it("NO_OWNER_SALARY disappears once the owner's salary is a cost", () => {
    const data = fixture();
    data.expenses.push({ id: "e3", name: "Gaji saya", category: "gaji_pemilik", amount: 100000, frequency: "bulanan" });
    expect(codes(data)).not.toContain("NO_OWNER_SALARY");
  });

  it("NET_LOSS when fixed costs exceed gross profit", () => {
    const data = fixture();
    data.expenses[0] = { ...data.expenses[0], amount: 10000000 };
    expect(codes(data)[0]).toBe("NET_LOSS");
  });

  it("LOSS_PRODUCTS lists the red lines", () => {
    const data = fixture();
    data.prices[0] = { ...data.prices[0], price: 5000 };
    const warning = analyzeStore(data).warnings.find((w) => w.code === "LOSS_PRODUCTS");
    expect(warning?.lines).toEqual([{ productId: "eskopi", channelId: "offline" }]);
  });

  it("NEGATIVE_CONTRIBUTION when sales lose money on average", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, price: 5000 }));
    expect(codes(data)).toEqual(expect.arrayContaining(["NET_LOSS", "LOSS_PRODUCTS", "NEGATIVE_CONTRIBUTION"]));
  });

  it("COMPETITOR_GAP above 25% difference, not at exactly 25%", () => {
    const far = fixture();
    far.prices[1] = { ...far.prices[1], competitorPrice: 12000 };
    expect(codes(far)).toContain("COMPETITOR_GAP");

    const edge = fixture();
    edge.prices[1] = { ...edge.prices[1], competitorPrice: 16000 };
    expect(codes(edge)).not.toContain("COMPETITOR_GAP");

    const zero = fixture();
    zero.prices[1] = { ...zero.prices[1], competitorPrice: 0 };
    expect(codes(zero)).not.toContain("COMPETITOR_GAP");
  });

  it("NO_SALES_ESTIMATE when nothing is expected to sell", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    expect(codes(data)).toContain("NO_SALES_ESTIMATE");
  });

  it("keeps the documented order", () => {
    const data = fixture();
    data.prices = data.prices.map((p) => ({ ...p, price: 5000, competitorPrice: 20000 }));
    expect(codes(data)).toEqual(["NET_LOSS", "LOSS_PRODUCTS", "NEGATIVE_CONTRIBUTION", "NO_OWNER_SALARY", "COMPETITOR_GAP"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/calc/warnings.test.ts`
Expected: FAIL — `@/lib/calc` not found.

- [ ] **Step 3: Implement**

`lib/calc/warnings.ts`:

```ts
import type { MetricsLine, StoreMetrics } from "./metrics";
import type { StoreData } from "./types";

/** Display order: most serious first. */
export const WARNING_CODES = [
  "NET_LOSS",
  "LOSS_PRODUCTS",
  "NEGATIVE_CONTRIBUTION",
  "NO_OWNER_SALARY",
  "BELOW_TARGET",
  "COMPETITOR_GAP",
  "NO_SALES_ESTIMATE",
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export type LineRef = { productId: string; channelId: string };
export type StoreWarning = { code: WarningCode; lines: LineRef[] };

/** Price differs from the competitor's by more than this share of the competitor price. */
export const COMPETITOR_GAP_RATIO = 0.25;

const ref = (line: MetricsLine): LineRef => ({ productId: line.productId, channelId: line.channelId });

export function computeWarnings(data: StoreData, metrics: StoreMetrics): StoreWarning[] {
  const red = metrics.lines.filter((line) => line.status === "red").map(ref);
  const yellow = metrics.lines.filter((line) => line.status === "yellow").map(ref);
  const gaps = metrics.lines
    .filter(
      (line) =>
        line.competitorPrice !== null &&
        line.competitorPrice > 0 &&
        Math.abs(line.price - line.competitorPrice) / line.competitorPrice > COMPETITOR_GAP_RATIO,
    )
    .map(ref);

  const active: Record<WarningCode, LineRef[] | false> = {
    NET_LOSS: metrics.netProfit < 0 && [],
    LOSS_PRODUCTS: red.length > 0 && red,
    NEGATIVE_CONTRIBUTION: metrics.avgContribution !== null && metrics.avgContribution <= 0 && [],
    NO_OWNER_SALARY: !data.expenses.some((expense) => expense.category === "gaji_pemilik") && [],
    BELOW_TARGET: yellow.length > 0 && yellow,
    COMPETITOR_GAP: gaps.length > 0 && gaps,
    NO_SALES_ESTIMATE: metrics.totalUnits === 0 && [],
  };
  return WARNING_CODES.flatMap((code) => {
    const lines = active[code];
    return lines === false ? [] : [{ code, lines }];
  });
}
```

`lib/calc/index.ts`:

```ts
import { computeMetrics, type StoreMetrics } from "./metrics";
import type { StoreData } from "./types";
import { computeWarnings, type StoreWarning } from "./warnings";

export * from "./assets";
export * from "./expenses";
export * from "./materials";
export * from "./metrics";
export * from "./products";
export * from "./types";
export * from "./units";
export * from "./warnings";

export type StoreAnalysis = StoreMetrics & { warnings: StoreWarning[] };

/** Metrics plus warnings for one store; throws CalcError on data the app should never have saved. */
export function analyzeStore(data: StoreData): StoreAnalysis {
  const metrics = computeMetrics(data);
  return { ...metrics, warnings: computeWarnings(data, metrics) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/calc tests/unit/calc/warnings.test.ts
git commit -m "feat(calc): deterministic store warnings and analyzeStore entry point"
```

---

### Task 7: Entity validation schemas

**Files:**
- Create: `lib/validation/common.ts`, `lib/validation/material.ts`, `lib/validation/product.ts`, `lib/validation/composition.ts`, `lib/validation/price.ts`, `lib/validation/expense.ts`, `lib/validation/asset.ts`
- Modify: `messages/id.json`, `messages/en.json` (add groups under `Validation`), `tests/unit/messages.test.ts`
- Test: `tests/unit/entity-validation.test.ts`

**Interfaces:**
- Consumes: Task 1 `wholeNumber`, existing `localeNumber`; Task 2 `UNITS`, `MATERIAL_CATEGORIES`, `BASES`, `EXPENSE_CATEGORIES`, `FREQUENCIES`, `ASSET_CATEGORIES`, `sameDimension`, `type Unit`; `isUuid` from `@/lib/uuid`.
- Produces (each schema parses raw `FormData` entries; keys are `Validation.<group>.<name>`):
  - common: `MAX_AMOUNT = 2_000_000_000`, `COMMON_VALIDATION_KEYS`, `requiredName(group: string, max: number)`.
  - material: `materialInputSchema` → `{ name, category, purchaseQty, purchaseUnit, purchasePrice, wastePct }`; `type MaterialInput`; `toMaterialColumns(input)` → `{ name, category, purchase_qty, purchase_unit, purchase_price, waste_pct }`; `MATERIAL_UNIT_IN_USE_KEY = "material.unitInUse"`; `MATERIAL_VALIDATION_KEYS`.
  - product: `productInputSchema` → `{ name, category: string | null, yieldQty, targetMarginPct: number | null, isActive: boolean }`; `toProductColumns(input)` → `{ name, category, yield_qty, target_margin_pct, is_active }`; `PRODUCT_VALIDATION_KEYS`.
  - composition: `compositionInputSchema` → `{ materialId, qty, unit, basis }`; `toCompositionColumns(input)` → `{ material_id, qty, unit, basis }`; `COMPOSITION_UNIT_MISMATCH_KEY = "composition.unitDimension"`; `compositionUnitError(materialUnit: Unit, unit: Unit): string | null`; `COMPOSITION_VALIDATION_KEYS`.
  - price: `priceInputSchema` → `{ price, estMonthlySales }`; `toPriceColumns(input)` → `{ price, est_monthly_sales }`; `PRICE_VALIDATION_KEYS`.
  - expense: `expenseInputSchema` → `{ name, category, amount, frequency }`; `toExpenseColumns(input)`; `EXPENSE_VALIDATION_KEYS`.
  - asset: `assetInputSchema` → `{ name, category, qty, unitPrice, usefulLifeMonths }`; `toAssetColumns(input)` → `{ name, category, qty, unit_price, useful_life_months }`; `ASSET_VALIDATION_KEYS`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/entity-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { assetInputSchema, toAssetColumns } from "@/lib/validation/asset";
import { compositionInputSchema, compositionUnitError } from "@/lib/validation/composition";
import { expenseInputSchema, toExpenseColumns } from "@/lib/validation/expense";
import { materialInputSchema, toMaterialColumns } from "@/lib/validation/material";
import { priceInputSchema } from "@/lib/validation/price";
import { productInputSchema, toProductColumns } from "@/lib/validation/product";

function errorsFor(schema: z.ZodType, input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

const material = { name: " Gula pasir ", category: "bahan", purchaseQty: "1", purchaseUnit: "kg", purchasePrice: "15.000", wastePct: "" };

describe("materialInputSchema", () => {
  it("parses a form with a thousand-separated price and blank waste", () => {
    const parsed = materialInputSchema.parse(material);
    expect(parsed).toEqual({ name: "Gula pasir", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 0 });
    expect(toMaterialColumns(parsed)).toEqual({
      name: "Gula pasir",
      category: "bahan",
      purchase_qty: 1,
      purchase_unit: "kg",
      purchase_price: 15000,
      waste_pct: 0,
    });
  });

  it("accepts decimal quantities and waste with a comma", () => {
    expect(materialInputSchema.parse({ ...material, purchaseQty: "2,5", wastePct: "12,5" })).toMatchObject({ purchaseQty: 2.5, wastePct: 12.5 });
  });

  it.each([
    [{ name: "" }, "name", "material.nameRequired"],
    [{ name: "x".repeat(81) }, "name", "material.nameTooLong"],
    [{ category: "bumbu" }, "category", "material.categoryInvalid"],
    [{ purchaseQty: "0" }, "purchaseQty", "material.qtyPositive"],
    [{ purchaseQty: "satu" }, "purchaseQty", "material.qtyNumber"],
    [{ purchaseUnit: "sdm" }, "purchaseUnit", "material.unitInvalid"],
    [{ purchasePrice: "15.5" }, "purchasePrice", "material.priceNumber"],
    [{ purchasePrice: "" }, "purchasePrice", "material.priceNumber"],
    [{ purchasePrice: "3.000.000.000" }, "purchasePrice", "common.amountTooLarge"],
    [{ wastePct: "100" }, "wastePct", "material.wasteMax"],
    [{ wastePct: "-1" }, "wastePct", "material.wasteMin"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(materialInputSchema, { ...material, ...patch })[field]).toBe(key);
  });
});

describe("productInputSchema", () => {
  const product = { name: "Es kopi susu", category: "", yieldQty: "10", targetMarginPct: "", isActive: "on" };

  it("parses optional fields as null and the checkbox as a boolean", () => {
    const parsed = productInputSchema.parse(product);
    expect(parsed).toEqual({ name: "Es kopi susu", category: null, yieldQty: 10, targetMarginPct: null, isActive: true });
    expect(toProductColumns(parsed)).toEqual({ name: "Es kopi susu", category: null, yield_qty: 10, target_margin_pct: null, is_active: true });
  });

  it("an unchecked checkbox (missing field) means inactive", () => {
    const { isActive: _ignored, ...rest } = product;
    expect(productInputSchema.parse(rest).isActive).toBe(false);
  });

  it("keeps an own target margin", () => {
    expect(productInputSchema.parse({ ...product, targetMarginPct: "25,5", category: " Minuman " })).toMatchObject({ targetMarginPct: 25.5, category: "Minuman" });
  });

  it.each([
    [{ yieldQty: "0" }, "yieldQty", "product.yieldPositive"],
    [{ yieldQty: "" }, "yieldQty", "product.yieldNumber"],
    [{ targetMarginPct: "100" }, "targetMarginPct", "product.marginMax"],
    [{ category: "x".repeat(41) }, "category", "product.categoryTooLong"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(productInputSchema, { ...product, ...patch })[field]).toBe(key);
  });
});

describe("compositionInputSchema", () => {
  const row = { materialId: "6f1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f60", qty: "200", unit: "g", basis: "batch" };

  it("parses a row", () => {
    expect(compositionInputSchema.parse(row)).toEqual({ ...row, qty: 200 });
  });

  it.each([
    [{ materialId: "" }, "materialId", "composition.materialRequired"],
    [{ materialId: "not-a-uuid" }, "materialId", "composition.materialRequired"],
    [{ qty: "0" }, "qty", "composition.qtyPositive"],
    [{ unit: "gelas" }, "unit", "composition.unitInvalid"],
    [{ basis: "resep" }, "basis", "composition.basisInvalid"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(compositionInputSchema, { ...row, ...patch })[field]).toBe(key);
  });

  it("rejects a unit from another dimension than the material", () => {
    expect(compositionUnitError("kg", "g")).toBeNull();
    expect(compositionUnitError("kg", "ml")).toBe("composition.unitDimension");
    expect(compositionUnitError("lusin", "pcs")).toBeNull();
  });
});

describe("priceInputSchema", () => {
  it.each([
    [{ price: "18.000", estMonthlySales: "1.200" }, { price: 18000, estMonthlySales: 1200 }],
    [{ price: "Rp 18.000", estMonthlySales: "" }, { price: 18000, estMonthlySales: 0 }],
    [{ price: "0", estMonthlySales: "0" }, { price: 0, estMonthlySales: 0 }],
  ])("parses %j", (input, expected) => {
    expect(priceInputSchema.parse(input)).toEqual(expected);
  });

  it.each([
    [{ price: "18.5", estMonthlySales: "1" }, "price", "price.priceNumber"],
    [{ price: "", estMonthlySales: "1" }, "price", "price.priceNumber"],
    [{ price: "1000", estMonthlySales: "2,5" }, "estMonthlySales", "price.salesNumber"],
  ])("%j → %s: %s", (input, field, key) => {
    expect(errorsFor(priceInputSchema, input)[field]).toBe(key);
  });
});

describe("expenseInputSchema", () => {
  const expense = { name: "Sewa kios", category: "sewa", amount: "1.500.000", frequency: "bulanan" };

  it("parses an expense", () => {
    const parsed = expenseInputSchema.parse(expense);
    expect(parsed).toEqual({ ...expense, amount: 1500000 });
    expect(toExpenseColumns(parsed)).toEqual({ name: "Sewa kios", category: "sewa", amount: 1500000, frequency: "bulanan" });
  });

  it.each([
    [{ category: "pajak" }, "category", "expense.categoryInvalid"],
    [{ amount: "1,5" }, "amount", "expense.amountNumber"],
    [{ frequency: "sekali" }, "frequency", "expense.frequencyInvalid"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(expenseInputSchema, { ...expense, ...patch })[field]).toBe(key);
  });
});

describe("assetInputSchema", () => {
  const asset = { name: "Meja kayu", category: "furnitur", qty: "2", unitPrice: "350.000", usefulLifeMonths: "60" };

  it("parses an asset", () => {
    const parsed = assetInputSchema.parse(asset);
    expect(parsed).toEqual({ name: "Meja kayu", category: "furnitur", qty: 2, unitPrice: 350000, usefulLifeMonths: 60 });
    expect(toAssetColumns(parsed)).toEqual({ name: "Meja kayu", category: "furnitur", qty: 2, unit_price: 350000, useful_life_months: 60 });
  });

  it.each([
    [{ qty: "0" }, "qty", "asset.qtyMin"],
    [{ qty: "1,5" }, "qty", "asset.qtyNumber"],
    [{ usefulLifeMonths: "0" }, "usefulLifeMonths", "asset.lifeMin"],
    [{ usefulLifeMonths: "601" }, "usefulLifeMonths", "asset.lifeMax"],
    [{ unitPrice: "abc" }, "unitPrice", "asset.priceNumber"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(assetInputSchema, { ...asset, ...patch })[field]).toBe(key);
  });
});
```

In `tests/unit/messages.test.ts`, replace the test `"has a validation message for every key the store schema can return"` with:

```ts
  it("has a validation message for every key the schemas can return", async () => {
    const lists = await Promise.all([
      import("@/lib/validation/store").then((m) => m.STORE_VALIDATION_KEYS),
      import("@/lib/validation/common").then((m) => m.COMMON_VALIDATION_KEYS),
      import("@/lib/validation/material").then((m) => m.MATERIAL_VALIDATION_KEYS),
      import("@/lib/validation/product").then((m) => m.PRODUCT_VALIDATION_KEYS),
      import("@/lib/validation/composition").then((m) => m.COMPOSITION_VALIDATION_KEYS),
      import("@/lib/validation/price").then((m) => m.PRICE_VALIDATION_KEYS),
      import("@/lib/validation/expense").then((m) => m.EXPENSE_VALIDATION_KEYS),
      import("@/lib/validation/asset").then((m) => m.ASSET_VALIDATION_KEYS),
    ]);
    for (const key of lists.flat()) {
      const [group, name] = key.split(".");
      expect((id.Validation as Record<string, Record<string, string>>)[group]?.[name], key).toBeTruthy();
      expect((en.Validation as Record<string, Record<string, string>>)[group]?.[name], key).toBeTruthy();
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/entity-validation.test.ts tests/unit/messages.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the schemas**

`lib/validation/common.ts`:

```ts
import { z } from "zod";

/** Ceiling for Rupiah amounts and counts; keeps values inside Postgres `integer`. */
export const MAX_AMOUNT = 2_000_000_000;

export const COMMON_VALIDATION_KEYS = ["common.amountTooLarge"] as const;

/** Trimmed, required name with `<group>.nameRequired` / `<group>.nameTooLong` messages. */
export function requiredName(group: string, max: number) {
  return z
    .string({ error: `${group}.nameRequired` })
    .trim()
    .min(1, `${group}.nameRequired`)
    .max(max, `${group}.nameTooLong`);
}

/** Blank form input becomes `fallback` before parsing. */
export function blankAs<T extends z.ZodType>(fallback: unknown, inner: T) {
  return z.preprocess((value) => (value === "" || value == null ? fallback : value), inner);
}
```

`lib/validation/material.ts`:

```ts
import { z } from "zod";
import { MATERIAL_CATEGORIES } from "@/lib/calc/types";
import { UNITS } from "@/lib/calc/units";
import { blankAs, MAX_AMOUNT, requiredName } from "./common";
import { localeNumber, wholeNumber } from "./number";

export const MATERIAL_UNIT_IN_USE_KEY = "material.unitInUse";

export const MATERIAL_VALIDATION_KEYS = [
  "material.nameRequired",
  "material.nameTooLong",
  "material.categoryInvalid",
  "material.qtyNumber",
  "material.qtyPositive",
  "material.unitInvalid",
  "material.priceNumber",
  "material.priceMin",
  "material.wasteNumber",
  "material.wasteMin",
  "material.wasteMax",
  MATERIAL_UNIT_IN_USE_KEY,
] as const;

export const materialInputSchema = z.object({
  name: requiredName("material", 80),
  category: z.enum(MATERIAL_CATEGORIES, { error: "material.categoryInvalid" }),
  purchaseQty: localeNumber(z.number({ error: "material.qtyNumber" }).positive("material.qtyPositive")),
  purchaseUnit: z.enum(UNITS, { error: "material.unitInvalid" }),
  purchasePrice: wholeNumber(
    z
      .number({ error: "material.priceNumber" })
      .int("material.priceNumber")
      .min(0, "material.priceMin")
      .max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  wastePct: blankAs(
    "0",
    localeNumber(z.number({ error: "material.wasteNumber" }).min(0, "material.wasteMin").lt(100, "material.wasteMax")),
  ),
});

export type MaterialInput = z.infer<typeof materialInputSchema>;

export function toMaterialColumns(input: MaterialInput) {
  return {
    name: input.name,
    category: input.category,
    purchase_qty: input.purchaseQty,
    purchase_unit: input.purchaseUnit,
    purchase_price: input.purchasePrice,
    waste_pct: input.wastePct,
  };
}
```

`lib/validation/product.ts`:

```ts
import { z } from "zod";
import { blankAs, requiredName } from "./common";
import { localeNumber } from "./number";

export const PRODUCT_VALIDATION_KEYS = [
  "product.nameRequired",
  "product.nameTooLong",
  "product.categoryTooLong",
  "product.yieldNumber",
  "product.yieldPositive",
  "product.marginNumber",
  "product.marginMin",
  "product.marginMax",
] as const;

export const productInputSchema = z.object({
  name: requiredName("product", 80),
  category: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(40, "product.categoryTooLong").nullable(),
  ),
  yieldQty: localeNumber(z.number({ error: "product.yieldNumber" }).positive("product.yieldPositive")),
  targetMarginPct: blankAs(
    null,
    localeNumber(
      z.number({ error: "product.marginNumber" }).min(0, "product.marginMin").lt(100, "product.marginMax"),
    ).nullable(),
  ),
  // A checkbox sends "on" when checked and nothing when unchecked.
  isActive: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean()),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export function toProductColumns(input: ProductInput) {
  return {
    name: input.name,
    category: input.category,
    yield_qty: input.yieldQty,
    target_margin_pct: input.targetMarginPct,
    is_active: input.isActive,
  };
}
```

`lib/validation/composition.ts`:

```ts
import { z } from "zod";
import { BASES } from "@/lib/calc/types";
import { sameDimension, UNITS, type Unit } from "@/lib/calc/units";
import { isUuid } from "@/lib/uuid";
import { localeNumber } from "./number";

export const COMPOSITION_UNIT_MISMATCH_KEY = "composition.unitDimension";

export const COMPOSITION_VALIDATION_KEYS = [
  "composition.materialRequired",
  "composition.qtyNumber",
  "composition.qtyPositive",
  "composition.unitInvalid",
  "composition.basisInvalid",
  COMPOSITION_UNIT_MISMATCH_KEY,
] as const;

export const compositionInputSchema = z.object({
  materialId: z.string({ error: "composition.materialRequired" }).refine(isUuid, "composition.materialRequired"),
  qty: localeNumber(z.number({ error: "composition.qtyNumber" }).positive("composition.qtyPositive")),
  unit: z.enum(UNITS, { error: "composition.unitInvalid" }),
  basis: z.enum(BASES, { error: "composition.basisInvalid" }),
});

export type CompositionInput = z.infer<typeof compositionInputSchema>;

/** Message key when a row's unit is a different dimension from its material's purchase unit. */
export function compositionUnitError(materialUnit: Unit, unit: Unit): string | null {
  return sameDimension(materialUnit, unit) ? null : COMPOSITION_UNIT_MISMATCH_KEY;
}

export function toCompositionColumns(input: CompositionInput) {
  return { material_id: input.materialId, qty: input.qty, unit: input.unit, basis: input.basis };
}
```

`lib/validation/price.ts`:

```ts
import { z } from "zod";
import { blankAs, MAX_AMOUNT } from "./common";
import { wholeNumber } from "./number";

export const PRICE_VALIDATION_KEYS = ["price.priceNumber", "price.priceMin", "price.salesNumber", "price.salesMin"] as const;

export const priceInputSchema = z.object({
  price: wholeNumber(
    z.number({ error: "price.priceNumber" }).int("price.priceNumber").min(0, "price.priceMin").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  estMonthlySales: blankAs(
    "0",
    wholeNumber(
      z.number({ error: "price.salesNumber" }).int("price.salesNumber").min(0, "price.salesMin").max(MAX_AMOUNT, "common.amountTooLarge"),
    ),
  ),
});

export type PriceInput = z.infer<typeof priceInputSchema>;

export function toPriceColumns(input: PriceInput) {
  return { price: input.price, est_monthly_sales: input.estMonthlySales };
}
```

`lib/validation/expense.ts`:

```ts
import { z } from "zod";
import { EXPENSE_CATEGORIES, FREQUENCIES } from "@/lib/calc/types";
import { MAX_AMOUNT, requiredName } from "./common";
import { wholeNumber } from "./number";

export const EXPENSE_VALIDATION_KEYS = [
  "expense.nameRequired",
  "expense.nameTooLong",
  "expense.categoryInvalid",
  "expense.amountNumber",
  "expense.amountMin",
  "expense.frequencyInvalid",
] as const;

export const expenseInputSchema = z.object({
  name: requiredName("expense", 80),
  category: z.enum(EXPENSE_CATEGORIES, { error: "expense.categoryInvalid" }),
  amount: wholeNumber(
    z.number({ error: "expense.amountNumber" }).int("expense.amountNumber").min(0, "expense.amountMin").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  frequency: z.enum(FREQUENCIES, { error: "expense.frequencyInvalid" }),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export function toExpenseColumns(input: ExpenseInput) {
  return { name: input.name, category: input.category, amount: input.amount, frequency: input.frequency };
}
```

`lib/validation/asset.ts`:

```ts
import { z } from "zod";
import { ASSET_CATEGORIES } from "@/lib/calc/types";
import { MAX_AMOUNT, requiredName } from "./common";
import { wholeNumber } from "./number";

export const ASSET_VALIDATION_KEYS = [
  "asset.nameRequired",
  "asset.nameTooLong",
  "asset.categoryInvalid",
  "asset.qtyNumber",
  "asset.qtyMin",
  "asset.priceNumber",
  "asset.priceMin",
  "asset.lifeNumber",
  "asset.lifeMin",
  "asset.lifeMax",
] as const;

export const assetInputSchema = z.object({
  name: requiredName("asset", 80),
  category: z.enum(ASSET_CATEGORIES, { error: "asset.categoryInvalid" }),
  qty: wholeNumber(z.number({ error: "asset.qtyNumber" }).int("asset.qtyNumber").min(1, "asset.qtyMin").max(MAX_AMOUNT, "common.amountTooLarge")),
  unitPrice: wholeNumber(
    z.number({ error: "asset.priceNumber" }).int("asset.priceNumber").min(0, "asset.priceMin").max(MAX_AMOUNT, "common.amountTooLarge"),
  ),
  usefulLifeMonths: wholeNumber(
    z.number({ error: "asset.lifeNumber" }).int("asset.lifeNumber").min(1, "asset.lifeMin").max(600, "asset.lifeMax"),
  ),
});

export type AssetInput = z.infer<typeof assetInputSchema>;

export function toAssetColumns(input: AssetInput) {
  return {
    name: input.name,
    category: input.category,
    qty: input.qty,
    unit_price: input.unitPrice,
    useful_life_months: input.usefulLifeMonths,
  };
}
```

- [ ] **Step 4: Add the messages**

Inside `"Validation"` in `messages/id.json`, next to `"store"`, add:

```json
    "common": { "amountTooLarge": "Angka terlalu besar" },
    "material": {
      "nameRequired": "Nama bahan wajib diisi",
      "nameTooLong": "Nama bahan maksimal 80 karakter",
      "categoryInvalid": "Pilih jenis bahan",
      "qtyNumber": "Isi jumlah beli dengan angka",
      "qtyPositive": "Jumlah beli harus lebih dari 0",
      "unitInvalid": "Pilih satuan",
      "priceNumber": "Isi harga dengan angka bulat, contoh 15.000",
      "priceMin": "Harga tidak boleh negatif",
      "wasteNumber": "Isi susut dengan angka",
      "wasteMin": "Susut tidak boleh negatif",
      "wasteMax": "Susut harus kurang dari 100%",
      "unitInUse": "Satuan ini beda jenis dengan yang dipakai di komposisi produk. Pilih satuan sejenis (berat, volume, atau jumlah)."
    },
    "product": {
      "nameRequired": "Nama produk wajib diisi",
      "nameTooLong": "Nama produk maksimal 80 karakter",
      "categoryTooLong": "Kategori maksimal 40 karakter",
      "yieldNumber": "Isi hasil per resep dengan angka",
      "yieldPositive": "Hasil per resep harus lebih dari 0",
      "marginNumber": "Isi margin dengan angka",
      "marginMin": "Margin tidak boleh negatif",
      "marginMax": "Margin harus kurang dari 100%"
    },
    "composition": {
      "materialRequired": "Pilih bahan",
      "qtyNumber": "Isi jumlah dengan angka",
      "qtyPositive": "Jumlah harus lebih dari 0",
      "unitInvalid": "Pilih satuan",
      "basisInvalid": "Pilih cara hitung",
      "unitDimension": "Satuan tidak cocok dengan bahan ini (berat, volume, atau jumlah)"
    },
    "price": {
      "priceNumber": "Isi harga dengan angka bulat, contoh 15.000",
      "priceMin": "Harga tidak boleh negatif",
      "salesNumber": "Isi perkiraan terjual dengan angka bulat",
      "salesMin": "Tidak boleh negatif"
    },
    "expense": {
      "nameRequired": "Nama biaya wajib diisi",
      "nameTooLong": "Nama biaya maksimal 80 karakter",
      "categoryInvalid": "Pilih kategori",
      "amountNumber": "Isi jumlah dengan angka bulat, contoh 1.500.000",
      "amountMin": "Jumlah tidak boleh negatif",
      "frequencyInvalid": "Pilih seberapa sering dibayar"
    },
    "asset": {
      "nameRequired": "Nama barang wajib diisi",
      "nameTooLong": "Nama barang maksimal 80 karakter",
      "categoryInvalid": "Pilih kategori",
      "qtyNumber": "Isi jumlah dengan angka bulat",
      "qtyMin": "Jumlah minimal 1",
      "priceNumber": "Isi harga dengan angka bulat, contoh 350.000",
      "priceMin": "Harga tidak boleh negatif",
      "lifeNumber": "Isi umur pakai dalam bulan (angka bulat)",
      "lifeMin": "Umur pakai minimal 1 bulan",
      "lifeMax": "Umur pakai maksimal 600 bulan"
    }
```

Inside `"Validation"` in `messages/en.json`:

```json
    "common": { "amountTooLarge": "That number is too large" },
    "material": {
      "nameRequired": "Material name is required",
      "nameTooLong": "Material name can be at most 80 characters",
      "categoryInvalid": "Choose a type",
      "qtyNumber": "Enter the amount bought as a number",
      "qtyPositive": "The amount bought must be more than 0",
      "unitInvalid": "Choose a unit",
      "priceNumber": "Enter the price as a whole number, e.g. 15,000",
      "priceMin": "The price can't be negative",
      "wasteNumber": "Enter waste as a number",
      "wasteMin": "Waste can't be negative",
      "wasteMax": "Waste must be less than 100%",
      "unitInUse": "This unit is a different kind from the one used in product compositions. Choose the same kind (weight, volume, or count)."
    },
    "product": {
      "nameRequired": "Product name is required",
      "nameTooLong": "Product name can be at most 80 characters",
      "categoryTooLong": "Category can be at most 40 characters",
      "yieldNumber": "Enter the yield as a number",
      "yieldPositive": "Yield must be more than 0",
      "marginNumber": "Enter the margin as a number",
      "marginMin": "Margin can't be negative",
      "marginMax": "Margin must be less than 100%"
    },
    "composition": {
      "materialRequired": "Choose a material",
      "qtyNumber": "Enter the amount as a number",
      "qtyPositive": "The amount must be more than 0",
      "unitInvalid": "Choose a unit",
      "basisInvalid": "Choose how it is counted",
      "unitDimension": "This unit doesn't match the material (weight, volume, or count)"
    },
    "price": {
      "priceNumber": "Enter the price as a whole number, e.g. 15,000",
      "priceMin": "The price can't be negative",
      "salesNumber": "Enter estimated sales as a whole number",
      "salesMin": "Can't be negative"
    },
    "expense": {
      "nameRequired": "Cost name is required",
      "nameTooLong": "Cost name can be at most 80 characters",
      "categoryInvalid": "Choose a category",
      "amountNumber": "Enter the amount as a whole number, e.g. 1,500,000",
      "amountMin": "The amount can't be negative",
      "frequencyInvalid": "Choose how often it is paid"
    },
    "asset": {
      "nameRequired": "Item name is required",
      "nameTooLong": "Item name can be at most 80 characters",
      "categoryInvalid": "Choose a category",
      "qtyNumber": "Enter the quantity as a whole number",
      "qtyMin": "Quantity must be at least 1",
      "priceNumber": "Enter the price as a whole number, e.g. 350,000",
      "priceMin": "The price can't be negative",
      "lifeNumber": "Enter the useful life in whole months",
      "lifeMin": "At least 1 month",
      "lifeMax": "At most 600 months"
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/validation messages tests/unit/entity-validation.test.ts tests/unit/messages.test.ts
git commit -m "feat(validation): schemas for materials, products, composition, prices, costs and assets"
```

---

### Task 8: Store data loading and shared form pieces

**Files:**
- Create: `lib/data/store-data.ts`, `lib/data/load-store-data.ts`, `lib/data/revalidate.ts`
- Create: `components/forms/native-select.tsx`, `components/forms/form-message.tsx`, `components/forms/use-remount-key.ts`, `components/forms/delete-button.tsx`
- Modify: `lib/forms.ts` (add `rawValues`), `app/[locale]/s/[storeId]/pengaturan/actions.ts` and `app/[locale]/onboarding/actions.ts` (use the shared `rawValues`), `components/store/store-fields.tsx` (use `NativeSelect`), `messages/id.json`, `messages/en.json` (add `Common`)
- Test: `tests/rls/store-data.test.ts`

**Interfaces:**
- Consumes: Task 2 types (`StoreData`, `isUnit`, enum types), `Tables` from `@/lib/supabase/database.types`, `createClient` from `@/lib/supabase/server`, `isUuid`.
- Produces:
  - `fetchStoreData(supabase: SupabaseClient<Database>, storeId: string): Promise<StoreData | null>` — rows ordered by `created_at` (channels by `sort_order`, then `created_at`); `null` when the store is not visible.
  - `loadStoreData(storeId: string): Promise<StoreData | null>` — server-only, `cache`d per request, `null` for a non-UUID.
  - `revalidateStore(): void`.
  - `rawValues(formData: FormData, names: readonly string[]): Record<string, string>`.
  - `<NativeSelect {...selectProps} />`, `<FormMessage state={FormState} />`, `useRemountKey(state: unknown): number`, `<DeleteButton action={(prev: FormState, fd: FormData) => Promise<FormState>} label={string} />`.
  - Messages `Common.{save,savePending,add,addPending,delete,deletePending,deleteConfirm,cancel,edit,back,saved,saveFailed,deleteFailed,notFound}`.

- [ ] **Step 1: Write the failing RLS test**

`tests/rls/store-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fetchStoreData } from "@/lib/data/store-data";
import { createStore, createTestUser } from "./helpers";

describe("fetchStoreData", () => {
  it("maps every table for the owner and returns null for anyone else", async () => {
    const owner = await createTestUser("data-owner");
    const other = await createTestUser("data-other");
    const storeId = await createStore(owner, "Kedai Data");
    const db = owner.client;

    const { data: channel } = await db.from("sales_channels").select("id").eq("store_id", storeId).single();
    const { data: material } = await db
      .from("materials")
      .insert({ store_id: storeId, name: "Gula", category: "bahan", purchase_qty: 1, purchase_unit: "kg", purchase_price: 15000, waste_pct: 5 })
      .select("id")
      .single();
    const { data: product } = await db.from("products").insert({ store_id: storeId, name: "Es Teh", yield_qty: 10 }).select("id").single();
    await db.from("product_materials").insert({
      store_id: storeId,
      product_id: product!.id,
      material_id: material!.id,
      qty: 100,
      unit: "g",
      basis: "batch",
    });
    await db.from("product_channel_prices").insert({
      store_id: storeId,
      product_id: product!.id,
      channel_id: channel!.id,
      price: 5000,
      est_monthly_sales: 200,
    });
    await db.from("operating_expenses").insert({ store_id: storeId, name: "Sewa", category: "sewa", amount: 1000000, frequency: "bulanan" });
    await db.from("assets").insert({
      store_id: storeId,
      name: "Kulkas",
      category: "elektronik",
      qty: 1,
      unit_price: 3000000,
      useful_life_months: 60,
    });

    expect(await fetchStoreData(db, storeId)).toMatchObject({
      store: { id: storeId, name: "Kedai Data", targetMarginPct: 40, operatingDaysPerMonth: 26 },
      materials: [{ id: material!.id, name: "Gula", category: "bahan", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 15000, wastePct: 5 }],
      products: [{ id: product!.id, name: "Es Teh", yieldQty: 10, targetMarginPct: null, isActive: true }],
      composition: [{ productId: product!.id, materialId: material!.id, qty: 100, unit: "g", basis: "batch", channelId: null }],
      channels: [{ id: channel!.id, commissionPct: 0, fixedFee: 0 }],
      prices: [{ productId: product!.id, channelId: channel!.id, price: 5000, estMonthlySales: 200, competitorPrice: null }],
      expenses: [{ name: "Sewa", category: "sewa", amount: 1000000, frequency: "bulanan" }],
      assets: [{ name: "Kulkas", category: "elektronik", qty: 1, unitPrice: 3000000, usefulLifeMonths: 60 }],
    });
    expect(await fetchStoreData(other.client, storeId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rls -- tests/rls/store-data.test.ts`
Expected: FAIL — `@/lib/data/store-data` not found.

- [ ] **Step 3: Implement data loading**

`lib/data/store-data.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isUnit,
  type AssetCategory,
  type Basis,
  type ExpenseCategory,
  type Frequency,
  type MaterialCategory,
  type StoreData,
  type Unit,
} from "@/lib/calc";
import type { Database } from "@/lib/supabase/database.types";

function unit(value: string): Unit {
  if (!isUnit(value)) throw new Error(`Unknown unit in the database: ${value}`);
  return value;
}

/**
 * Loads everything lib/calc needs for one store. Returns null when the store does not exist or RLS
 * hides it (not the owner). Category and frequency columns are trusted: database check constraints
 * limit them to the same values as lib/calc.
 */
export async function fetchStoreData(supabase: SupabaseClient<Database>, storeId: string): Promise<StoreData | null> {
  const [store, materials, products, composition, channels, prices, expenses, assets] = await Promise.all([
    supabase.from("stores").select("id, name, target_margin_pct, operating_days_per_month").eq("id", storeId).maybeSingle(),
    supabase.from("materials").select("*").eq("store_id", storeId).order("created_at"),
    supabase.from("products").select("*").eq("store_id", storeId).order("created_at"),
    supabase.from("product_materials").select("*").eq("store_id", storeId).order("created_at"),
    supabase.from("sales_channels").select("*").eq("store_id", storeId).order("sort_order").order("created_at"),
    supabase.from("product_channel_prices").select("*").eq("store_id", storeId).order("created_at"),
    supabase.from("operating_expenses").select("*").eq("store_id", storeId).order("created_at"),
    supabase.from("assets").select("*").eq("store_id", storeId).order("created_at"),
  ]);
  for (const result of [store, materials, products, composition, channels, prices, expenses, assets]) {
    if (result.error) throw result.error;
  }
  if (!store.data) return null;

  return {
    store: {
      id: store.data.id,
      name: store.data.name,
      targetMarginPct: Number(store.data.target_margin_pct),
      operatingDaysPerMonth: store.data.operating_days_per_month,
    },
    materials: (materials.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as MaterialCategory,
      purchaseQty: Number(row.purchase_qty),
      purchaseUnit: unit(row.purchase_unit),
      purchasePrice: row.purchase_price,
      wastePct: Number(row.waste_pct),
    })),
    products: (products.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      yieldQty: Number(row.yield_qty),
      targetMarginPct: row.target_margin_pct === null ? null : Number(row.target_margin_pct),
      isActive: row.is_active,
    })),
    composition: (composition.data ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      materialId: row.material_id,
      qty: Number(row.qty),
      unit: unit(row.unit),
      basis: row.basis as Basis,
      channelId: row.channel_id,
    })),
    channels: (channels.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      commissionPct: Number(row.commission_pct),
      fixedFee: row.fixed_fee,
    })),
    prices: (prices.data ?? []).map((row) => ({
      productId: row.product_id,
      channelId: row.channel_id,
      price: row.price,
      estMonthlySales: row.est_monthly_sales,
      competitorPrice: row.competitor_price,
    })),
    expenses: (expenses.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as ExpenseCategory,
      amount: row.amount,
      frequency: row.frequency as Frequency,
    })),
    assets: (assets.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as AssetCategory,
      qty: row.qty,
      unitPrice: row.unit_price,
      usefulLifeMonths: row.useful_life_months,
    })),
  };
}
```

`lib/data/load-store-data.ts`:

```ts
import "server-only";
import { cache } from "react";
import type { StoreData } from "@/lib/calc";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { fetchStoreData } from "./store-data";

/** StoreData for the signed-in owner, once per request; null means 404. */
export const loadStoreData = cache(async (storeId: string): Promise<StoreData | null> => {
  if (!isUuid(storeId)) return null;
  return fetchStoreData(await createClient(), storeId);
});
```

`lib/data/revalidate.ts`:

```ts
import "server-only";
import { revalidatePath } from "next/cache";

/** Refreshes every page of the current store (layout, dashboard, lists) after a mutation. */
export function revalidateStore() {
  revalidatePath("/[locale]/s/[storeId]", "layout");
}
```

- [ ] **Step 4: Run the RLS test to verify it passes**

Run: `npm run test:rls`
Expected: PASS (all RLS tests, including the new one).

- [ ] **Step 5: Add the shared form pieces**

Append to `lib/forms.ts`:

```ts
/** Raw string values of the named fields, echoed back so a form can refill after an action. */
export function rawValues(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}
```

In `app/[locale]/s/[storeId]/pengaturan/actions.ts`, delete the local `rawValues` function and import it: `import { rawValues, type FormState } from "@/lib/forms";`. In `app/[locale]/onboarding/actions.ts`, delete its local `rawValues(formData)` and call the shared one as `rawValues(formData, STORE_FIELD_NAMES)` everywhere it was called.

`components/forms/native-select.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled like <Input>; native pickers work best on low-end phones. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base dark:bg-input/30 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
```

In `components/store/store-fields.tsx`, delete `selectClass`, import `NativeSelect`, and replace both `<select … className={selectClass}>` elements with `<NativeSelect …>` (same props, no `className`).

`components/forms/form-message.tsx`:

```tsx
import type { FormState } from "@/lib/forms";

/** The action's overall message: a polite status on success, an alert on failure. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>
      {state.message}
    </p>
  );
}
```

`components/forms/use-remount-key.ts`:

```ts
import { useState } from "react";

/**
 * A number that changes whenever `state` changes. Key form fields with it so they remount and pick up
 * refilled defaults (React resets uncontrolled forms after an action).
 */
export function useRemountKey(state: unknown): number {
  const [seen, setSeen] = useState(state);
  const [key, setKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    setKey((current) => current + 1);
  }
  return key;
}
```

`components/forms/delete-button.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Two-step delete: the first click asks for confirmation, the second runs `action`. */
export function DeleteButton({ action, label }: { action: Action; label: string }) {
  const t = useTranslations("Common");
  const [state, formAction] = useActionState(action, undefined);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
          {label}
        </Button>
        <FormMessage state={state} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm">{t("deleteConfirm")}</p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="destructive" pendingText={t("deletePending")}>
          {label}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          {t("cancel")}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
```

If `components/ui/button.tsx` has no `destructive` variant, use `variant="outline"` with `className="text-destructive"` for the submit button instead.

Add a top-level `"Common"` namespace to `messages/id.json`:

```json
  "Common": {
    "save": "Simpan",
    "savePending": "Menyimpan…",
    "add": "Tambah",
    "addPending": "Menambah…",
    "delete": "Hapus",
    "deletePending": "Menghapus…",
    "deleteConfirm": "Yakin ingin menghapus? Ini tidak bisa dibatalkan.",
    "cancel": "Batal",
    "edit": "Ubah",
    "back": "Kembali",
    "saved": "Tersimpan.",
    "saveFailed": "Gagal menyimpan. Coba lagi.",
    "deleteFailed": "Gagal menghapus. Coba lagi.",
    "notFound": "Data tidak ditemukan."
  },
```

and to `messages/en.json`:

```json
  "Common": {
    "save": "Save",
    "savePending": "Saving…",
    "add": "Add",
    "addPending": "Adding…",
    "delete": "Delete",
    "deletePending": "Deleting…",
    "deleteConfirm": "Delete this for sure? This can't be undone.",
    "cancel": "Cancel",
    "edit": "Edit",
    "back": "Back",
    "saved": "Saved.",
    "saveFailed": "Could not save. Try again.",
    "deleteFailed": "Could not delete. Try again.",
    "notFound": "Not found."
  },
```

- [ ] **Step 6: Verify nothing regressed**

Run: `npx tsc --noEmit && npx eslint . && npm test`
Expected: clean typecheck and lint; unit tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/data lib/forms.ts components/forms components/store/store-fields.tsx "app/[locale]/s/[storeId]/pengaturan/actions.ts" "app/[locale]/onboarding/actions.ts" messages tests/rls/store-data.test.ts
git commit -m "feat(data): load StoreData per request; shared form pieces"
```

---

### Task 9: Store navigation for the new pages

**Files:**
- Modify: `lib/nav.ts`, `components/store/store-nav.tsx`, `messages/id.json`, `messages/en.json` (`StoreShell`)
- Create: `app/[locale]/s/[storeId]/lainnya/page.tsx`
- Test: `tests/unit/nav.test.ts` (rewrite), `tests/e2e/store-shell.spec.ts` (update the settings test, add one)

**Interfaces:**
- Produces: `type NavLabelKey = "dashboard" | "products" | "materials" | "expenses" | "assets" | "settings" | "more"`; `storeNavItems(storeId)` (sidebar: dashboard, products, materials, expenses, assets, settings); `bottomNavItems(storeId)` (dashboard, products, materials, more); `moreNavItems(storeId)` (expenses, assets, settings); `isNavActive(pathname, href)` (unchanged); `isMoreActive(pathname, storeId)`. Hrefs: `/s/{id}/dashboard`, `/s/{id}/produk`, `/s/{id}/bahan`, `/s/{id}/biaya`, `/s/{id}/inventaris`, `/s/{id}/pengaturan`, `/s/{id}/lainnya`.

- [ ] **Step 1: Write the failing unit test**

Replace `tests/unit/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bottomNavItems, isMoreActive, isNavActive, moreNavItems, storeNavItems } from "@/lib/nav";

const pairs = (items: { labelKey: string; href: string }[]) => items.map((i) => [i.labelKey, i.href]);

describe("store navigation", () => {
  it("lists every page in the sidebar", () => {
    expect(pairs(storeNavItems("abc"))).toEqual([
      ["dashboard", "/s/abc/dashboard"],
      ["products", "/s/abc/produk"],
      ["materials", "/s/abc/bahan"],
      ["expenses", "/s/abc/biaya"],
      ["assets", "/s/abc/inventaris"],
      ["settings", "/s/abc/pengaturan"],
    ]);
  });

  it("puts four items in the phone bar, the rest behind Lainnya", () => {
    expect(pairs(bottomNavItems("abc"))).toEqual([
      ["dashboard", "/s/abc/dashboard"],
      ["products", "/s/abc/produk"],
      ["materials", "/s/abc/bahan"],
      ["more", "/s/abc/lainnya"],
    ]);
    expect(pairs(moreNavItems("abc"))).toEqual([
      ["expenses", "/s/abc/biaya"],
      ["assets", "/s/abc/inventaris"],
      ["settings", "/s/abc/pengaturan"],
    ]);
  });

  it.each([
    ["/s/abc/lainnya", true],
    ["/s/abc/biaya", true],
    ["/s/abc/inventaris/123", true],
    ["/s/abc/pengaturan", true],
    ["/s/abc/produk", false],
  ])("Lainnya is active on %s → %s", (pathname, expected) => {
    expect(isMoreActive(pathname, "abc")).toBe(expected);
  });
});

describe("isNavActive", () => {
  it.each([
    ["/s/abc/dashboard", "/s/abc/dashboard", true],
    ["/s/abc/produk/123", "/s/abc/produk", true],
    ["/s/abc/produkbaru", "/s/abc/produk", false],
    ["/s/abc/pengaturan", "/s/abc/dashboard", false],
  ])("%s with %s → %s", (pathname, href, expected) => {
    expect(isNavActive(pathname, href)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/nav.test.ts`
Expected: FAIL — `bottomNavItems` is not exported.

- [ ] **Step 3: Implement**

Replace `lib/nav.ts`:

```ts
import {
  Armchair,
  Ellipsis,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingBasket,
  type LucideIcon,
} from "lucide-react";

export type NavLabelKey = "dashboard" | "products" | "materials" | "expenses" | "assets" | "settings" | "more";
export type StoreNavItem = { labelKey: NavLabelKey; href: string; icon: LucideIcon };

type PageKey = Exclude<NavLabelKey, "more">;

const PAGES: Record<PageKey, { path: string; icon: LucideIcon }> = {
  dashboard: { path: "dashboard", icon: LayoutDashboard },
  products: { path: "produk", icon: Package },
  materials: { path: "bahan", icon: ShoppingBasket },
  expenses: { path: "biaya", icon: Receipt },
  assets: { path: "inventaris", icon: Armchair },
  settings: { path: "pengaturan", icon: Settings },
};

const MORE_KEYS = ["expenses", "assets", "settings"] as const;
export type MoreNavKey = (typeof MORE_KEYS)[number];

function item<K extends PageKey>(storeId: string, key: K): StoreNavItem & { labelKey: K } {
  return { labelKey: key, href: `/s/${storeId}/${PAGES[key].path}`, icon: PAGES[key].icon };
}

/** Desktop sidebar: every store page. */
export function storeNavItems(storeId: string): StoreNavItem[] {
  return (["dashboard", "products", "materials", "expenses", "assets", "settings"] as const).map((key) => item(storeId, key));
}

/** Phone bottom bar (spec §5.2): Dashboard, Produk, Bahan, Lainnya. */
export function bottomNavItems(storeId: string): StoreNavItem[] {
  return [
    ...(["dashboard", "products", "materials"] as const).map((key) => item(storeId, key)),
    { labelKey: "more", href: `/s/${storeId}/lainnya`, icon: Ellipsis },
  ];
}

/** Pages listed on the "Lainnya" page. */
export function moreNavItems(storeId: string): (StoreNavItem & { labelKey: MoreNavKey })[] {
  return MORE_KEYS.map((key) => item(storeId, key));
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "Lainnya" stays highlighted on its own page and on every page it links to. */
export function isMoreActive(pathname: string, storeId: string): boolean {
  return (
    isNavActive(pathname, `/s/${storeId}/lainnya`) || moreNavItems(storeId).some((entry) => isNavActive(pathname, entry.href))
  );
}
```

If `lucide-react` does not export one of the icon names above (check with the typecheck), use the closest icon it does export.

In `components/store/store-nav.tsx`: import `bottomNavItems, isMoreActive, isNavActive, storeNavItems`. In the `bottom` branch use `const items = bottomNavItems(storeId)` and compute `const active = item.labelKey === "more" ? isMoreActive(pathname, storeId) : isNavActive(pathname, item.href);`. The sidebar branch keeps `storeNavItems(storeId)`.

`app/[locale]/s/[storeId]/lainnya/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getStore } from "@/lib/data/stores";
import { moreNavItems } from "@/lib/nav";

export default async function MorePage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const t = await getTranslations("StoreShell");

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.more")}</h1>
      <ul className="space-y-2">
        {moreNavItems(store.id).map((entry) => (
          <li key={entry.href}>
            <Link href={entry.href} className="flex min-h-14 items-center gap-3 rounded-lg border p-4 hover:bg-accent/60">
              <entry.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">{t(`nav.${entry.labelKey}`)}</span>
                <span className="block text-sm text-muted-foreground">{t(`moreDescriptions.${entry.labelKey}`)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

In `messages/id.json` `StoreShell`, make `nav` and add `moreDescriptions`:

```json
    "nav": {
      "dashboard": "Dashboard",
      "products": "Produk",
      "materials": "Bahan",
      "expenses": "Biaya",
      "assets": "Inventaris",
      "settings": "Pengaturan",
      "more": "Lainnya"
    },
    "moreDescriptions": {
      "expenses": "Sewa, listrik, gaji, dan biaya rutin lain",
      "assets": "Alat dan perlengkapan, modal awal usahamu",
      "settings": "Ubah data toko atau hapus toko"
    }
```

In `messages/en.json` `StoreShell`:

```json
    "nav": {
      "dashboard": "Dashboard",
      "products": "Products",
      "materials": "Materials",
      "expenses": "Costs",
      "assets": "Inventory",
      "settings": "Settings",
      "more": "More"
    },
    "moreDescriptions": {
      "expenses": "Rent, electricity, wages and other running costs",
      "assets": "Equipment and furniture, your starting capital",
      "settings": "Edit or delete the store"
    }
```

- [ ] **Step 4: Update the e2e tests**

In `tests/e2e/store-shell.spec.ts`, the test `"store menu navigates to settings"` clicks "Pengaturan" in the "Menu toko" navigation. On phones that link now lives on the Lainnya page. Change the click to:

```ts
  const menu = page.getByRole("navigation", { name: "Menu toko" });
  if (testInfo.project.name === "mobile") {
    await menu.getByRole("link", { name: "Lainnya" }).click();
    await page.getByRole("main").getByRole("link", { name: /Pengaturan/ }).click();
  } else {
    await menu.getByRole("link", { name: "Pengaturan" }).click();
  }
```

(add `testInfo` to the test's parameters: `async ({ page }, testInfo) =>`), keeping the test's existing assertions after the click. Then add:

```ts
test("Lainnya lists costs, inventory and settings on phones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Lainnya");
  await page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Lainnya" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/lainnya$/);
  const main = page.getByRole("main");
  for (const name of ["Biaya", "Inventaris", "Pengaturan"]) {
    await expect(main.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Lainnya" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit && npx tsc --noEmit && npx eslint .` then the e2e suite against a production build (see Global Constraints) for `tests/e2e/store-shell.spec.ts`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nav.ts components/store/store-nav.tsx "app/[locale]/s/[storeId]/lainnya" messages tests/unit/nav.test.ts tests/e2e/store-shell.spec.ts
git commit -m "feat(nav): store pages for products, materials, costs and inventory; Lainnya on phones"
```

---

### Task 10: Materials page (`bahan`)

**Files:**
- Create: `components/empty-state.tsx`
- Create: `app/[locale]/s/[storeId]/bahan/page.tsx`, `app/[locale]/s/[storeId]/bahan/actions.ts`, `app/[locale]/s/[storeId]/bahan/material-form.tsx`, `app/[locale]/s/[storeId]/bahan/[materialId]/page.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Materials`, `Units`, `MaterialCategory`), `tests/e2e/helpers.ts` (add `addMaterial`, `storeUrl`)
- Test: `tests/e2e/materials.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 7, 8 (`loadStoreData`, `revalidateStore`, `rawValues`, `NativeSelect`, `FormMessage`, `useRemountKey`, `DeleteButton`, `materialInputSchema`, `toMaterialColumns`, `MATERIAL_UNIT_IN_USE_KEY`, `unitCost`, `BASE_UNIT`, `dimensionOf`, `sameDimension`, `isUnit`, `formatRupiah`, `formatNumber`), existing `formatPercent`.
- Produces:
  - `<EmptyState title body>{optional action}</EmptyState>`.
  - Server Actions `createMaterialAction(storeId, prev, formData)`, `updateMaterialAction(storeId, materialId, prev, formData)`, `deleteMaterialAction(storeId, materialId, prev, formData)` — form field names `name`, `category`, `purchaseQty`, `purchaseUnit`, `purchasePrice`, `wastePct`. Update rejects a `purchaseUnit` whose dimension differs from any composition row of the material (`fieldErrors.purchaseUnit`). Delete of a used material returns `message` "Tidak bisa dihapus. Dipakai di: <names>"; success redirects to `/s/{storeId}/bahan`.
  - e2e helpers: `storeUrl(page: Page, path: string): string` (replaces the segment after `/s/<id>/`), `addMaterial(page, m: { name: string; qty: string; unit: Unit; price: string; category?: "bahan" | "kemasan"; waste?: string })` — fills the add form on the current `bahan` page and waits for "Bahan ditambahkan.".

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:

```ts
/** URL of another page of the store currently open, e.g. storeUrl(page, "bahan"). */
export function storeUrl(page: Page, path: string): string {
  const match = page.url().match(/^(.*\/s\/[0-9a-f-]{36})\//);
  if (!match) throw new Error(`Not on a store page: ${page.url()}`);
  return `${match[1]}/${path}`;
}

export async function addMaterial(
  page: Page,
  m: { name: string; qty: string; unit: string; price: string; category?: "bahan" | "kemasan"; waste?: string },
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
}
```

`tests/e2e/materials.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { addMaterial, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Bahan");
  await page.goto(storeUrl(page, "bahan"));
});

test("shows an empty state, then lists a new material with its cost per base unit", async ({ page }) => {
  await expect(page.getByText("Belum ada bahan")).toBeVisible();
  const form = page.locator("#add-material");
  await form.getByLabel("Jumlah beli").fill("1");
  await form.getByLabel("Satuan").selectOption("kg");
  await form.getByLabel("Harga beli (Rp)").fill("15.000");
  await form.getByLabel("Nama bahan").fill("Gula pasir");
  await expect(form.getByText("Biaya: Rp15 per g")).toBeVisible();

  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Bahan ditambahkan.")).toBeVisible();
  const item = page.getByRole("link", { name: /Gula pasir/ });
  await expect(item).toContainText("Rp15.000");
  await expect(item).toContainText("Rp15/g");
  await expect(form.getByLabel("Nama bahan")).toHaveValue("");
});

test("keeps typed values and shows field errors", async ({ page }) => {
  const form = page.locator("#add-material");
  await form.getByLabel("Jumlah beli").fill("1");
  await form.getByLabel("Harga beli (Rp)").fill("15,5");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Nama bahan wajib diisi")).toBeVisible();
  await expect(form.getByText("Isi harga dengan angka bulat, contoh 15.000")).toBeVisible();
  await expect(form.getByLabel("Harga beli (Rp)")).toHaveValue("15,5");
});

test("edits and deletes a material", async ({ page }) => {
  await addMaterial(page, { name: "Susu UHT", qty: "1", unit: "l", price: "20.000", waste: "10" });
  await page.getByRole("link", { name: /Susu UHT/ }).click();
  await expect(page.getByRole("heading", { name: "Ubah bahan" })).toBeVisible();
  await page.getByLabel("Harga beli (Rp)").fill("18.000");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await expect(page.getByLabel("Harga beli (Rp)")).toHaveValue("18.000");

  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await expect(page).toHaveURL(/\/bahan$/);
  await expect(page.getByText("Belum ada bahan")).toBeVisible();
});

test("a long name and a large price fit on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await addMaterial(page, { name: "BahanDenganNamaSangatPanjang".repeat(3).slice(0, 80), qty: "1", unit: "kg", price: "1.000.000.000" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (against a production build, see Global Constraints): `npx playwright test tests/e2e/materials.spec.ts`
Expected: FAIL — the `bahan` page is a 404.

- [ ] **Step 3: Add the messages**

`messages/id.json`, new top-level namespaces:

```json
  "Units": {
    "g": "gram (g)",
    "ons": "ons (100 g)",
    "kg": "kilogram (kg)",
    "ml": "mililiter (ml)",
    "l": "liter (l)",
    "pcs": "buah (pcs)",
    "lusin": "lusin (12 pcs)"
  },
  "MaterialCategory": { "bahan": "Bahan baku", "kemasan": "Kemasan" },
  "Materials": {
    "title": "Bahan & kemasan",
    "intro": "Semua yang kamu beli untuk membuat produk: bahan baku dan kemasan.",
    "addTitle": "Tambah bahan",
    "editTitle": "Ubah bahan",
    "name": "Nama bahan",
    "namePlaceholder": "Contoh: Gula pasir",
    "category": "Jenis",
    "purchaseQty": "Jumlah beli",
    "purchaseUnit": "Satuan",
    "purchasePrice": "Harga beli (Rp)",
    "wastePct": "Susut / terbuang (%)",
    "wasteHint": "Bagian yang terbuang, misalnya kulit atau tumpah. Kosongkan jika tidak ada.",
    "costPreview": "Biaya: {cost} per {unit}",
    "perBaseUnit": "{cost}/{unit}",
    "wasteValue": "susut {pct}",
    "emptyTitle": "Belum ada bahan",
    "emptyBody": "Catat bahan dan kemasan yang kamu beli. Contoh: Gula pasir, 1 kg, Rp15.000.",
    "emptyAction": "Tambah bahan pertama",
    "created": "Bahan ditambahkan.",
    "delete": "Hapus bahan",
    "deleteInUse": "Tidak bisa dihapus. Dipakai di: {products}",
    "usedIn": "Dipakai di: {products}"
  },
```

`messages/en.json`:

```json
  "Units": {
    "g": "gram (g)",
    "ons": "ons (100 g)",
    "kg": "kilogram (kg)",
    "ml": "millilitre (ml)",
    "l": "litre (l)",
    "pcs": "piece (pcs)",
    "lusin": "dozen (12 pcs)"
  },
  "MaterialCategory": { "bahan": "Ingredient", "kemasan": "Packaging" },
  "Materials": {
    "title": "Materials & packaging",
    "intro": "Everything you buy to make your products: ingredients and packaging.",
    "addTitle": "Add material",
    "editTitle": "Edit material",
    "name": "Material name",
    "namePlaceholder": "E.g. Sugar",
    "category": "Type",
    "purchaseQty": "Amount bought",
    "purchaseUnit": "Unit",
    "purchasePrice": "Purchase price (Rp)",
    "wastePct": "Waste (%)",
    "wasteHint": "The part you throw away, such as peel or spills. Leave empty if none.",
    "costPreview": "Cost: {cost} per {unit}",
    "perBaseUnit": "{cost}/{unit}",
    "wasteValue": "waste {pct}",
    "emptyTitle": "No materials yet",
    "emptyBody": "Record the ingredients and packaging you buy. E.g. Sugar, 1 kg, Rp15,000.",
    "emptyAction": "Add your first material",
    "created": "Material added.",
    "delete": "Delete material",
    "deleteInUse": "Can't delete. Used in: {products}",
    "usedIn": "Used in: {products}"
  },
```

- [ ] **Step 4: Implement**

`components/empty-state.tsx`:

```tsx
import type { ReactNode } from "react";

/** Empty list: what belongs here, an example, and an action (spec §5.3). */
export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
```

`app/[locale]/s/[storeId]/bahan/actions.ts`:

```ts
"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isUnit, sameDimension } from "@/lib/calc";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
import { MATERIAL_UNIT_IN_USE_KEY, materialInputSchema, toMaterialColumns } from "@/lib/validation/material";

const FIELDS = ["name", "category", "purchaseQty", "purchaseUnit", "purchasePrice", "wastePct"] as const;

async function parseMaterial(formData: FormData) {
  const values = rawValues(formData, FIELDS);
  const parsed = materialInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createMaterialAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseMaterial(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("materials").insert({ store_id: storeId, ...toMaterialColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  // No values: the add form clears for the next material.
  return { ok: true, message: (await getTranslations("Materials"))("created") };
}

export async function updateMaterialAction(
  storeId: string,
  materialId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseMaterial(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(materialId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  // A composition row must stay in the same dimension as its material (spec §3.3).
  const { data: rows, error: rowsError } = await supabase
    .from("product_materials")
    .select("unit")
    .eq("store_id", storeId)
    .eq("material_id", materialId);
  if (rowsError) return { message: tCommon("saveFailed"), values: parsed.values };
  if (rows.some((row) => isUnit(row.unit) && !sameDimension(row.unit, parsed.input.purchaseUnit))) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { purchaseUnit: [tValidation(MATERIAL_UNIT_IN_USE_KEY)] }, values: parsed.values };
  }

  const { data, error } = await supabase
    .from("materials")
    .update(toMaterialColumns(parsed.input))
    .eq("id", materialId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteMaterialAction(storeId: string, materialId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(materialId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("materials").delete().eq("id", materialId).eq("store_id", storeId).select("id");
  if (error?.code === "23503") {
    // The composition FK refuses to delete a material that a product uses.
    const { data: uses } = await supabase.from("product_materials").select("product_id").eq("material_id", materialId);
    const productIds = [...new Set((uses ?? []).map((use) => use.product_id))];
    const { data: products } = await supabase.from("products").select("name").in("id", productIds).order("name");
    const t = await getTranslations("Materials");
    return { message: t("deleteInUse", { products: (products ?? []).map((p) => p.name).join(", ") }) };
  }
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/bahan`, locale: await getLocale() });
}
```

`DeleteButton` calls its action as `(prev, formData)`; bind the ids so the bound action ignores those arguments: `deleteMaterialAction.bind(null, storeId, materialId)` has the shape `() => Promise<FormState>`, which is assignable to the `Action` type.

`app/[locale]/s/[storeId]/bahan/material-form.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type FormEvent } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASE_UNIT, dimensionOf, MATERIAL_CATEGORIES, UNITS, unitCost } from "@/lib/calc";
import { formatRupiah } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { materialInputSchema } from "@/lib/validation/material";

export type MaterialFormDefaults = Partial<
  Record<"name" | "category" | "purchaseQty" | "purchaseUnit" | "purchasePrice" | "wastePct", string>
>;

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = { action: Action; defaults?: MaterialFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function MaterialForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  return (
    <form id={id} action={formAction} className="space-y-4">
      <MaterialFields key={key} defaults={state?.values ?? defaults} errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

function MaterialFields({ defaults, errors }: { defaults: MaterialFormDefaults; errors: Record<string, string[] | undefined> }) {
  const t = useTranslations("Materials");
  const tUnits = useTranslations("Units");
  const tCategory = useTranslations("MaterialCategory");
  const locale = useLocale();

  function preview(values: Record<string, unknown>): string | null {
    const parsed = materialInputSchema.safeParse(values);
    if (!parsed.success) return null;
    const unit = BASE_UNIT[dimensionOf(parsed.data.purchaseUnit)];
    return t("costPreview", { cost: formatRupiah(unitCost(parsed.data), locale, 2), unit });
  }

  const [cost, setCost] = useState(() => preview(defaults));
  function onChange(event: FormEvent<HTMLFieldSetElement>) {
    const form = event.currentTarget.form;
    if (form) setCost(preview(Object.fromEntries(new FormData(form))));
  }

  return (
    <fieldset className="space-y-4" onChange={onChange}>
      <div className="space-y-1">
        <Label htmlFor="material-name">{t("name")}</Label>
        <Input id="material-name" name="name" defaultValue={defaults.name} placeholder={t("namePlaceholder")} maxLength={80} />
        <FieldError errors={errors.name} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="material-category">{t("category")}</Label>
        <NativeSelect id="material-category" name="category" defaultValue={defaults.category ?? "bahan"}>
          {MATERIAL_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {tCategory(category)}
            </option>
          ))}
        </NativeSelect>
        <FieldError errors={errors.category} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <div className="space-y-1">
          <Label htmlFor="material-qty">{t("purchaseQty")}</Label>
          <Input id="material-qty" name="purchaseQty" inputMode="decimal" defaultValue={defaults.purchaseQty} />
          <FieldError errors={errors.purchaseQty} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="material-unit">{t("purchaseUnit")}</Label>
          <NativeSelect id="material-unit" name="purchaseUnit" defaultValue={defaults.purchaseUnit ?? "kg"}>
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {tUnits(unit)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.purchaseUnit} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="material-price">{t("purchasePrice")}</Label>
        <Input id="material-price" name="purchasePrice" inputMode="numeric" defaultValue={defaults.purchasePrice} placeholder="15.000" />
        <FieldError errors={errors.purchasePrice} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="material-waste">{t("wastePct")}</Label>
        <Input id="material-waste" name="wastePct" inputMode="decimal" defaultValue={defaults.wastePct} placeholder="0" />
        <p className="text-xs text-muted-foreground">{t("wasteHint")}</p>
        <FieldError errors={errors.wastePct} />
      </div>
      <p aria-live="polite" className="min-h-5 text-sm font-medium">
        {cost}
      </p>
    </fieldset>
  );
}
```

`app/[locale]/s/[storeId]/bahan/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { BASE_UNIT, dimensionOf, unitCost } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { createMaterialAction } from "./actions";
import { MaterialForm } from "./material-form";

export default async function MaterialsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Materials");
  const tCommon = await getTranslations("Common");
  const tCategory = await getTranslations("MaterialCategory");
  const locale = await getLocale();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.materials.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-material" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.materials.map((material) => (
            <li key={material.id}>
              <Link
                href={`/s/${data.store.id}/bahan/${material.id}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
              >
                <span className="min-w-0">
                  <span className="block font-medium [overflow-wrap:anywhere]">{material.name}</span>
                  <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {tCategory(material.category)} · {formatNumber(material.purchaseQty, locale)} {material.purchaseUnit} ·{" "}
                    {formatRupiah(material.purchasePrice, locale)}
                    {material.wastePct > 0 && ` · ${t("wasteValue", { pct: formatPercent(material.wastePct, locale) })}`}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-medium">
                  {t("perBaseUnit", {
                    cost: formatRupiah(unitCost(material), locale, 2),
                    unit: BASE_UNIT[dimensionOf(material.purchaseUnit)],
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <MaterialForm
            id="add-material"
            action={createMaterialAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/[locale]/s/[storeId]/bahan/[materialId]/page.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteMaterialAction, updateMaterialAction } from "../actions";
import { MaterialForm } from "../material-form";

type Params = Promise<{ locale: string; storeId: string; materialId: string }>;

export default async function EditMaterialPage({ params }: { params: Params }) {
  const { storeId, materialId } = await params;
  const data = await loadStoreData(storeId);
  const material = data?.materials.find((m) => m.id === materialId);
  if (!data || !material) notFound();
  const t = await getTranslations("Materials");
  const tCommon = await getTranslations("Common");
  const usedIn = data.products.filter((product) =>
    data.composition.some((row) => row.productId === product.id && row.materialId === material.id),
  );

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/bahan`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <MaterialForm
            action={updateMaterialAction.bind(null, data.store.id, material.id)}
            defaults={{
              name: material.name,
              category: material.category,
              purchaseQty: String(material.purchaseQty),
              purchaseUnit: material.purchaseUnit,
              purchasePrice: String(material.purchasePrice),
              wastePct: String(material.wastePct),
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      {usedIn.length > 0 && (
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {t("usedIn", { products: usedIn.map((product) => product.name).join(", ") })}
        </p>
      )}
      <DeleteButton action={deleteMaterialAction.bind(null, data.store.id, material.id)} label={t("delete")} />
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsc --noEmit && npx eslint . && npm test`, then build and run `npx playwright test tests/e2e/materials.spec.ts` against the production server.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/empty-state.tsx "app/[locale]/s/[storeId]/bahan" messages tests/e2e/helpers.ts tests/e2e/materials.spec.ts
git commit -m "feat(materials): materials page with live cost per base unit, edit and delete"
```

---

### Task 11: Operating costs page (`biaya`)

**Files:**
- Create: `app/[locale]/s/[storeId]/biaya/page.tsx`, `app/[locale]/s/[storeId]/biaya/actions.ts`, `app/[locale]/s/[storeId]/biaya/expense-form.tsx`, `app/[locale]/s/[storeId]/biaya/[expenseId]/page.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Expenses`, `ExpenseCategory`, `Frequency`), `tests/e2e/helpers.ts` (add `addExpense`)
- Test: `tests/e2e/expenses.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 7, 8, 10 (`EmptyState`, `storeUrl`).
- Produces: Server Actions `createExpenseAction(storeId, prev, formData)`, `updateExpenseAction(storeId, expenseId, prev, formData)`, `deleteExpenseAction(storeId, expenseId)` — fields `name`, `category`, `amount`, `frequency`; delete redirects to `/s/{storeId}/biaya`. e2e helper `addExpense(page, e: { name: string; category: ExpenseCategory; amount: string; frequency: Frequency })` — fills the form `#add-expense` and waits for "Biaya ditambahkan.".

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:

```ts
export async function addExpense(page: Page, e: { name: string; category: string; amount: string; frequency: string }) {
  const form = page.locator("#add-expense");
  await form.getByLabel("Nama biaya").fill(e.name);
  await form.getByLabel("Kategori").selectOption(e.category);
  await form.getByLabel("Jumlah (Rp)").fill(e.amount);
  await form.getByLabel("Dibayar").selectOption(e.frequency);
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Biaya ditambahkan.")).toBeVisible();
}
```

`tests/e2e/expenses.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/expenses.spec.ts` (production build)
Expected: FAIL — 404.

- [ ] **Step 3: Add the messages**

`messages/id.json`:

```json
  "ExpenseCategory": {
    "sewa": "Sewa tempat",
    "listrik_air": "Listrik & air",
    "internet_pulsa": "Internet & pulsa",
    "gaji_karyawan": "Gaji karyawan",
    "gaji_pemilik": "Gaji kamu sendiri",
    "transportasi": "Transportasi",
    "pemasaran": "Pemasaran",
    "lainnya": "Lainnya"
  },
  "Frequency": { "harian": "per hari", "mingguan": "per minggu", "bulanan": "per bulan", "tahunan": "per tahun" },
  "Expenses": {
    "title": "Biaya operasional",
    "intro": "Biaya rutin di luar bahan: sewa, listrik, gaji, dan lainnya.",
    "addTitle": "Tambah biaya",
    "editTitle": "Ubah biaya",
    "name": "Nama biaya",
    "namePlaceholder": "Contoh: Sewa kios",
    "category": "Kategori",
    "amount": "Jumlah (Rp)",
    "frequency": "Dibayar",
    "oneTimeHint": "Biaya sekali bayar seperti endorse: pilih \"per tahun\", atau bagi sendiri per bulan.",
    "ownerSalaryHint": "Masukkan juga gaji untuk dirimu sendiri (kategori \"Gaji kamu sendiri\"), supaya laba yang terlihat tidak menipu.",
    "monthlyTotal": "Total per bulan",
    "amountPerFrequency": "{amount} {frequency}",
    "monthlyValue": "≈ {amount}/bulan",
    "emptyTitle": "Belum ada biaya",
    "emptyBody": "Contoh: Sewa kios Rp1.500.000 per bulan, listrik Rp300.000 per bulan.",
    "emptyAction": "Tambah biaya pertama",
    "created": "Biaya ditambahkan.",
    "delete": "Hapus biaya"
  },
```

`messages/en.json`:

```json
  "ExpenseCategory": {
    "sewa": "Rent",
    "listrik_air": "Electricity & water",
    "internet_pulsa": "Internet & phone credit",
    "gaji_karyawan": "Staff wages",
    "gaji_pemilik": "Your own salary",
    "transportasi": "Transport",
    "pemasaran": "Marketing",
    "lainnya": "Other"
  },
  "Frequency": { "harian": "per day", "mingguan": "per week", "bulanan": "per month", "tahunan": "per year" },
  "Expenses": {
    "title": "Operating costs",
    "intro": "Running costs besides materials: rent, electricity, wages and more.",
    "addTitle": "Add cost",
    "editTitle": "Edit cost",
    "name": "Cost name",
    "namePlaceholder": "E.g. Stall rent",
    "category": "Category",
    "amount": "Amount (Rp)",
    "frequency": "Paid",
    "oneTimeHint": "One-off costs such as a promotion: choose \"per year\", or split it per month yourself.",
    "ownerSalaryHint": "Also add a salary for yourself (category \"Your own salary\"), so the profit you see isn't misleading.",
    "monthlyTotal": "Monthly total",
    "amountPerFrequency": "{amount} {frequency}",
    "monthlyValue": "≈ {amount}/month",
    "emptyTitle": "No costs yet",
    "emptyBody": "E.g. stall rent Rp1,500,000 per month, electricity Rp300,000 per month.",
    "emptyAction": "Add your first cost",
    "created": "Cost added.",
    "delete": "Delete cost"
  },
```

- [ ] **Step 4: Implement**

`app/[locale]/s/[storeId]/biaya/actions.ts`:

```ts
"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
import { expenseInputSchema, toExpenseColumns } from "@/lib/validation/expense";

const FIELDS = ["name", "category", "amount", "frequency"] as const;

async function parseExpense(formData: FormData) {
  const values = rawValues(formData, FIELDS);
  const parsed = expenseInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createExpenseAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseExpense(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("operating_expenses").insert({ store_id: storeId, ...toExpenseColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Expenses"))("created") };
}

export async function updateExpenseAction(
  storeId: string,
  expenseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseExpense(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(expenseId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("operating_expenses")
    .update(toExpenseColumns(parsed.input))
    .eq("id", expenseId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteExpenseAction(storeId: string, expenseId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(expenseId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("operating_expenses")
    .delete()
    .eq("id", expenseId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/biaya`, locale: await getLocale() });
}
```

`app/[locale]/s/[storeId]/biaya/expense-form.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORIES, FREQUENCIES } from "@/lib/calc";
import type { FormState } from "@/lib/forms";

export type ExpenseFormDefaults = Partial<Record<"name" | "category" | "amount" | "frequency", string>>;

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = { action: Action; defaults?: ExpenseFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function ExpenseForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Expenses");
  const tCategory = useTranslations("ExpenseCategory");
  const tFrequency = useTranslations("Frequency");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={`${id ?? "expense"}-name`}>{t("name")}</Label>
          <Input id={`${id ?? "expense"}-name`} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={80} />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id ?? "expense"}-category`}>{t("category")}</Label>
          <NativeSelect id={`${id ?? "expense"}-category`} name="category" defaultValue={current.category ?? "sewa"}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.category} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${id ?? "expense"}-amount`}>{t("amount")}</Label>
            <Input id={`${id ?? "expense"}-amount`} name="amount" inputMode="numeric" defaultValue={current.amount} placeholder="1.500.000" />
            <FieldError errors={errors.amount} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id ?? "expense"}-frequency`}>{t("frequency")}</Label>
            <NativeSelect id={`${id ?? "expense"}-frequency`} name="frequency" defaultValue={current.frequency ?? "bulanan"}>
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {tFrequency(frequency)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.frequency} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("oneTimeHint")}</p>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
```

`app/[locale]/s/[storeId]/biaya/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { monthlyAmount, monthlyExpenses } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatRupiah } from "@/lib/format";
import { createExpenseAction } from "./actions";
import { ExpenseForm } from "./expense-form";

export default async function ExpensesPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Expenses");
  const tCommon = await getTranslations("Common");
  const tCategory = await getTranslations("ExpenseCategory");
  const tFrequency = await getTranslations("Frequency");
  const locale = await getLocale();
  const days = data.store.operatingDaysPerMonth;
  const hasOwnerSalary = data.expenses.some((expense) => expense.category === "gaji_pemilik");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {!hasOwnerSalary && (
        <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          {t("ownerSalaryHint")}
        </p>
      )}

      {data.expenses.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-expense" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y rounded-lg border">
            {data.expenses.map((expense) => (
              <li key={expense.id}>
                <Link
                  href={`/s/${data.store.id}/biaya/${expense.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{expense.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {tCategory(expense.category)} ·{" "}
                      {t("amountPerFrequency", {
                        amount: formatRupiah(expense.amount, locale),
                        frequency: tFrequency(expense.frequency),
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium">
                    {t("monthlyValue", { amount: formatRupiah(monthlyAmount(expense, days), locale) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="flex justify-between gap-3 px-1 font-medium">
            <span>{t("monthlyTotal")}</span>
            <span data-testid="expenses-total">{formatRupiah(monthlyExpenses(data.expenses, days), locale)}</span>
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            id="add-expense"
            action={createExpenseAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/[locale]/s/[storeId]/biaya/[expenseId]/page.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteExpenseAction, updateExpenseAction } from "../actions";
import { ExpenseForm } from "../expense-form";

type Params = Promise<{ locale: string; storeId: string; expenseId: string }>;

export default async function EditExpensePage({ params }: { params: Params }) {
  const { storeId, expenseId } = await params;
  const data = await loadStoreData(storeId);
  const expense = data?.expenses.find((e) => e.id === expenseId);
  if (!data || !expense) notFound();
  const t = await getTranslations("Expenses");
  const tCommon = await getTranslations("Common");

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/biaya`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <ExpenseForm
            action={updateExpenseAction.bind(null, data.store.id, expense.id)}
            defaults={{
              name: expense.name,
              category: expense.category,
              amount: String(expense.amount),
              frequency: expense.frequency,
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <DeleteButton action={deleteExpenseAction.bind(null, data.store.id, expense.id)} label={t("delete")} />
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsc --noEmit && npx eslint . && npm test`, then `npx playwright test tests/e2e/expenses.spec.ts` against a production build.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/s/[storeId]/biaya" messages tests/e2e/helpers.ts tests/e2e/expenses.spec.ts
git commit -m "feat(expenses): operating costs page with monthly equivalents and owner-salary hint"
```

---

### Task 12: Inventory page (`inventaris`)

**Files:**
- Create: `app/[locale]/s/[storeId]/inventaris/page.tsx`, `app/[locale]/s/[storeId]/inventaris/actions.ts`, `app/[locale]/s/[storeId]/inventaris/asset-form.tsx`, `app/[locale]/s/[storeId]/inventaris/[assetId]/page.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Assets`, `AssetCategory`), `tests/e2e/helpers.ts` (add `addAsset`)
- Test: `tests/e2e/assets.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 7, 8, 10.
- Produces: Server Actions `createAssetAction(storeId, prev, formData)`, `updateAssetAction(storeId, assetId, prev, formData)`, `deleteAssetAction(storeId, assetId)` — fields `name`, `category`, `qty`, `unitPrice`, `usefulLifeMonths`; delete redirects to `/s/{storeId}/inventaris`. e2e helper `addAsset(page, a: { name: string; category: AssetCategory; qty: string; unitPrice: string; usefulLifeMonths: string })` — fills `#add-asset`, waits for "Barang ditambahkan.".

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:

```ts
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
}
```

`tests/e2e/assets.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { addAsset, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Inventaris");
  await page.goto(storeUrl(page, "inventaris"));
});

test("totals capital and monthly depreciation", async ({ page }) => {
  await expect(page.getByText("Belum ada inventaris")).toBeVisible();
  await addAsset(page, { name: "Meja kayu", category: "furnitur", qty: "2", unitPrice: "1.200.000", usefulLifeMonths: "24" });
  await addAsset(page, { name: "Freezer", category: "elektronik", qty: "1", unitPrice: "6.000.000", usefulLifeMonths: "60" });

  await expect(page.getByRole("link", { name: /Meja kayu/ })).toContainText("Rp100.000");
  await expect(page.getByTestId("assets-capital")).toHaveText("Rp8.400.000");
  await expect(page.getByTestId("assets-depreciation")).toHaveText("Rp200.000");
});

test("edits and deletes an item", async ({ page }) => {
  await addAsset(page, { name: "Kompor", category: "peralatan", qty: "1", unitPrice: "500.000", usefulLifeMonths: "36" });
  await page.getByRole("link", { name: /Kompor/ }).click();
  await page.getByLabel("Jumlah", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.getByRole("button", { name: "Hapus barang" }).click();
  await page.getByRole("button", { name: "Hapus barang" }).click();
  await expect(page).toHaveURL(/\/inventaris$/);
  await expect(page.getByText("Belum ada inventaris")).toBeVisible();
});

test("rejects a useful life of 0 months", async ({ page }) => {
  const form = page.locator("#add-asset");
  await form.getByLabel("Nama barang").fill("Blender");
  await form.getByLabel("Harga satuan (Rp)").fill("400.000");
  await form.getByLabel("Umur pakai (bulan)").fill("0");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Umur pakai minimal 1 bulan")).toBeVisible();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/assets.spec.ts` (production build)
Expected: FAIL — 404.

- [ ] **Step 3: Add the messages**

`messages/id.json`:

```json
  "AssetCategory": {
    "peralatan": "Peralatan",
    "furnitur": "Furnitur",
    "elektronik": "Elektronik",
    "kendaraan": "Kendaraan",
    "renovasi": "Renovasi",
    "perizinan": "Perizinan",
    "lainnya": "Lainnya"
  },
  "Assets": {
    "title": "Inventaris",
    "intro": "Alat dan perlengkapan usaha: meja, kursi, kompor, freezer. Totalnya dipakai sebagai modal awal.",
    "addTitle": "Tambah barang",
    "editTitle": "Ubah barang",
    "name": "Nama barang",
    "namePlaceholder": "Contoh: Meja kayu",
    "category": "Kategori",
    "qty": "Jumlah",
    "unitPrice": "Harga satuan (Rp)",
    "usefulLife": "Umur pakai (bulan)",
    "usefulLifeHint": "Perkiraan berapa lama barang ini bisa dipakai. Contoh: 24 bulan untuk blender, 60 bulan untuk freezer.",
    "totalCapital": "Total modal",
    "monthlyDepreciation": "Penyusutan per bulan",
    "depreciationHint": "Nilai barang yang berkurang tiap bulan. Dihitung sebagai biaya tetap.",
    "itemSummary": "{qty} × {price}",
    "itemDepreciation": "{amount}/bulan",
    "emptyTitle": "Belum ada inventaris",
    "emptyBody": "Contoh: Meja kayu, 2 buah, Rp350.000, umur pakai 60 bulan.",
    "emptyAction": "Tambah barang pertama",
    "created": "Barang ditambahkan.",
    "delete": "Hapus barang"
  },
```

`messages/en.json`:

```json
  "AssetCategory": {
    "peralatan": "Equipment",
    "furnitur": "Furniture",
    "elektronik": "Electronics",
    "kendaraan": "Vehicle",
    "renovasi": "Renovation",
    "perizinan": "Permits",
    "lainnya": "Other"
  },
  "Assets": {
    "title": "Inventory",
    "intro": "Business equipment: tables, chairs, stoves, freezers. The total is used as your starting capital.",
    "addTitle": "Add item",
    "editTitle": "Edit item",
    "name": "Item name",
    "namePlaceholder": "E.g. Wooden table",
    "category": "Category",
    "qty": "Quantity",
    "unitPrice": "Unit price (Rp)",
    "usefulLife": "Useful life (months)",
    "usefulLifeHint": "Roughly how long the item lasts. E.g. 24 months for a blender, 60 months for a freezer.",
    "totalCapital": "Total capital",
    "monthlyDepreciation": "Monthly depreciation",
    "depreciationHint": "The value the items lose each month. Counted as a fixed cost.",
    "itemSummary": "{qty} × {price}",
    "itemDepreciation": "{amount}/month",
    "emptyTitle": "No inventory yet",
    "emptyBody": "E.g. Wooden table, 2 pieces, Rp350,000, useful life 60 months.",
    "emptyAction": "Add your first item",
    "created": "Item added.",
    "delete": "Delete item"
  },
```

- [ ] **Step 4: Implement**

`app/[locale]/s/[storeId]/inventaris/actions.ts`:

```ts
"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
import { assetInputSchema, toAssetColumns } from "@/lib/validation/asset";

const FIELDS = ["name", "category", "qty", "unitPrice", "usefulLifeMonths"] as const;

async function parseAsset(formData: FormData) {
  const values = rawValues(formData, FIELDS);
  const parsed = assetInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createAssetAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseAsset(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("assets").insert({ store_id: storeId, ...toAssetColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Assets"))("created") };
}

export async function updateAssetAction(
  storeId: string,
  assetId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseAsset(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(assetId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("assets")
    .update(toAssetColumns(parsed.input))
    .eq("id", assetId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteAssetAction(storeId: string, assetId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(assetId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("assets").delete().eq("id", assetId).eq("store_id", storeId).select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/inventaris`, locale: await getLocale() });
}
```

`app/[locale]/s/[storeId]/inventaris/asset-form.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSET_CATEGORIES } from "@/lib/calc";
import type { FormState } from "@/lib/forms";

export type AssetFormDefaults = Partial<Record<"name" | "category" | "qty" | "unitPrice" | "usefulLifeMonths", string>>;

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = { action: Action; defaults?: AssetFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function AssetForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Assets");
  const tCategory = useTranslations("AssetCategory");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};
  const field = (name: string) => `${id ?? "asset"}-${name}`;

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={field("name")}>{t("name")}</Label>
          <Input id={field("name")} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={80} />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("category")}>{t("category")}</Label>
          <NativeSelect id={field("category")} name="category" defaultValue={current.category ?? "peralatan"}>
            {ASSET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.category} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
          <div className="space-y-1">
            <Label htmlFor={field("qty")}>{t("qty")}</Label>
            <Input id={field("qty")} name="qty" inputMode="numeric" defaultValue={current.qty ?? "1"} />
            <FieldError errors={errors.qty} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={field("unitPrice")}>{t("unitPrice")}</Label>
            <Input id={field("unitPrice")} name="unitPrice" inputMode="numeric" defaultValue={current.unitPrice} placeholder="350.000" />
            <FieldError errors={errors.unitPrice} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("life")}>{t("usefulLife")}</Label>
          <Input id={field("life")} name="usefulLifeMonths" inputMode="numeric" defaultValue={current.usefulLifeMonths} placeholder="24" />
          <p className="text-xs text-muted-foreground">{t("usefulLifeHint")}</p>
          <FieldError errors={errors.usefulLifeMonths} />
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
```

`app/[locale]/s/[storeId]/inventaris/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { assetMonthlyDepreciation, monthlyDepreciation, totalCapital } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatNumber, formatRupiah } from "@/lib/format";
import { createAssetAction } from "./actions";
import { AssetForm } from "./asset-form";

export default async function AssetsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Assets");
  const tCommon = await getTranslations("Common");
  const tCategory = await getTranslations("AssetCategory");
  const locale = await getLocale();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.assets.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-asset" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("totalCapital")}</p>
                <p className="text-lg font-semibold [overflow-wrap:anywhere]" data-testid="assets-capital">
                  {formatRupiah(totalCapital(data.assets), locale)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("monthlyDepreciation")}</p>
                <p className="text-lg font-semibold [overflow-wrap:anywhere]" data-testid="assets-depreciation">
                  {formatRupiah(monthlyDepreciation(data.assets), locale)}
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">{t("depreciationHint")}</p>
          <ul className="divide-y rounded-lg border">
            {data.assets.map((asset) => (
              <li key={asset.id}>
                <Link
                  href={`/s/${data.store.id}/inventaris/${asset.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{asset.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {tCategory(asset.category)} ·{" "}
                      {t("itemSummary", { qty: formatNumber(asset.qty, locale), price: formatRupiah(asset.unitPrice, locale) })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-medium">
                    {t("itemDepreciation", { amount: formatRupiah(assetMonthlyDepreciation(asset), locale) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            id="add-asset"
            action={createAssetAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/[locale]/s/[storeId]/inventaris/[assetId]/page.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteAssetAction, updateAssetAction } from "../actions";
import { AssetForm } from "../asset-form";

type Params = Promise<{ locale: string; storeId: string; assetId: string }>;

export default async function EditAssetPage({ params }: { params: Params }) {
  const { storeId, assetId } = await params;
  const data = await loadStoreData(storeId);
  const asset = data?.assets.find((a) => a.id === assetId);
  if (!data || !asset) notFound();
  const t = await getTranslations("Assets");
  const tCommon = await getTranslations("Common");

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/inventaris`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <AssetForm
            action={updateAssetAction.bind(null, data.store.id, asset.id)}
            defaults={{
              name: asset.name,
              category: asset.category,
              qty: String(asset.qty),
              unitPrice: String(asset.unitPrice),
              usefulLifeMonths: String(asset.usefulLifeMonths),
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <DeleteButton action={deleteAssetAction.bind(null, data.store.id, asset.id)} label={t("delete")} />
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsc --noEmit && npx eslint . && npm test`, then `npx playwright test tests/e2e/assets.spec.ts` against a production build.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/s/[storeId]/inventaris" messages tests/e2e/helpers.ts tests/e2e/assets.spec.ts
git commit -m "feat(assets): inventory page with total capital and monthly depreciation"
```

---

### Task 13: Products list and product details

**Files:**
- Modify: `lib/calc/index.ts` (add `worstStatus`, `tryAnalyzeStore`)
- Create: `components/store/status-badge.tsx`
- Create: `app/[locale]/s/[storeId]/produk/page.tsx`, `app/[locale]/s/[storeId]/produk/actions.ts`, `app/[locale]/s/[storeId]/produk/product-form.tsx`, `app/[locale]/s/[storeId]/produk/[productId]/page.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Products`, `LineStatus`), `tests/e2e/helpers.ts` (add `addProduct`)
- Test: `tests/unit/calc/analyze.test.ts`, `tests/e2e/products.spec.ts`

**Interfaces:**
- Consumes: Tasks 5–8, 10 (`EmptyState`, `storeUrl`).
- Produces:
  - From `@/lib/calc`: `worstStatus(lines: { status: LineStatus }[]): LineStatus | null` (red < yellow < green); `type AnalysisResult = { analysis: StoreAnalysis; error: null } | { analysis: null; error: CalcError }`; `tryAnalyzeStore(data: StoreData): AnalysisResult` (rethrows anything that is not a `CalcError`).
  - `<StatusBadge status={LineStatus} />` — colour plus text (`LineStatus` messages).
  - Server Actions `createProductAction(storeId, prev, formData)` (redirects to `/s/{storeId}/produk/{newId}`), `updateProductAction(storeId, productId, prev, formData)`, `deleteProductAction(storeId, productId)` (redirects to `/s/{storeId}/produk`) — fields `name`, `category`, `yieldQty`, `targetMarginPct`, `isActive` (checkbox; the create form sends a hidden `isActive=true`).
  - `<ProductForm mode="create" | "edit" … />`.
  - The product page `produk/[productId]/page.tsx` renders, in order: back link, heading (+ "Tidak dijual" badge), **details card**, delete button. Tasks 14 and 15 insert their sections between the heading and the details card.
  - e2e helper `addProduct(page, p: { name: string; yieldQty: string; category?: string })` — fills `#add-product` on the `produk` page and waits for the product page URL.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/calc/analyze.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CalcError, tryAnalyzeStore, worstStatus } from "@/lib/calc";
import { fixture } from "./fixture";

describe("tryAnalyzeStore", () => {
  it("returns the analysis", () => {
    const result = tryAnalyzeStore(fixture());
    expect(result.error).toBeNull();
    expect(result.analysis?.netProfit).toBeCloseTo(3030000, 6);
  });

  it("returns a CalcError instead of throwing", () => {
    const data = fixture();
    data.composition[0] = { ...data.composition[0], unit: "ml" };
    const result = tryAnalyzeStore(data);
    expect(result.analysis).toBeNull();
    expect(result.error).toBeInstanceOf(CalcError);
    expect(result.error).toMatchObject({ code: "UNIT_DIMENSION_MISMATCH", productId: "eskopi" });
  });
});

describe("worstStatus", () => {
  it.each([
    [[], null],
    [["green"], "green"],
    [["green", "yellow"], "yellow"],
    [["green", "red", "yellow"], "red"],
  ] as const)("%j → %s", (statuses, expected) => {
    expect(worstStatus(statuses.map((status) => ({ status })))).toBe(expected);
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement**

Run: `npx vitest run tests/unit/calc/analyze.test.ts` — Expected: FAIL (`tryAnalyzeStore` not exported).

Append to `lib/calc/index.ts` (and add `import { CalcError } from "./products";` plus `type LineStatus` to the `./metrics` import at the top):

```ts
const STATUS_RANK: Record<LineStatus, number> = { red: 0, yellow: 1, green: 2 };

/** The most serious status among lines, or null when there are none. */
export function worstStatus(lines: { status: LineStatus }[]): LineStatus | null {
  return lines.reduce<LineStatus | null>(
    (worst, line) => (worst === null || STATUS_RANK[line.status] < STATUS_RANK[worst] ? line.status : worst),
    null,
  );
}

export type AnalysisResult = { analysis: StoreAnalysis; error: null } | { analysis: null; error: CalcError };

/** analyzeStore that returns a CalcError instead of throwing, so pages can say what to fix. */
export function tryAnalyzeStore(data: StoreData): AnalysisResult {
  try {
    return { analysis: analyzeStore(data), error: null };
  } catch (error) {
    if (error instanceof CalcError) return { analysis: null, error };
    throw error;
  }
}
```

Run: `npx vitest run tests/unit/calc` — Expected: PASS.

- [ ] **Step 3: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:

```ts
export async function addProduct(page: Page, p: { name: string; yieldQty: string; category?: string }) {
  const form = page.locator("#add-product");
  await form.getByLabel("Nama produk").fill(p.name);
  await form.getByLabel("Hasil per resep").fill(p.yieldQty);
  if (p.category) await form.getByLabel("Kategori (opsional)").fill(p.category);
  await form.getByRole("button", { name: "Tambah" }).click();
  await page.waitForURL(/\/produk\/[0-9a-f-]{36}$/);
}
```

`tests/e2e/products.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { addProduct, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Produk");
  await page.goto(storeUrl(page, "produk"));
});

test("creates a product and opens it", async ({ page }) => {
  await expect(page.getByText("Belum ada produk")).toBeVisible();
  await addProduct(page, { name: "Es kopi susu", yieldQty: "10", category: "Minuman" });
  await expect(page.getByRole("heading", { name: "Es kopi susu" })).toBeVisible();
  await page.getByRole("link", { name: "Kembali" }).click();
  await expect(page.getByRole("link", { name: /Es kopi susu/ })).toContainText("Belum ada harga");
});

test("edits details: own margin and not on sale", async ({ page }) => {
  await addProduct(page, { name: "Roti bakar", yieldQty: "4" });
  await page.getByLabel("Target margin khusus (%)").fill("25");
  await page.getByLabel("Masih dijual").uncheck();
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await expect(page.getByLabel("Masih dijual")).not.toBeChecked();
  await expect(page.getByLabel("Target margin khusus (%)")).toHaveValue("25");
  await page.goto(storeUrl(page, "produk"));
  await expect(page.getByRole("link", { name: /Roti bakar/ })).toContainText("Tidak dijual");
});

test("rejects a yield of 0", async ({ page }) => {
  const form = page.locator("#add-product");
  await form.getByLabel("Nama produk").fill("Kue");
  await form.getByLabel("Hasil per resep").fill("0");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Hasil per resep harus lebih dari 0")).toBeVisible();
  await expect(form.getByLabel("Nama produk")).toHaveValue("Kue");
});

test("deletes a product", async ({ page }) => {
  await addProduct(page, { name: "Produk lama", yieldQty: "1" });
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await expect(page).toHaveURL(/\/produk$/);
  await expect(page.getByText("Belum ada produk")).toBeVisible();
});
```

Run (production build): `npx playwright test tests/e2e/products.spec.ts` — Expected: FAIL (404).

- [ ] **Step 4: Add the messages**

`messages/id.json`:

```json
  "LineStatus": { "red": "Rugi", "yellow": "Di bawah target", "green": "Sesuai target" },
  "Products": {
    "title": "Produk",
    "intro": "Produk yang kamu jual. Buka produk untuk mengisi komposisi dan harga.",
    "addTitle": "Tambah produk",
    "details": "Data produk",
    "name": "Nama produk",
    "namePlaceholder": "Contoh: Es kopi susu",
    "category": "Kategori (opsional)",
    "categoryPlaceholder": "Contoh: Minuman",
    "yieldQty": "Hasil per resep",
    "yieldHint": "Satu kali membuat (satu resep) jadi berapa porsi atau unit? Contoh: 10 gelas.",
    "targetMargin": "Target margin khusus (%)",
    "targetMarginHint": "Kosongkan untuk memakai target toko ({pct}).",
    "isActive": "Masih dijual",
    "inactive": "Tidak dijual",
    "noPrice": "Belum ada harga",
    "materialCostValue": "HPP bahan {cost}",
    "emptyTitle": "Belum ada produk",
    "emptyBody": "Tambahkan produk yang kamu jual, lalu isi komposisi bahannya. Contoh: Es kopi susu, 1 resep = 10 gelas.",
    "emptyAction": "Tambah produk pertama",
    "delete": "Hapus produk"
  },
```

`messages/en.json`:

```json
  "LineStatus": { "red": "Loss", "yellow": "Below target", "green": "On target" },
  "Products": {
    "title": "Products",
    "intro": "The products you sell. Open a product to fill in its composition and price.",
    "addTitle": "Add product",
    "details": "Product details",
    "name": "Product name",
    "namePlaceholder": "E.g. Iced milk coffee",
    "category": "Category (optional)",
    "categoryPlaceholder": "E.g. Drinks",
    "yieldQty": "Yield per recipe",
    "yieldHint": "How many portions or units does one batch (one recipe) make? E.g. 10 cups.",
    "targetMargin": "Own target margin (%)",
    "targetMarginHint": "Leave empty to use the store target ({pct}).",
    "isActive": "Still on sale",
    "inactive": "Not on sale",
    "noPrice": "No price yet",
    "materialCostValue": "Material cost {cost}",
    "emptyTitle": "No products yet",
    "emptyBody": "Add the products you sell, then fill in their materials. E.g. Iced milk coffee, 1 recipe = 10 cups.",
    "emptyAction": "Add your first product",
    "delete": "Delete product"
  },
```

- [ ] **Step 5: Implement**

`components/store/status-badge.tsx`:

```tsx
import { useTranslations } from "next-intl";
import type { LineStatus } from "@/lib/calc";
import { cn } from "@/lib/utils";

const STYLES: Record<LineStatus, string> = {
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  yellow: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  green: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
};

/** A line's status as colour and text, never colour alone. */
export function StatusBadge({ status }: { status: LineStatus }) {
  const t = useTranslations("LineStatus");
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", STYLES[status])}>
      {t(status)}
    </span>
  );
}
```

`app/[locale]/s/[storeId]/produk/actions.ts`:

```ts
"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { revalidateStore } from "@/lib/data/revalidate";
import { rawValues, type FormState } from "@/lib/forms";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { isUuid } from "@/lib/uuid";
import { productInputSchema, toProductColumns } from "@/lib/validation/product";

const PRODUCT_FIELDS = ["name", "category", "yieldQty", "targetMarginPct", "isActive"] as const;

async function parseProduct(formData: FormData) {
  const values = rawValues(formData, PRODUCT_FIELDS);
  const parsed = productInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

export async function createProductAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseProduct(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("products")
    .insert({ store_id: storeId, ...toProductColumns(parsed.input) })
    .select("id")
    .single();
  if (error || !data) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  // Straight to the new product so the seller can fill in its composition.
  return redirect({ href: `/s/${storeId}/produk/${data.id}`, locale: await getLocale() });
}

export async function updateProductAction(
  storeId: string,
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseProduct(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(productId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("products")
    .update(toProductColumns(parsed.input))
    .eq("id", productId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteProductAction(storeId: string, productId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(productId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  // Composition rows and prices cascade with the product.
  const { data, error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", storeId).select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/produk`, locale: await getLocale() });
}
```

`app/[locale]/s/[storeId]/produk/product-form.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/forms";

export type ProductFormDefaults = Partial<Record<"name" | "category" | "yieldQty" | "targetMarginPct" | "isActive", string>>;

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  mode: "create" | "edit";
  /** The store's target margin, already formatted (e.g. "40%"). */
  storeTargetMargin: string;
  defaults?: ProductFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  id?: string;
};

export function ProductForm({ action, mode, storeTargetMargin, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Products");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};
  const field = (name: string) => `${id ?? "product"}-${name}`;

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={field("name")}>{t("name")}</Label>
          <Input id={field("name")} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={80} />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("yield")}>{t("yieldQty")}</Label>
          <Input id={field("yield")} name="yieldQty" inputMode="decimal" defaultValue={current.yieldQty ?? "1"} />
          <p className="text-xs text-muted-foreground">{t("yieldHint")}</p>
          <FieldError errors={errors.yieldQty} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("category")}>{t("category")}</Label>
          <Input
            id={field("category")}
            name="category"
            defaultValue={current.category}
            placeholder={t("categoryPlaceholder")}
            maxLength={40}
          />
          <FieldError errors={errors.category} />
        </div>
        {mode === "create" ? (
          <input type="hidden" name="isActive" value="true" />
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor={field("margin")}>{t("targetMargin")}</Label>
              <Input id={field("margin")} name="targetMarginPct" inputMode="decimal" defaultValue={current.targetMarginPct} />
              <p className="text-xs text-muted-foreground">{t("targetMarginHint", { pct: storeTargetMargin })}</p>
              <FieldError errors={errors.targetMarginPct} />
            </div>
            <label className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={current.isActive === "on" || current.isActive === "true"}
                className="size-5 accent-primary"
              />
              {t("isActive")}
            </label>
          </>
        )}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
```

`app/[locale]/s/[storeId]/produk/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/store/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore, worstStatus } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatPercent, formatRupiah } from "@/lib/format";
import { createProductAction } from "./actions";
import { ProductForm } from "./product-form";

export default async function ProductsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Products");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();
  const { analysis } = tryAnalyzeStore(data);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {data.products.length === 0 ? (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <a href="#add-product" className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </a>
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.products.map((product) => {
            const lines = analysis?.lines.filter((line) => line.productId === product.id) ?? [];
            const status = worstStatus(lines);
            const summary = lines.length
              ? t("materialCostValue", { cost: formatRupiah(lines[0].materialCost, locale) })
              : t("noPrice");
            return (
              <li key={product.id}>
                <Link
                  href={`/s/${data.store.id}/produk/${product.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
                >
                  <span className="min-w-0">
                    <span className="block font-medium [overflow-wrap:anywhere]">{product.name}</span>
                    <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {product.category ? `${product.category} · ${summary}` : summary}
                    </span>
                  </span>
                  {!product.isActive ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{t("inactive")}</span>
                  ) : (
                    status && <StatusBadge status={status} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            id="add-product"
            mode="create"
            action={createProductAction.bind(null, data.store.id)}
            storeTargetMargin={formatPercent(data.store.targetMarginPct, locale)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/[locale]/s/[storeId]/produk/[productId]/page.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatPercent } from "@/lib/format";
import { deleteProductAction, updateProductAction } from "../actions";
import { ProductForm } from "../product-form";

type Params = Promise<{ locale: string; storeId: string; productId: string }>;

export default async function ProductPage({ params }: { params: Params }) {
  const { storeId, productId } = await params;
  const data = await loadStoreData(storeId);
  const product = data?.products.find((p) => p.id === productId);
  if (!data || !product) notFound();
  const t = await getTranslations("Products");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();

  return (
    <div className="max-w-2xl space-y-6">
      <Link href={`/s/${data.store.id}/produk`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 text-2xl font-semibold [overflow-wrap:anywhere]">{product.name}</h1>
        {!product.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t("inactive")}</span>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            mode="edit"
            action={updateProductAction.bind(null, data.store.id, product.id)}
            storeTargetMargin={formatPercent(data.store.targetMarginPct, locale)}
            defaults={{
              name: product.name,
              category: product.category ?? "",
              yieldQty: String(product.yieldQty),
              targetMarginPct: product.targetMarginPct === null ? "" : String(product.targetMarginPct),
              isActive: product.isActive ? "on" : "",
            }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <DeleteButton action={deleteProductAction.bind(null, data.store.id, product.id)} label={t("delete")} />
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx tsc --noEmit && npx eslint . && npm test`, then `npx playwright test tests/e2e/products.spec.ts` against a production build.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/calc/index.ts components/store/status-badge.tsx "app/[locale]/s/[storeId]/produk" messages tests/unit/calc/analyze.test.ts tests/e2e/helpers.ts tests/e2e/products.spec.ts
git commit -m "feat(products): product list with status, create, edit and delete"
```

---

### Task 14: Composition editor

**Files:**
- Modify: `app/[locale]/s/[storeId]/produk/actions.ts` (add composition actions), `app/[locale]/s/[storeId]/produk/[productId]/page.tsx` (insert the section)
- Create: `app/[locale]/s/[storeId]/produk/[productId]/composition-editor.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Composition`, `Basis`), `tests/e2e/helpers.ts` (add `addCompositionRow`)
- Test: `tests/e2e/composition.spec.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 7, 8, 10 (`addMaterial`), 13 (`addProduct`, product page structure).
- Produces:
  - Server Actions `addCompositionRowAction(storeId, productId, prev, formData)`, `updateCompositionRowAction(storeId, productId, rowId, prev, formData)`, `deleteCompositionRowAction(storeId, productId, rowId)` — fields `materialId`, `qty`, `unit`, `basis`; both add and update reject a material from another store (`fieldErrors.materialId`) and a unit of another dimension (`fieldErrors.unit`). Rows are shared across channels (`channel_id` null) in Phase 2.
  - `<CompositionEditor rows materials addAction updateActions deleteActions materialsHref />`; the add form has `id="add-composition"`; each row is an `<li>` containing the material name, its cost per sold unit, its own save form and a delete button labelled "Hapus {material} dari komposisi".
  - e2e helper `addCompositionRow(page, r: { material: string; qty: string; unit?: string; basis?: "batch" | "unit" })`.

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:

```ts
export async function addCompositionRow(page: Page, r: { material: string; qty: string; unit?: string; basis?: "batch" | "unit" }) {
  const form = page.locator("#add-composition");
  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: r.material });
  await form.getByLabel("Jumlah").fill(r.qty);
  if (r.unit) await form.getByLabel("Satuan").selectOption(r.unit);
  if (r.basis) await form.getByLabel("Dihitung").selectOption(r.basis);
  await form.getByRole("button", { name: "Tambah ke komposisi" }).click();
  await expect(page.getByText("Bahan ditambahkan ke komposisi.")).toBeVisible();
}
```

`tests/e2e/composition.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { addCompositionRow, addMaterial, addProduct, createStoreViaOnboarding, signIn, storeUrl } from "./helpers";

let productUrl = "";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Resep");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await addMaterial(page, { name: "Cup", qty: "1", unit: "lusin", price: "6.000", category: "kemasan" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh manis", yieldQty: "10" });
  productUrl = page.url();
});

const row = (page: Page, material: string) => page.getByRole("listitem").filter({ hasText: material });

test("offers only units of the material's kind and a sensible basis", async ({ page }) => {
  const form = page.locator("#add-composition");
  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: "Gula" });
  await expect(form.getByLabel("Satuan").locator("option")).toHaveText(["gram (g)", "ons (100 g)", "kilogram (kg)"]);
  await expect(form.getByLabel("Satuan")).toHaveValue("g");
  await expect(form.getByLabel("Dihitung")).toHaveValue("batch");

  await form.getByLabel("Bahan", { exact: true }).selectOption({ label: "Cup" });
  await expect(form.getByLabel("Satuan").locator("option")).toHaveText(["buah (pcs)", "lusin (12 pcs)"]);
  await expect(form.getByLabel("Satuan")).toHaveValue("pcs");
  await expect(form.getByLabel("Dihitung")).toHaveValue("unit");
});

test("adds, edits and removes rows with their cost per unit", async ({ page }) => {
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  // 200 g × Rp15 / 10 portions
  await expect(row(page, "Gula")).toContainText("Rp300/porsi");
  await addCompositionRow(page, { material: "Cup", qty: "1" });
  await expect(row(page, "Cup")).toContainText("Rp500/porsi");

  await row(page, "Gula").getByLabel("Jumlah").fill("100");
  await row(page, "Gula").getByRole("button", { name: "Simpan" }).click();
  await expect(row(page, "Gula")).toContainText("Rp150/porsi");

  await page.getByRole("button", { name: "Hapus Cup dari komposisi" }).click();
  await expect(row(page, "Cup")).toHaveCount(0);
});

test("a material used in a composition can't be deleted", async ({ page }) => {
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await page.goto(storeUrl(page, "bahan"));
  await page.getByRole("link", { name: /Gula/ }).click();
  await expect(page.getByText("Dipakai di: Es teh manis")).toBeVisible();
  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await page.getByRole("button", { name: "Hapus bahan" }).click();
  await expect(page.getByText("Tidak bisa dihapus. Dipakai di: Es teh manis")).toBeVisible();
});

test("changing a used material's unit to another kind is refused", async ({ page }) => {
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await page.goto(storeUrl(page, "bahan"));
  await page.getByRole("link", { name: /Gula/ }).click();
  await page.getByLabel("Satuan").selectOption("pcs");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText(/Satuan ini beda jenis/)).toBeVisible();
  await expect(page.getByLabel("Satuan")).toHaveValue("pcs");

  await page.getByLabel("Satuan").selectOption("ons");
  await page.getByLabel("Jumlah beli").fill("10");
  await page.getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.goto(productUrl);
  await expect(row(page, "Gula")).toContainText("Rp300/porsi");
});
```

Run (production build): `npx playwright test tests/e2e/composition.spec.ts` — Expected: FAIL (no composition section).

- [ ] **Step 2: Add the messages**

`messages/id.json`:

```json
  "Basis": { "batch": "Per resep (dibagi hasil)", "unit": "Per porsi/unit" },
  "Composition": {
    "title": "Komposisi",
    "intro": "Bahan dan kemasan untuk produk ini. 1 resep = {yield} porsi/unit.",
    "material": "Bahan",
    "materialPlaceholder": "Pilih bahan",
    "qty": "Jumlah",
    "unit": "Satuan",
    "basis": "Dihitung",
    "add": "Tambah ke komposisi",
    "added": "Bahan ditambahkan ke komposisi.",
    "empty": "Belum ada bahan di komposisi. Tambahkan bahan pertama di bawah.",
    "noMaterials": "Belum ada bahan untuk dipilih.",
    "goToMaterials": "Tambah bahan dulu",
    "rowCost": "{cost}/porsi",
    "deleteRow": "Hapus {material} dari komposisi"
  },
```

`messages/en.json`:

```json
  "Basis": { "batch": "Per recipe (split by yield)", "unit": "Per unit" },
  "Composition": {
    "title": "Composition",
    "intro": "Materials and packaging for this product. 1 recipe = {yield} units.",
    "material": "Material",
    "materialPlaceholder": "Choose a material",
    "qty": "Amount",
    "unit": "Unit",
    "basis": "Counted",
    "add": "Add to composition",
    "added": "Added to the composition.",
    "empty": "No materials in the composition yet. Add the first one below.",
    "noMaterials": "No materials to choose from yet.",
    "goToMaterials": "Add materials first",
    "rowCost": "{cost}/unit",
    "deleteRow": "Remove {material} from the composition"
  },
```

- [ ] **Step 3: Add the actions**

Append to `app/[locale]/s/[storeId]/produk/actions.ts` (merge the new imports into the existing import block: `isUnit` from `@/lib/calc`; `compositionInputSchema`, `compositionUnitError`, `toCompositionColumns` from `@/lib/validation/composition`):

```ts
const ROW_FIELDS = ["materialId", "qty", "unit", "basis"] as const;

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function parseRow(formData: FormData) {
  const values = rawValues(formData, ROW_FIELDS);
  const parsed = compositionInputSchema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const tValidation = await getValidationTranslator();
  const fieldErrors = translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation);
  return { values, input: undefined, error: { fieldErrors, values } satisfies FormState };
}

/** The material must belong to the store and the row's unit must match its dimension. */
async function rowErrors(supabase: Supabase, storeId: string, materialId: string, unit: Parameters<typeof compositionUnitError>[1]) {
  const tValidation = await getValidationTranslator();
  const { data: material } = await supabase
    .from("materials")
    .select("purchase_unit")
    .eq("id", materialId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!material || !isUnit(material.purchase_unit)) return { materialId: [tValidation("composition.materialRequired")] };
  const key = compositionUnitError(material.purchase_unit, unit);
  return key ? { unit: [tValidation(key)] } : null;
}

export async function addCompositionRowAction(
  storeId: string,
  productId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseRow(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(productId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const fieldErrors = await rowErrors(supabase, storeId, parsed.input.materialId, parsed.input.unit);
  if (fieldErrors) return { fieldErrors, values: parsed.values };

  const { error } = await supabase.from("product_materials").insert({
    store_id: storeId,
    product_id: productId,
    channel_id: null,
    ...toCompositionColumns(parsed.input),
  });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Composition"))("added") };
}

export async function updateCompositionRowAction(
  storeId: string,
  productId: string,
  rowId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseRow(formData);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(productId) || !isUuid(rowId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const fieldErrors = await rowErrors(supabase, storeId, parsed.input.materialId, parsed.input.unit);
  if (fieldErrors) return { fieldErrors, values: parsed.values };

  // The material of an existing row never changes; only amount, unit and basis.
  const { data, error } = await supabase
    .from("product_materials")
    .update({ qty: parsed.input.qty, unit: parsed.input.unit, basis: parsed.input.basis })
    .eq("id", rowId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteCompositionRowAction(storeId: string, productId: string, rowId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(productId) || !isUuid(rowId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("product_materials")
    .delete()
    .eq("id", rowId)
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return { ok: true };
}
```

- [ ] **Step 4: Build the editor**

`app/[locale]/s/[storeId]/produk/[productId]/composition-editor.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { NativeSelect } from "@/components/forms/native-select";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { BASE_UNIT, BASES, dimensionOf, unitsOf, type Basis, type MaterialCategory, type Unit } from "@/lib/calc";
import { formatRupiah } from "@/lib/format";
import type { FormState } from "@/lib/forms";

export type EditorMaterial = { id: string; name: string; category: MaterialCategory; purchaseUnit: Unit };
export type EditorRow = {
  id: string;
  materialId: string;
  materialName: string;
  qty: number;
  unit: Unit;
  basis: Basis;
  /** Cost of this row per sold unit (batch rows already divided by the yield). */
  costPerUnit: number;
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Props = {
  rows: EditorRow[];
  materials: EditorMaterial[];
  addAction: Action;
  updateActions: Record<string, Action>;
  deleteActions: Record<string, Action>;
  materialsHref: string;
};

export function CompositionEditor({ rows, materials, addAction, updateActions, deleteActions, materialsHref }: Props) {
  const t = useTranslations("Composition");
  const materialsById = new Map(materials.map((material) => [material.id, material]));

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <RowEditor
              key={row.id}
              row={row}
              material={materialsById.get(row.materialId)}
              updateAction={updateActions[row.id]}
              deleteAction={deleteActions[row.id]}
            />
          ))}
        </ul>
      )}
      {materials.length === 0 ? (
        <p className="text-sm">
          {t("noMaterials")}{" "}
          <Link href={materialsHref} className="font-medium underline underline-offset-4">
            {t("goToMaterials")}
          </Link>
        </p>
      ) : (
        <AddRowForm materials={materials} action={addAction} />
      )}
    </div>
  );
}

function RowEditor({
  row,
  material,
  updateAction,
  deleteAction,
}: {
  row: EditorRow;
  material: EditorMaterial | undefined;
  updateAction: Action;
  deleteAction: Action;
}) {
  const t = useTranslations("Composition");
  const tCommon = useTranslations("Common");
  const tUnits = useTranslations("Units");
  const tBasis = useTranslations("Basis");
  const locale = useLocale();
  const [state, formAction] = useActionState(updateAction, undefined);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? { qty: String(row.qty), unit: row.unit, basis: row.basis };
  const errors = state?.fieldErrors ?? {};
  const units = material ? unitsOf(dimensionOf(material.purchaseUnit)) : [row.unit];
  const id = (name: string) => `row-${row.id}-${name}`;

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{row.materialName}</p>
        <p className="shrink-0 text-sm text-muted-foreground">{t("rowCost", { cost: formatRupiah(row.costPerUnit, locale) })}</p>
      </div>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="materialId" value={row.materialId} />
        <fieldset key={key} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-1">
            <Label htmlFor={id("qty")}>{t("qty")}</Label>
            <Input id={id("qty")} name="qty" inputMode="decimal" defaultValue={current.qty} />
            <FieldError errors={errors.qty} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("unit")}>{t("unit")}</Label>
            <NativeSelect id={id("unit")} name="unit" defaultValue={current.unit}>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {tUnits(unit)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.unit} />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label htmlFor={id("basis")}>{t("basis")}</Label>
            <NativeSelect id={id("basis")} name="basis" defaultValue={current.basis}>
              {BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {tBasis(basis)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.basis} />
          </div>
        </fieldset>
        <FormMessage state={state} />
        <SubmitButton variant="outline" pendingText={tCommon("savePending")}>
          {tCommon("save")}
        </SubmitButton>
      </form>
      <form action={deleteFormAction}>
        <SubmitButton
          variant="ghost"
          className="text-destructive"
          pendingText={tCommon("deletePending")}
          aria-label={t("deleteRow", { material: row.materialName })}
        >
          {tCommon("delete")}
        </SubmitButton>
        {deleteState && !deleteState.ok && <FormMessage state={deleteState} />}
      </form>
    </li>
  );
}

function AddRowForm({ materials, action }: { materials: EditorMaterial[]; action: Action }) {
  const t = useTranslations("Composition");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);

  return (
    <form id="add-composition" action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <AddRowFields key={key} materials={materials} defaults={state?.values ?? {}} errors={state?.fieldErrors ?? {}} />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={t("add")}>
        {t("add")}
      </SubmitButton>
    </form>
  );
}

function AddRowFields({
  materials,
  defaults,
  errors,
}: {
  materials: EditorMaterial[];
  defaults: Record<string, string>;
  errors: Record<string, string[] | undefined>;
}) {
  const t = useTranslations("Composition");
  const tUnits = useTranslations("Units");
  const tBasis = useTranslations("Basis");
  const [materialId, setMaterialId] = useState(defaults.materialId ?? "");
  const material = materials.find((candidate) => candidate.id === materialId);
  const echoed = defaults.materialId === materialId;
  const defaultUnit = echoed && defaults.unit ? defaults.unit : material ? BASE_UNIT[dimensionOf(material.purchaseUnit)] : "";
  const defaultBasis = echoed && defaults.basis ? defaults.basis : material?.category === "kemasan" ? "unit" : "batch";

  return (
    <fieldset className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="composition-material">{t("material")}</Label>
        <NativeSelect
          id="composition-material"
          name="materialId"
          value={materialId}
          onChange={(event) => setMaterialId(event.target.value)}
        >
          <option value="" disabled>
            {t("materialPlaceholder")}
          </option>
          {materials.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError errors={errors.materialId} />
      </div>
      {material && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-1">
            <Label htmlFor="composition-qty">{t("qty")}</Label>
            <Input id="composition-qty" name="qty" inputMode="decimal" defaultValue={echoed ? defaults.qty : undefined} />
            <FieldError errors={errors.qty} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="composition-unit">{t("unit")}</Label>
            {/* Keyed by material so the default follows the chosen material. */}
            <NativeSelect key={`unit-${materialId}`} id="composition-unit" name="unit" defaultValue={defaultUnit}>
              {unitsOf(dimensionOf(material.purchaseUnit)).map((unit) => (
                <option key={unit} value={unit}>
                  {tUnits(unit)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.unit} />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label htmlFor="composition-basis">{t("basis")}</Label>
            <NativeSelect key={`basis-${materialId}`} id="composition-basis" name="basis" defaultValue={defaultBasis}>
              {BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {tBasis(basis)}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={errors.basis} />
          </div>
        </div>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 5: Put the editor on the product page**

In `app/[locale]/s/[storeId]/produk/[productId]/page.tsx`:

1. Add imports:

```tsx
import { CardDescription } from "@/components/ui/card"; // merge into the existing card import
import { mapById, sameDimension, toBase, unitCost } from "@/lib/calc";
import { formatNumber } from "@/lib/format"; // merge with formatPercent
import { addCompositionRowAction, deleteCompositionRowAction, updateCompositionRowAction } from "../actions"; // merge
import { CompositionEditor, type EditorRow } from "./composition-editor";
```

2. After `const locale = await getLocale();` add:

```tsx
  const tComposition = await getTranslations("Composition");
  const materials = mapById(data.materials);
  // Phase 2 rows are shared by every channel; channel-specific rows arrive with the channel page (Phase 3).
  const rows: EditorRow[] = data.composition
    .filter((row) => row.productId === product.id && row.channelId === null)
    .map((row) => {
      const material = materials.get(row.materialId);
      const usable = material && sameDimension(row.unit, material.purchaseUnit);
      const perBatch = usable ? toBase(row.qty, row.unit) * unitCost(material) : 0;
      return {
        id: row.id,
        materialId: row.materialId,
        materialName: material?.name ?? "?",
        qty: row.qty,
        unit: row.unit,
        basis: row.basis,
        costPerUnit: row.basis === "batch" ? perBatch / product.yieldQty : perBatch,
      };
    });
```

3. Insert this section between the heading `<div>` and the details `<Card>`:

```tsx
      <Card>
        <CardHeader>
          <CardTitle>{tComposition("title")}</CardTitle>
          <CardDescription>{tComposition("intro", { yield: formatNumber(product.yieldQty, locale) })}</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionEditor
            rows={rows}
            materials={data.materials.map(({ id, name, category, purchaseUnit }) => ({ id, name, category, purchaseUnit }))}
            addAction={addCompositionRowAction.bind(null, data.store.id, product.id)}
            updateActions={Object.fromEntries(
              rows.map((row) => [row.id, updateCompositionRowAction.bind(null, data.store.id, product.id, row.id)]),
            )}
            deleteActions={Object.fromEntries(
              rows.map((row) => [row.id, deleteCompositionRowAction.bind(null, data.store.id, product.id, row.id)]),
            )}
            materialsHref={`/s/${data.store.id}/bahan`}
          />
        </CardContent>
      </Card>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx tsc --noEmit && npx eslint . && npm test`, then `npx playwright test tests/e2e/composition.spec.ts tests/e2e/products.spec.ts tests/e2e/materials.spec.ts` against a production build.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/s/[storeId]/produk" messages tests/e2e/helpers.ts tests/e2e/composition.spec.ts
git commit -m "feat(products): composition editor with unit filtering and per-unit cost"
```

---

### Task 15: Price, sales estimate and HPP per channel

**Files:**
- Modify: `app/[locale]/s/[storeId]/produk/actions.ts` (add `savePriceAction`), `app/[locale]/s/[storeId]/produk/[productId]/page.tsx` (insert the section)
- Create: `app/[locale]/s/[storeId]/produk/[productId]/price-form.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Pricing`), `tests/e2e/helpers.ts` (add `setPrice`)
- Test: `tests/e2e/pricing.spec.ts`

**Interfaces:**
- Consumes: Tasks 5, 6, 7 (`priceInputSchema`, `toPriceColumns`), 13 (`tryAnalyzeStore`, `StatusBadge`), 14.
- Produces:
  - Server Action `savePriceAction(storeId, productId, channelId, prev, formData)` — fields `price`, `estMonthlySales`; upserts `product_channel_prices` on `(product_id, channel_id)` without touching `competitor_price`; returns `{ ok, message: "Harga tersimpan.", values }`.
  - `<PriceForm id action data productId channel defaults />` — live preview of material cost, full cost, net price (when the channel takes a commission or fee), margin vs target and status while typing.
  - e2e helper `setPrice(page, p: { price: string; est: string })` — fills the first channel's price form on the product page and waits for "Harga tersimpan.".

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/helpers.ts`:

```ts
export async function setPrice(page: Page, p: { price: string; est: string }) {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill(p.price);
  await form.getByLabel("Perkiraan terjual / bulan").fill(p.est);
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(page.getByText("Harga tersimpan.")).toBeVisible();
}
```

`tests/e2e/pricing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { addCompositionRow, addMaterial, addProduct, createStoreViaOnboarding, setPrice, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Harga");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
});

test("previews HPP and margin while typing, then saves", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await expect(page.getByRole("heading", { name: "Offline – Tunai" })).toBeVisible();
  await form.getByLabel("Harga jual (Rp)").fill("5.000");
  await form.getByLabel("Perkiraan terjual / bulan").fill("600");
  // Material cost Rp300; no fixed costs yet, so full cost is also Rp300: (5.000 − 300) / 5.000 = 94%.
  await expect(form).toContainText("Rp300");
  await expect(form).toContainText("94%");
  await expect(form).toContainText("Sesuai target");

  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(page.getByText("Harga tersimpan.")).toBeVisible();
  await page.reload();
  await expect(page.locator("form[id^='price-']").first().getByLabel("Harga jual (Rp)")).toHaveValue("5000");
});

test("a price below cost shows a loss before saving", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill("200");
  await form.getByLabel("Perkiraan terjual / bulan").fill("10");
  await expect(form).toContainText("Rugi");
});

test("keeps typed values on a validation error", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill("5.000,50");
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(form.getByText("Isi harga dengan angka bulat, contoh 15.000")).toBeVisible();
  await expect(form.getByLabel("Harga jual (Rp)")).toHaveValue("5.000,50");
});

test("warns while the composition is empty", async ({ page }) => {
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Kopi", yieldQty: "1" });
  await expect(page.getByText(/Komposisi produk ini masih kosong/)).toBeVisible();
  await setPrice(page, { price: "10.000", est: "100" });
});
```

Run (production build): `npx playwright test tests/e2e/pricing.spec.ts` — Expected: FAIL.

- [ ] **Step 2: Add the messages**

`messages/id.json`:

```json
  "Pricing": {
    "title": "Harga & HPP",
    "intro": "Harga jual dan perkiraan penjualan per kanal. HPP dan margin dihitung otomatis.",
    "price": "Harga jual (Rp)",
    "estMonthlySales": "Perkiraan terjual / bulan",
    "save": "Simpan harga",
    "saved": "Harga tersimpan.",
    "materialCost": "HPP bahan",
    "fullCost": "HPP penuh",
    "fullCostUnknown": "HPP penuh muncul setelah ada perkiraan penjualan.",
    "netPrice": "Diterima setelah potongan",
    "margin": "Margin",
    "target": "target {pct}",
    "marginHint": "Margin = laba sebagai persen dari harga jual (bukan markup). HPP penuh sudah termasuk biaya operasional dan penyusutan.",
    "previewEmpty": "Isi harga jual untuk melihat HPP dan margin.",
    "noComposition": "Komposisi produk ini masih kosong, jadi HPP bahan masih Rp0. Isi komposisinya dulu.",
    "calcError": "Ada komposisi dengan satuan yang tidak cocok dengan bahannya. Perbaiki komposisinya supaya HPP bisa dihitung."
  },
```

`messages/en.json`:

```json
  "Pricing": {
    "title": "Price & cost",
    "intro": "Selling price and expected sales per channel. Cost and margin are calculated for you.",
    "price": "Selling price (Rp)",
    "estMonthlySales": "Expected sales / month",
    "save": "Save price",
    "saved": "Price saved.",
    "materialCost": "Material cost",
    "fullCost": "Full cost",
    "fullCostUnknown": "Full cost appears once there is a sales estimate.",
    "netPrice": "Received after fees",
    "margin": "Margin",
    "target": "target {pct}",
    "marginHint": "Margin = profit as a percentage of the selling price (not markup). Full cost includes operating costs and depreciation.",
    "previewEmpty": "Enter a selling price to see cost and margin.",
    "noComposition": "This product has no composition yet, so its material cost is Rp0. Fill in the composition first.",
    "calcError": "A composition row uses a unit that doesn't match its material. Fix the composition so the cost can be calculated."
  },
```

- [ ] **Step 3: Add the action**

Append to `app/[locale]/s/[storeId]/produk/actions.ts` (merge `priceInputSchema`, `toPriceColumns` from `@/lib/validation/price` into the imports):

```ts
const PRICE_FIELDS = ["price", "estMonthlySales"] as const;

export async function savePriceAction(
  storeId: string,
  productId: string,
  channelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const values = rawValues(formData, PRICE_FIELDS);
  const parsed = priceInputSchema.safeParse(values);
  if (!parsed.success) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: translateFieldErrors(z.flattenError(parsed.error).fieldErrors, tValidation), values };
  }
  if (!isUuid(storeId) || !isUuid(productId) || !isUuid(channelId)) return { message: tCommon("notFound"), values };

  const { supabase } = await requireUser();
  // competitor_price is not in the payload, so an update leaves it as it is (it is edited in Phase 3).
  const { error } = await supabase
    .from("product_channel_prices")
    .upsert(
      { store_id: storeId, product_id: productId, channel_id: channelId, ...toPriceColumns(parsed.data) },
      { onConflict: "product_id,channel_id" },
    );
  if (error) return { message: tCommon("saveFailed"), values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Pricing"))("saved"), values };
}
```

- [ ] **Step 4: Build the price form**

`app/[locale]/s/[storeId]/produk/[productId]/price-form.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, type FormEvent } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { StatusBadge } from "@/components/store/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tryAnalyzeStore, type CalcChannel, type MetricsLine, type StoreData } from "@/lib/calc";
import { formatPercent, formatRupiah } from "@/lib/format";
import type { FormState } from "@/lib/forms";
import { priceInputSchema } from "@/lib/validation/price";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Defaults = { price: string; estMonthlySales: string };

type Props = { id: string; action: Action; data: StoreData; productId: string; channel: CalcChannel; defaults: Defaults };

export function PriceForm({ id, action, data, productId, channel, defaults }: Props) {
  const t = useTranslations("Pricing");
  const tCommon = useTranslations("Common");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);

  return (
    <form id={id} action={formAction} className="space-y-3">
      <PriceFields
        key={key}
        data={data}
        productId={productId}
        channel={channel}
        defaults={(state?.values as Defaults | undefined) ?? defaults}
        errors={state?.fieldErrors ?? {}}
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={tCommon("savePending")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}

/** Recomputes the whole store with the typed price, so full cost and margin match the dashboard. */
function previewLine(data: StoreData, productId: string, channelId: string, values: Record<string, unknown>): MetricsLine | null {
  const parsed = priceInputSchema.safeParse(values);
  if (!parsed.success) return null;
  const existing = data.prices.find((row) => row.productId === productId && row.channelId === channelId);
  const prices = [
    ...data.prices.filter((row) => row !== existing),
    {
      productId,
      channelId,
      price: parsed.data.price,
      estMonthlySales: parsed.data.estMonthlySales,
      competitorPrice: existing?.competitorPrice ?? null,
    },
  ];
  const { analysis } = tryAnalyzeStore({ ...data, prices });
  return analysis?.lines.find((line) => line.productId === productId && line.channelId === channelId) ?? null;
}

function PriceFields({
  data,
  productId,
  channel,
  defaults,
  errors,
}: {
  data: StoreData;
  productId: string;
  channel: CalcChannel;
  defaults: Defaults;
  errors: Record<string, string[] | undefined>;
}) {
  const t = useTranslations("Pricing");
  const locale = useLocale();
  const [line, setLine] = useState(() => previewLine(data, productId, channel.id, defaults));
  const field = (name: string) => `price-${channel.id}-${name}`;

  function onChange(event: FormEvent<HTMLFieldSetElement>) {
    const form = event.currentTarget.form;
    if (form) setLine(previewLine(data, productId, channel.id, Object.fromEntries(new FormData(form))));
  }

  return (
    <fieldset className="space-y-3" onChange={onChange}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={field("price")}>{t("price")}</Label>
          <Input id={field("price")} name="price" inputMode="numeric" defaultValue={defaults.price} placeholder="15.000" />
          <FieldError errors={errors.price} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("est")}>{t("estMonthlySales")}</Label>
          <Input id={field("est")} name="estMonthlySales" inputMode="numeric" defaultValue={defaults.estMonthlySales} placeholder="300" />
          <FieldError errors={errors.estMonthlySales} />
        </div>
      </div>
      {line ? (
        <div aria-live="polite" className="space-y-2">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm">
            <dt className="text-muted-foreground">{t("materialCost")}</dt>
            <dd className="text-right font-medium">{formatRupiah(line.materialCost, locale)}</dd>
            <dt className="text-muted-foreground">{t("fullCost")}</dt>
            <dd className="text-right font-medium">{line.fullCost === null ? "—" : formatRupiah(line.fullCost, locale)}</dd>
            {(channel.commissionPct > 0 || channel.fixedFee > 0) && (
              <>
                <dt className="text-muted-foreground">{t("netPrice")}</dt>
                <dd className="text-right font-medium">{formatRupiah(line.netPrice, locale)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("margin")}</dt>
            <dd className="text-right font-medium">
              {line.marginPct === null ? "—" : formatPercent(line.marginPct, locale)}{" "}
              <span className="font-normal text-muted-foreground">({t("target", { pct: formatPercent(line.targetMarginPct, locale) })})</span>
            </dd>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={line.status} />
            {line.fullCost === null && <span className="text-xs text-muted-foreground">{t("fullCostUnknown")}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{t("marginHint")}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("previewEmpty")}</p>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 5: Put the prices on the product page**

In `app/[locale]/s/[storeId]/produk/[productId]/page.tsx`:

1. Add imports (merge where the module is already imported): `tryAnalyzeStore` from `@/lib/calc`; `savePriceAction` from `../actions`; `import { PriceForm } from "./price-form";`.

2. After the `rows` computation add:

```tsx
  const tPricing = await getTranslations("Pricing");
  const { error: calcError } = tryAnalyzeStore(data);
  const hasComposition = rows.length > 0;
```

3. Insert this section between the heading `<div>` and the composition `<Card>` (prices first: they answer "am I making money?"):

```tsx
      {calcError?.productId === product.id && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          {tPricing("calcError")}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{tPricing("title")}</CardTitle>
          <CardDescription>{tPricing("intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasComposition && (
            <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              {tPricing("noComposition")}
            </p>
          )}
          {data.channels.map((channel) => {
            const saved = data.prices.find((row) => row.productId === product.id && row.channelId === channel.id);
            return (
              <section key={channel.id} className="space-y-3">
                <h3 className="font-medium [overflow-wrap:anywhere]">{channel.name}</h3>
                <PriceForm
                  id={`price-${channel.id}`}
                  action={savePriceAction.bind(null, data.store.id, product.id, channel.id)}
                  data={data}
                  productId={product.id}
                  channel={channel}
                  defaults={{
                    price: saved ? String(saved.price) : "",
                    estMonthlySales: saved ? String(saved.estMonthlySales) : "",
                  }}
                />
              </section>
            );
          })}
        </CardContent>
      </Card>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx tsc --noEmit && npx eslint . && npm test`, then `npx playwright test tests/e2e/pricing.spec.ts tests/e2e/composition.spec.ts tests/e2e/products.spec.ts` against a production build.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/s/[storeId]/produk" messages tests/e2e/helpers.ts tests/e2e/pricing.spec.ts
git commit -m "feat(products): price and sales estimate per channel with live HPP and margin"
```

---

### Task 16: Dashboard, setup checklist and spec notes

**Files:**
- Create: `lib/dashboard/checklist.ts`
- Create: `app/[locale]/s/[storeId]/dashboard/metric-cards.tsx`, `app/[locale]/s/[storeId]/dashboard/warnings-list.tsx`, `app/[locale]/s/[storeId]/dashboard/product-lines.tsx`, `app/[locale]/s/[storeId]/dashboard/setup-checklist.tsx`
- Modify: `app/[locale]/s/[storeId]/dashboard/page.tsx` (rewrite), `messages/id.json`, `messages/en.json` (extend `Dashboard`; add `Warnings`, `Checklist`), `docs/superpowers/specs/2026-10-16-untungin-design.md`
- Test: `tests/unit/checklist.test.ts`, `tests/e2e/dashboard.spec.ts`; update `tests/e2e/settings.spec.ts` and `tests/e2e/store-shell.spec.ts` only if a dashboard assertion they make no longer matches (they check the store name and "35,5%", which the page keeps)

**Interfaces:**
- Consumes: everything above.
- Produces: `CHECKLIST_KEYS = ["materials","products","expenses","ownerSalary","assets"] as const`; `type ChecklistItem = { key: ChecklistKey; done: boolean; href: string }`; `setupChecklist(data: StoreData): ChecklistItem[]` (hrefs are unprefixed store paths). Dashboard `data-testid`s: `metric-netProfit`, `metric-grossRevenue`, `metric-bep`, `metric-payback`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/checklist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { setupChecklist } from "@/lib/dashboard/checklist";
import { fixture } from "./calc/fixture";

const done = (data: Parameters<typeof setupChecklist>[0]) =>
  Object.fromEntries(setupChecklist(data).map((item) => [item.key, item.done]));

describe("setupChecklist", () => {
  it("is all to-do for an empty store, in spec order, with store links", () => {
    const empty = { ...fixture(), materials: [], products: [], composition: [], prices: [], expenses: [], assets: [] };
    expect(setupChecklist(empty)).toEqual([
      { key: "materials", done: false, href: "/s/store/bahan" },
      { key: "products", done: false, href: "/s/store/produk" },
      { key: "expenses", done: false, href: "/s/store/biaya" },
      { key: "ownerSalary", done: false, href: "/s/store/biaya" },
      { key: "assets", done: false, href: "/s/store/inventaris" },
    ]);
  });

  it("marks the fixture's steps, except the owner's salary", () => {
    expect(done(fixture())).toEqual({ materials: true, products: true, expenses: true, ownerSalary: false, assets: true });
  });

  it("a product counts only with a composition, a price, and a sales estimate", () => {
    const noEstimate = fixture();
    noEstimate.prices = noEstimate.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    expect(done(noEstimate).products).toBe(false);

    const noComposition = fixture();
    noComposition.composition = [];
    expect(done(noComposition).products).toBe(false);

    const inactive = fixture();
    inactive.products[0] = { ...inactive.products[0], isActive: false };
    expect(done(inactive).products).toBe(false);
  });

  it("the owner's salary alone does not count as operating costs", () => {
    const data = fixture();
    data.expenses = [{ id: "g", name: "Gaji saya", category: "gaji_pemilik", amount: 1, frequency: "bulanan" }];
    expect(done(data)).toMatchObject({ expenses: false, ownerSalary: true });
  });
});
```

- [ ] **Step 2: Run it to verify it fails, then implement**

Run: `npx vitest run tests/unit/checklist.test.ts` — Expected: FAIL.

`lib/dashboard/checklist.ts`:

```ts
import type { StoreData } from "@/lib/calc";

export const CHECKLIST_KEYS = ["materials", "products", "expenses", "ownerSalary", "assets"] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
export type ChecklistItem = { key: ChecklistKey; done: boolean; href: string };

/** Setup steps shown on the dashboard until every one is done (spec §5.2). */
export function setupChecklist(data: StoreData): ChecklistItem[] {
  const base = `/s/${data.store.id}`;
  const withComposition = new Set(data.composition.map((row) => row.productId));
  // A product is "done" once the dashboard can show its profit.
  const productReady = data.products.some(
    (product) =>
      product.isActive &&
      withComposition.has(product.id) &&
      data.prices.some((row) => row.productId === product.id && row.price > 0 && row.estMonthlySales > 0),
  );
  const done: Record<ChecklistKey, boolean> = {
    materials: data.materials.length > 0,
    products: productReady,
    expenses: data.expenses.some((expense) => expense.category !== "gaji_pemilik"),
    ownerSalary: data.expenses.some((expense) => expense.category === "gaji_pemilik"),
    assets: data.assets.length > 0,
  };
  const href: Record<ChecklistKey, string> = {
    materials: `${base}/bahan`,
    products: `${base}/produk`,
    expenses: `${base}/biaya`,
    ownerSalary: `${base}/biaya`,
    assets: `${base}/inventaris`,
  };
  return CHECKLIST_KEYS.map((key) => ({ key, done: done[key], href: href[key] }));
}
```

Run: `npx vitest run tests/unit/checklist.test.ts` — Expected: PASS.

- [ ] **Step 3: Write the failing e2e test**

`tests/e2e/dashboard.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  addAsset,
  addCompositionRow,
  addExpense,
  addMaterial,
  addProduct,
  createStoreViaOnboarding,
  setPrice,
  signIn,
  storeUrl,
} from "./helpers";

test("a new store shows the checklist and no broken numbers", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await expect(page.getByText("Langkah awal")).toBeVisible();
  await expect(page.getByRole("link", { name: /Catat bahan & kemasan/ })).toBeVisible();
  await expect(page.getByTestId("metric-netProfit")).toHaveText("—");
  await expect(page.getByTestId("metric-bep")).toHaveText("—");
  await expect(page.getByTestId("metric-payback")).toHaveText("—");
  expect(await page.getByRole("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);
});

test("the full flow shows profit, break-even and payback", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Kedai Teh");

  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await addMaterial(page, { name: "Teh", qty: "100", unit: "g", price: "10.000" });
  await addMaterial(page, { name: "Cup", qty: "1", unit: "lusin", price: "6.000", category: "kemasan" });

  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh manis", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await addCompositionRow(page, { material: "Teh", qty: "50" });
  await addCompositionRow(page, { material: "Cup", qty: "1" });
  await setPrice(page, { price: "5.000", est: "600" });

  await page.goto(storeUrl(page, "biaya"));
  await addExpense(page, { name: "Sewa", category: "sewa", amount: "1.000.000", frequency: "bulanan" });
  await addExpense(page, { name: "Gaji saya", category: "gaji_pemilik", amount: "1.000.000", frequency: "bulanan" });

  await page.goto(storeUrl(page, "inventaris"));
  await addAsset(page, { name: "Blender", category: "peralatan", qty: "1", unitPrice: "600.000", usefulLifeMonths: "12" });

  await page.goto(storeUrl(page, "dashboard"));
  // Material cost 1.300/cup; fixed costs 2.050.000; 600 cups × 5.000.
  await expect(page.getByTestId("metric-netProfit")).toHaveText("Rp170.000");
  await expect(page.getByTestId("metric-grossRevenue")).toHaveText("Rp3.000.000");
  await expect(page.getByTestId("metric-bep")).toHaveText("22 terjual/hari");
  await expect(page.getByTestId("metric-payback")).toHaveText("≈ 3,5 bulan");
  await expect(page.getByText("Langkah awal")).toBeHidden();
  await expect(page.getByText("Margin di bawah target: Es teh manis (Offline – Tunai).")).toBeVisible();
  await expect(page.getByRole("link", { name: /Es teh manis/ })).toContainText("Di bawah target");
});

test("deleting a product removes it from the dashboard", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Hapus");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es gula", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "100" });
  await setPrice(page, { price: "3.000", est: "100" });

  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByRole("link", { name: /Es gula/ })).toBeVisible();

  await page.goto(storeUrl(page, "produk"));
  await page.getByRole("link", { name: /Es gula/ }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await page.getByRole("button", { name: "Hapus produk" }).click();
  await expect(page).toHaveURL(/\/produk$/);

  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByRole("link", { name: /Es gula/ })).toHaveCount(0);
  await expect(page.getByTestId("metric-netProfit")).toHaveText("—");
  await expect(page.getByRole("link", { name: /Buat produk lengkap/ })).toBeVisible();
});

test("long names and large amounts fit on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Besar");
  const longName = "ProdukDenganNamaSangatPanjangSekaliTanpaSpasi".repeat(2).slice(0, 80);
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: longName, qty: "1", unit: "kg", price: "1.000.000.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: longName, yieldQty: "1" });
  await addCompositionRow(page, { material: longName, qty: "1", unit: "g" });
  await setPrice(page, { price: "1.500.000.000", est: "1.000" });
  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByTestId("metric-grossRevenue")).toContainText("Rp1.500.000.000.000");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

Run (production build): `npx playwright test tests/e2e/dashboard.spec.ts` — Expected: FAIL.

- [ ] **Step 4: Add the messages**

In `messages/id.json`, extend `"Dashboard"` (keep `basis`, `operatingDays`, `operatingDaysValue`, `targetMargin`) with:

```json
    "netProfit": "Laba bersih / bulan",
    "grossRevenue": "Omzet / bulan",
    "bep": "Titik impas",
    "bepValue": "{units, number} terjual/hari",
    "bepMonthly": "{units, number} per bulan",
    "bepLoss": "Setiap penjualan rugi",
    "needSales": "Isi harga dan perkiraan penjualan",
    "payback": "Balik modal",
    "paybackValue": "≈ {months} bulan",
    "paybackUnknown": "Belum untung, jadi belum bisa balik modal",
    "paybackNoCapital": "Catat inventaris untuk menghitung balik modal",
    "warningsTitle": "Perlu diperhatikan",
    "productsTitle": "Produk",
    "price": "Harga",
    "cost": "HPP",
    "margin": "Margin",
    "status": "Status",
    "withoutPrice": "Belum ada harga: {products}",
    "calcError": "Ada komposisi dengan satuan yang tidak cocok di produk {product}, jadi angkanya belum bisa dihitung.",
    "calcErrorAction": "Perbaiki"
```

and add namespaces:

```json
  "Warnings": {
    "NET_LOSS": "Usahamu rugi per bulan: biaya tetap lebih besar dari laba kotor.",
    "LOSS_PRODUCTS": "Rugi setiap terjual: {products}. Naikkan harga atau kurangi biaya bahan.",
    "NEGATIVE_CONTRIBUTION": "Rata-rata setiap penjualan rugi. Makin banyak terjual, makin besar ruginya.",
    "NO_OWNER_SALARY": "Laba terlihat lebih besar karena gajimu sendiri belum dihitung.",
    "BELOW_TARGET": "Margin di bawah target: {products}.",
    "COMPETITOR_GAP": "Harga beda lebih dari 25% dari pesaing: {products}.",
    "NO_SALES_ESTIMATE": "Isi perkiraan penjualan per bulan supaya laba dan titik impas bisa dihitung."
  },
  "Checklist": {
    "title": "Langkah awal",
    "intro": "Lengkapi langkah ini supaya hitunganmu akurat.",
    "done": "(selesai)",
    "todo": "(belum)",
    "items": {
      "materials": "Catat bahan & kemasan",
      "products": "Buat produk lengkap dengan komposisi, harga, dan perkiraan penjualan",
      "expenses": "Isi biaya operasional",
      "ownerSalary": "Hitung gaji kamu sendiri",
      "assets": "Catat inventaris"
    }
  },
```

In `messages/en.json`, extend `"Dashboard"` with:

```json
    "netProfit": "Net profit / month",
    "grossRevenue": "Revenue / month",
    "bep": "Break-even",
    "bepValue": "{units, plural, one {# sale/day} other {# sales/day}}",
    "bepMonthly": "{units, number} per month",
    "bepLoss": "Every sale loses money",
    "needSales": "Fill in prices and sales estimates",
    "payback": "Payback",
    "paybackValue": "≈ {months} months",
    "paybackUnknown": "Not profitable yet, so no payback",
    "paybackNoCapital": "Add your inventory to calculate payback",
    "warningsTitle": "Needs attention",
    "productsTitle": "Products",
    "price": "Price",
    "cost": "Cost",
    "margin": "Margin",
    "status": "Status",
    "withoutPrice": "No price yet: {products}",
    "calcError": "A composition row in {product} uses a unit that doesn't match its material, so the numbers can't be calculated yet.",
    "calcErrorAction": "Fix it"
```

and:

```json
  "Warnings": {
    "NET_LOSS": "Your business loses money each month: fixed costs are higher than gross profit.",
    "LOSS_PRODUCTS": "Loses money on every sale: {products}. Raise the price or lower material costs.",
    "NEGATIVE_CONTRIBUTION": "On average every sale loses money. The more you sell, the bigger the loss.",
    "NO_OWNER_SALARY": "Profit looks bigger because your own salary has not been counted.",
    "BELOW_TARGET": "Margin below target: {products}.",
    "COMPETITOR_GAP": "Price differs from competitors by more than 25%: {products}.",
    "NO_SALES_ESTIMATE": "Fill in your monthly sales estimate so profit and break-even can be calculated."
  },
  "Checklist": {
    "title": "Getting started",
    "intro": "Complete these steps so your numbers are accurate.",
    "done": "(done)",
    "todo": "(to do)",
    "items": {
      "materials": "Add materials & packaging",
      "products": "Create a product with composition, price and sales estimate",
      "expenses": "Add operating costs",
      "ownerSalary": "Count your own salary",
      "assets": "Add your inventory"
    }
  },
```

- [ ] **Step 5: Build the dashboard parts**

`app/[locale]/s/[storeId]/dashboard/metric-cards.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import type { StoreAnalysis } from "@/lib/calc";
import { formatNumber, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

type Metric = { key: string; label: string; value: string; hint: string | null; negative?: boolean };

/** Net profit, revenue, break-even per day, payback (spec §5.2). "—" plus a hint when a value can't exist yet. */
export function MetricCards({ analysis }: { analysis: StoreAnalysis }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  const hasSales = analysis.totalUnits > 0;

  const metrics: Metric[] = [
    {
      key: "netProfit",
      label: t("netProfit"),
      value: hasSales ? formatRupiah(analysis.netProfit, locale) : "—",
      hint: hasSales ? null : t("needSales"),
      negative: hasSales && analysis.netProfit < 0,
    },
    {
      key: "grossRevenue",
      label: t("grossRevenue"),
      value: hasSales ? formatRupiah(analysis.grossRevenue, locale) : "—",
      hint: null,
    },
    {
      key: "bep",
      label: t("bep"),
      value: analysis.bepUnitsDaily === null ? "—" : t("bepValue", { units: analysis.bepUnitsDaily }),
      hint:
        analysis.bepUnitsMonthly !== null
          ? t("bepMonthly", { units: analysis.bepUnitsMonthly })
          : hasSales
            ? t("bepLoss")
            : t("needSales"),
    },
    {
      key: "payback",
      label: t("payback"),
      value:
        analysis.paybackMonths === null || analysis.totalCapital === 0
          ? "—"
          : t("paybackValue", { months: formatNumber(analysis.paybackMonths, locale, 1) }),
      hint:
        analysis.paybackMonths === null ? t("paybackUnknown") : analysis.totalCapital === 0 ? t("paybackNoCapital") : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.key}>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p
              data-testid={`metric-${metric.key}`}
              className={cn("text-lg font-semibold [overflow-wrap:anywhere] sm:text-xl", metric.negative && "text-destructive")}
            >
              {metric.value}
            </p>
            {metric.hint && <p className="text-xs text-muted-foreground">{metric.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

`app/[locale]/s/[storeId]/dashboard/warnings-list.tsx`:

```tsx
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LineRef, StoreWarning, WarningCode } from "@/lib/calc";
import { cn } from "@/lib/utils";

const SERIOUS: WarningCode[] = ["NET_LOSS", "LOSS_PRODUCTS", "NEGATIVE_CONTRIBUTION"];

export function WarningsList({ warnings, lineLabel }: { warnings: StoreWarning[]; lineLabel: (ref: LineRef) => string }) {
  const t = useTranslations("Dashboard");
  const tWarnings = useTranslations("Warnings");
  if (warnings.length === 0) return null;

  return (
    <section aria-labelledby="warnings-title" className="space-y-2">
      <h2 id="warnings-title" className="text-lg font-semibold">
        {t("warningsTitle")}
      </h2>
      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.code}
            className={cn(
              "flex gap-3 rounded-lg border p-3 text-sm [overflow-wrap:anywhere]",
              SERIOUS.includes(warning.code)
                ? "border-destructive/40 bg-destructive/10"
                : "border-amber-500/40 bg-amber-500/10",
            )}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{tWarnings(warning.code, { products: warning.lines.map(lineLabel).join(", ") })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`app/[locale]/s/[storeId]/dashboard/product-lines.tsx`:

```tsx
import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/store/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { StoreAnalysis, StoreData } from "@/lib/calc";
import { formatPercent, formatRupiah } from "@/lib/format";

/** One row per product and channel; stacked on phones, columns from `sm`. */
export function ProductLines({ analysis, data }: { analysis: StoreAnalysis; data: StoreData }) {
  const t = useTranslations("Dashboard");
  const locale = useLocale();
  if (analysis.lines.length === 0 && analysis.productsWithoutPrice.length === 0) return null;
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const columns = "sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] sm:items-center sm:gap-3";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("productsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {analysis.lines.length > 0 && (
          <div>
            <div className={`hidden px-2 pb-2 text-xs text-muted-foreground sm:grid ${columns}`} aria-hidden>
              <span>{t("productsTitle")}</span>
              <span>{t("price")}</span>
              <span>{t("cost")}</span>
              <span>{t("margin")}</span>
              <span>{t("status")}</span>
            </div>
            <ul className="divide-y rounded-lg border">
              {analysis.lines.map((line) => (
                <li key={`${line.productId}:${line.channelId}`}>
                  <Link
                    href={`/s/${data.store.id}/produk/${line.productId}`}
                    className={`grid gap-1 px-2 py-3 hover:bg-accent/60 ${columns}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium [overflow-wrap:anywhere]">{productName(line.productId)}</span>
                      <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{channelName(line.channelId)}</span>
                    </span>
                    <span className="text-sm [overflow-wrap:anywhere]">
                      <span className="text-muted-foreground sm:hidden">{t("price")}: </span>
                      {formatRupiah(line.price, locale)}
                    </span>
                    <span className="text-sm [overflow-wrap:anywhere]">
                      <span className="text-muted-foreground sm:hidden">{t("cost")}: </span>
                      {formatRupiah(line.fullCost ?? line.materialCost, locale)}
                    </span>
                    <span className="text-sm">
                      <span className="text-muted-foreground sm:hidden">{t("margin")}: </span>
                      {line.marginPct === null ? "—" : formatPercent(line.marginPct, locale)}
                    </span>
                    <StatusBadge status={line.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.productsWithoutPrice.length > 0 && (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {t("withoutPrice", { products: analysis.productsWithoutPrice.map(productName).join(", ") })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

`app/[locale]/s/[storeId]/dashboard/setup-checklist.tsx`:

```tsx
import { Circle, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ChecklistItem } from "@/lib/dashboard/checklist";
import { cn } from "@/lib/utils";

export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const t = useTranslations("Checklist");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("intro")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="flex min-h-10 items-center gap-3 rounded-md px-2 hover:bg-accent/60">
                {item.done ? (
                  <CircleCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={cn("min-w-0", item.done && "text-muted-foreground line-through")}>
                  {t(`items.${item.key}`)}
                </span>
                <span className="sr-only">{item.done ? t("done") : t("todo")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Rewrite the dashboard page**

Replace `app/[locale]/s/[storeId]/dashboard/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore, type LineRef } from "@/lib/calc";
import { setupChecklist } from "@/lib/dashboard/checklist";
import { loadStoreData } from "@/lib/data/load-store-data";
import { getStore } from "@/lib/data/stores";
import { formatPercent } from "@/lib/format";
import { getBusinessTypeLabel } from "@/lib/i18n/server";
import { MetricCards } from "./metric-cards";
import { ProductLines } from "./product-lines";
import { SetupChecklist } from "./setup-checklist";
import { WarningsList } from "./warnings-list";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const [store, data] = await Promise.all([getStore(storeId), loadStoreData(storeId)]);
  if (!store || !data) notFound();
  const t = await getTranslations("Dashboard");
  const businessTypeLabel = await getBusinessTypeLabel();
  const locale = await getLocale();

  const checklist = setupChecklist(data);
  const { analysis, error } = tryAnalyzeStore(data);
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const lineLabel = (ref: LineRef) => `${productName(ref.productId)} (${channelName(ref.channelId)})`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm [overflow-wrap:anywhere]">
          {t("calcError", { product: productName(error.productId) })}{" "}
          <Link href={`/s/${data.store.id}/produk/${error.productId}`} className="font-medium underline underline-offset-4">
            {t("calcErrorAction")}
          </Link>
        </p>
      )}

      {checklist.some((item) => !item.done) && <SetupChecklist items={checklist} />}

      {analysis && (
        <>
          <MetricCards analysis={analysis} />
          <WarningsList warnings={analysis.warnings} lineLabel={lineLabel} />
          <ProductLines analysis={analysis} data={data} />
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("basis")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("operatingDays")}</p>
            <p className="text-lg font-medium">{t("operatingDaysValue", { days: store.operating_days_per_month })}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("targetMargin")}</p>
            <p className="text-lg font-medium">{formatPercent(store.target_margin_pct, locale)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

`WarningsList` receives a function prop; that is fine because every component here is a Server Component.

- [ ] **Step 7: Update the spec**

In `docs/superpowers/specs/2026-10-16-untungin-design.md`:

1. Replace the line starting `Validation note (Phase 2):` with:

```markdown
Number input: quantities and percentages use `localeNumber` ("," or "." as the decimal separator); Rupiah amounts and counts use `wholeNumber`, which reads thousand separators ("15.000", "Rp 15.000", "15,000" → 15000) and rejects decimals.
```

2. In §8, under `lib/`, change the `calc/` line to `calc/        units.ts types.ts materials.ts products.ts expenses.ts assets.ts metrics.ts warnings.ts index.ts (pricing.ts: Phase 3, overrides.ts: Phase 4)`, change the `data/` line to `data/        store-data.ts (fetchStoreData: Supabase → StoreData) load-store-data.ts (per-request cache) stores.ts`, and add the line `dashboard/   checklist.ts`.

3. In §10, after item 2, add an indented note:

```markdown
   Phase 2 notes: price and monthly sales estimate are entered per existing channel (only the default channel until Phase 3); competitor price, channel-specific composition rows, and the price recommendation arrive with Phase 3. The checklist's product step requires a composition plus a price with a sales estimate. On phones the bottom nav is Dashboard, Produk, Bahan, Lainnya; "Lainnya" links Biaya, Inventaris, Pengaturan.
```

- [ ] **Step 8: Run everything**

Run: `npx tsc --noEmit && npx eslint . && npm test && npm run test:rls`, then build and run the **whole** e2e suite against the production server (`npx playwright test`).
Expected: all PASS. Stop the server you started.

- [ ] **Step 9: Commit**

```bash
git add lib/dashboard "app/[locale]/s/[storeId]/dashboard" messages docs/superpowers/specs/2026-10-16-untungin-design.md tests/unit/checklist.test.ts tests/e2e/dashboard.spec.ts
git commit -m "feat(dashboard): profit, break-even, payback, warnings, product status and setup checklist"
```

---

## Self-review notes (for the executor)

- Spec coverage: §4.1 (Task 2), §4.2 items 1–8 (Tasks 2–5), §4.3 (Tasks 5–6), §5.2 `dashboard`, `bahan`, `produk`, `produk/[id]`, `biaya`, `inventaris` (Tasks 10–16), §5.3 errors and empty states (Tasks 8, 10–15), §5.4 messages in id + en (every UI task), §9 calc and validation tests (Tasks 1–7) and the e2e flow (Task 16). Deferred by ruling: §4.2 item 9 (Phase 3), §4.4 (Phase 4), `kanal` page (Phase 3).
- Shared names to keep consistent: `materialCost`, `fullCost`, `netPrice`, `contribution`, `marginPct`, `StoreAnalysis`, `tryAnalyzeStore`, `worstStatus`, `loadStoreData`, `revalidateStore`, `rawValues`, `useRemountKey`, `NativeSelect`, `FormMessage`, `DeleteButton`, `EmptyState`, `StatusBadge`, form ids `#add-material`, `#add-expense`, `#add-asset`, `#add-product`, `#add-composition`, `form[id^='price-']`.
