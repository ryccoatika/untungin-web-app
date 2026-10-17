# Phase 4 — What-if Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller can try "what if" scenarios — material prices up or down, more or fewer sales, a different selling price — and see Now vs Simulation side by side, without changing their data; the scenario lives in the URL so it can be reloaded or opened from a link.

**Architecture:** `lib/calc/overrides.ts` adds the spec's pure `applyOverrides(data, overrides)`; the simulation reuses `analyzeStore` on the overridden data. `lib/simulation/query.ts` parses/serialises overrides to a validated URL format (Phase 5's AI "Coba di simulasi" links will use it), and `lib/simulation/compare.ts` builds the Now-vs-Simulation comparison. The `simulasi` page is a Server Component that loads `StoreData` and the URL overrides, then hands both to one Client Component that recalculates on every control change and mirrors the scenario into the address bar.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript strict, next-intl 4, Tailwind 4 + shadcn (Base UI), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-untungin-design.md` — §4.4 (what-if simulation), §5.2 (`simulasi` row), §6.2 (AI recommendations map to `Overrides`), §10 item 4.

**Base branch:** `feat/tahap-4-simulasi` (created from `master` after PR #3 was merged).

## Global Constraints

- Read `AGENTS.md`: Next.js 16.4 — page `params` and `searchParams` are `Promise<…>`; check `node_modules/next/dist/docs/` for any API you are unsure of.
- Code comments, README and docs in English. Every user-facing string comes from `messages/id.json` and `messages/en.json` with identical keys (`tests/unit/messages.test.ts`); Indonesian is the default locale.
- The simulation is never saved: no Server Action, no database write (spec §4.4).
- Money shown with `formatRupiah`, percentages with `formatPercent`, numbers with `formatNumber`; "—" plus a hint whenever a value cannot exist — never `NaN`, `Infinity` or `-0`.
- `lib/calc` imports nothing from next, react, @supabase/*, @/lib/data, @/lib/config or @/lib/simulation.
- Mobile first: tap targets ≥ 40px, no horizontal scroll at 360px; status shown as colour AND text.
- Links from `@/i18n/navigation` with unprefixed paths; `buttonVariants` on `<Link>`, never `asChild`.
- No new runtime dependencies.
- Tests: `npm test`, `npm run test:rls`, and e2e against a production build only (`npm run build`, `npx next start -p 3100` in the background, `npx playwright test`, stop the server). Never `rm -rf .next`; never touch the dev server on port 3000.
- Commit messages are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Extreme controls (all materials −100% so they cost nothing, sales −100% so nothing sells) must show "—" with hints or valid numbers — never NaN/Infinity — and the page must not crash. — Tests in Task 1 and Task 3.
2. A hand-edited or hostile URL (`?m=abc&s=99999&p.x.y=-5`, unknown ids, arrays) must be ignored or rejected field by field, leaving a working page that simulates only the valid parts. — Tests in Task 2 and Task 3.
3. The simulation must never change saved data: after playing with every control, the dashboard and product prices are unchanged. — Test in Task 3.
4. A store without any priced product must get an empty state that says what to fill in, not an empty comparison. — Test in Task 3.
5. The address bar must carry the scenario: reloading (or opening the copied link) reproduces the same simulated numbers. — Test in Task 3.

## Rulings

- **URL format (also for Phase 5 AI links):** `m=<pct>` all materials; `m.<materialId>=<pct>` one material (replaces `m` for that material, not compounded); `s=<pct>` sales change (`s=20` → `salesMultiplier` 1.2); `p.<productId>.<channelId>=<price>` selling price. Percentages accepted from −100 to 300; prices whole Rupiah 0–2.000.000.000; ids must be UUIDs. Invalid entries are dropped one by one.
- **A price override for a product/channel without a saved price** adds a row with a sales estimate of 0 (it shows up as a line, but changes no totals until sales are simulated).
- **Material changes never push a price below Rp0** (−100% is the floor).
- **Controls:** sliders for "all materials" and "sales" (−50% to +100% in 5% steps; a URL value outside that range widens the slider), a per-material percentage field (blank = follow "all"), and a price field per product/channel line. A reset button returns to the saved numbers.
- **Navigation:** "Simulasi" goes in the desktop sidebar and on the phone "Lainnya" page (the four-item bottom bar is unchanged); the dashboard gets a "Coba simulasi" button once there is something to simulate.

## File Structure

```
lib/calc/overrides.ts                     Overrides, ALL_MATERIALS, priceKey, applyOverrides
lib/simulation/query.ts                   SIMULATION_LIMITS, parseOverrides, overridesToSearchParams
lib/simulation/compare.ts                 COMPARED_METRICS, compareMetrics (now / sim / diff / tone)
app/[locale]/s/[storeId]/simulasi/page.tsx                Server Component: data + URL overrides, empty state
app/[locale]/s/[storeId]/simulasi/simulation-panel.tsx    Client Component: controls, comparison, URL sync
lib/nav.ts, app/[locale]/s/[storeId]/dashboard/page.tsx  navigation + "Coba simulasi"
tests/unit/calc/overrides.test.ts tests/unit/simulation.test.ts tests/e2e/simulation.spec.ts
```

---

### Task 1: `applyOverrides`

**Files:**
- Create: `lib/calc/overrides.ts`
- Modify: `lib/calc/index.ts` (add `export * from "./overrides";`)
- Test: `tests/unit/calc/overrides.test.ts`

**Interfaces:**
- Consumes: `StoreData`, `computeMetrics` and the coffee-shop fixture `tests/unit/calc/fixture.ts` (materials kopi 150/g, susu 20/ml, cup 500/pcs, bubble 200/pcs; product `eskopi` yield 10; channels `offline` 0% and `online` 20% + Rp1.000; prices offline 18.000 × 300, online 20.000 × 100; fixed costs 1.650.000; net profit 3.030.000).
- Produces:
  ```ts
  export type Overrides = {
    materialPricePct?: Record<string, number>; // key ALL_MATERIALS or a material id; +50 = 50% more expensive
    salesMultiplier?: number;                  // 1.2 = 20% more sold
    prices?: Record<string, number>;           // key priceKey(productId, channelId)
  };
  export const ALL_MATERIALS = "all";
  export function priceKey(productId: string, channelId: string): string; // `${productId}:${channelId}`
  export function applyOverrides(data: StoreData, overrides: Overrides): StoreData; // pure; never mutates `data`
  ```

- [ ] **Step 1: Write the failing tests**

`tests/unit/calc/overrides.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ALL_MATERIALS, applyOverrides, computeMetrics, priceKey } from "@/lib/calc";
import { fixture } from "./fixture";

const net = (overrides: Parameters<typeof applyOverrides>[1]) => computeMetrics(applyOverrides(fixture(), overrides)).netProfit;

describe("applyOverrides", () => {
  it("changes nothing without overrides", () => {
    expect(applyOverrides(fixture(), {})).toEqual(fixture());
  });

  it("raises every material price", () => {
    // Material costs 2.220.000 × 1,5 = 3.330.000 → 6.900.000 − 3.330.000 − 1.650.000
    expect(net({ materialPricePct: { [ALL_MATERIALS]: 50 } })).toBeCloseTo(1920000, 6);
  });

  it("lets one material's own change replace the 'all' change", () => {
    // kopi +100% (300/g), the rest +0%: offline (60.000 + 20.000) / 10 + 500 = 8.500, online 8.700
    const data = applyOverrides(fixture(), { materialPricePct: { [ALL_MATERIALS]: 0, kopi: 100 } });
    expect(data.materials.find((m) => m.id === "kopi")?.purchasePrice).toBe(300000);
    expect(data.materials.find((m) => m.id === "susu")?.purchasePrice).toBe(20000);
    const lines = computeMetrics(data).lines;
    expect(lines.find((l) => l.channelId === "offline")?.materialCost).toBeCloseTo(8500, 6);
    expect(lines.find((l) => l.channelId === "online")?.materialCost).toBeCloseTo(8700, 6);
  });

  it("never pushes a price below zero", () => {
    const data = applyOverrides(fixture(), { materialPricePct: { [ALL_MATERIALS]: -150 } });
    expect(data.materials.every((m) => m.purchasePrice === 0)).toBe(true);
    // Materials free: 6.900.000 − 0 − 1.650.000
    expect(computeMetrics(data).netProfit).toBeCloseTo(5250000, 6);
  });

  it("multiplies every sales estimate", () => {
    // 4.680.000 × 1,2 − 1.650.000
    expect(net({ salesMultiplier: 1.2 })).toBeCloseTo(3966000, 6);
  });

  it("selling nothing gives nulls, not NaN", () => {
    const metrics = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 0 }));
    expect(metrics.totalUnits).toBe(0);
    expect(metrics.bepUnitsMonthly).toBeNull();
    expect(metrics.paybackMonths).toBeNull();
    expect(Number.isFinite(metrics.netProfit)).toBe(true);
  });

  it("a negative multiplier counts as zero", () => {
    expect(computeMetrics(applyOverrides(fixture(), { salesMultiplier: -1 })).totalUnits).toBe(0);
  });

  it("sets a selling price per product and channel", () => {
    // online 22.000: net 22.000 × 0,8 − 1.000 = 16.600 → 5.400.000 + 1.660.000 − 2.220.000 − 1.650.000
    expect(net({ prices: { [priceKey("eskopi", "online")]: 22000 } })).toBeCloseTo(3190000, 6);
  });

  it("adds a price row (without sales) for a channel that had none", () => {
    const base = fixture();
    base.products.push({ id: "baru", name: "Baru", yieldQty: 1, targetMarginPct: null, isActive: true });
    const data = applyOverrides(base, { prices: { [priceKey("baru", "offline")]: 5000 } });
    expect(data.prices).toContainEqual({ productId: "baru", channelId: "offline", price: 5000, estMonthlySales: 0, competitorPrice: null });
    expect(computeMetrics(data).netProfit).toBeCloseTo(3030000, 6);
  });

  it("ignores keys for unknown products or channels", () => {
    const data = applyOverrides(fixture(), { prices: { [priceKey("nope", "offline")]: 1, [priceKey("eskopi", "nope")]: 1 } });
    expect(data.prices).toEqual(fixture().prices);
  });

  it("does not mutate its input", () => {
    const input = fixture();
    applyOverrides(input, { materialPricePct: { [ALL_MATERIALS]: 50 }, salesMultiplier: 2, prices: { [priceKey("eskopi", "online")]: 1 } });
    expect(input).toEqual(fixture());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/calc/overrides.test.ts` — Expected: FAIL (`applyOverrides` not exported).

- [ ] **Step 3: Implement**

`lib/calc/overrides.ts`:

```ts
import type { StoreData } from "./types";

/** What-if changes applied on top of a store's data (spec §4.4). Never saved. */
export type Overrides = {
  /** Percent change of purchase prices: +50 = 50% more expensive. Key ALL_MATERIALS or a material id; an id's own value replaces ALL_MATERIALS for that material. */
  materialPricePct?: Record<string, number>;
  /** Multiplies every monthly sales estimate: 1.2 = 20% more sold. */
  salesMultiplier?: number;
  /** New selling price per priceKey(productId, channelId). */
  prices?: Record<string, number>;
};

export const ALL_MATERIALS = "all";

export function priceKey(productId: string, channelId: string): string {
  return `${productId}:${channelId}`;
}

export function applyOverrides(data: StoreData, overrides: Overrides): StoreData {
  const pct = overrides.materialPricePct ?? {};
  const materials = data.materials.map((material) => {
    const change = pct[material.id] ?? pct[ALL_MATERIALS];
    if (change === undefined) return material;
    return { ...material, purchasePrice: Math.max(0, material.purchasePrice * (1 + change / 100)) };
  });

  const multiplier = Math.max(0, overrides.salesMultiplier ?? 1);
  const newPrices = overrides.prices ?? {};
  const prices = data.prices.map((row) => ({
    ...row,
    price: newPrices[priceKey(row.productId, row.channelId)] ?? row.price,
    estMonthlySales: row.estMonthlySales * multiplier,
  }));

  const existing = new Set(data.prices.map((row) => priceKey(row.productId, row.channelId)));
  for (const [key, price] of Object.entries(newPrices)) {
    if (existing.has(key)) continue;
    const [productId, channelId] = key.split(":");
    const known = data.products.some((p) => p.id === productId) && data.channels.some((c) => c.id === channelId);
    if (known) prices.push({ productId, channelId, price, estMonthlySales: 0, competitorPrice: null });
  }

  return { ...data, materials, prices };
}
```

Add `export * from "./overrides";` to `lib/calc/index.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc && npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc tests/unit/calc/overrides.test.ts
git commit -m "feat(calc): applyOverrides for what-if simulation"
```

---

### Task 2: Simulation URL format and comparison

**Files:**
- Create: `lib/simulation/query.ts`, `lib/simulation/compare.ts`
- Test: `tests/unit/simulation.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Overrides`, `ALL_MATERIALS`, `priceKey`, `applyOverrides`), `computeMetrics`, `StoreMetrics` from `@/lib/calc`; `isUuid` from `@/lib/uuid`.
- Produces:
  ```ts
  // query.ts
  export const SIMULATION_LIMITS = { minPct: -100, maxPct: 300, maxPrice: 2_000_000_000 } as const;
  export type SearchParams = Record<string, string | string[] | undefined>;
  export function parseOverrides(query: SearchParams): Overrides;
  export function overridesToSearchParams(overrides: Overrides): URLSearchParams;
  // compare.ts
  export const COMPARED_METRICS = ["netProfit", "grossRevenue", "netMarginPct", "bepUnitsDaily", "paybackMonths"] as const;
  export type ComparedMetric = (typeof COMPARED_METRICS)[number];
  export type MetricComparison = { key: ComparedMetric; now: number | null; sim: number | null; diff: number | null; tone: "better" | "worse" | "same" };
  export function compareMetrics(now: StoreMetrics, sim: StoreMetrics): MetricComparison[];
  ```
  Profit and revenue count as `null` when nothing is expected to sell (as on the dashboard). Higher is better for profit, revenue and margin; lower is better for break-even units and payback months.

- [ ] **Step 1: Write the failing tests**

`tests/unit/simulation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ALL_MATERIALS, applyOverrides, computeMetrics, priceKey } from "@/lib/calc";
import { compareMetrics } from "@/lib/simulation/compare";
import { overridesToSearchParams, parseOverrides } from "@/lib/simulation/query";
import { fixture } from "./calc/fixture";

const P = "6f1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f60";
const C = "7a1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f61";
const M = "8b1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f62";

describe("parseOverrides", () => {
  it("reads every kind of override", () => {
    expect(parseOverrides({ m: "50", [`m.${M}`]: "-10", s: "20", [`p.${P}.${C}`]: "18000" })).toEqual({
      materialPricePct: { [ALL_MATERIALS]: 50, [M]: -10 },
      salesMultiplier: 1.2,
      prices: { [priceKey(P, C)]: 18000 },
    });
  });

  it("returns nothing for an empty query", () => {
    expect(parseOverrides({})).toEqual({});
  });

  it("takes the first value of a repeated key", () => {
    expect(parseOverrides({ m: ["10", "90"] })).toEqual({ materialPricePct: { [ALL_MATERIALS]: 10 } });
  });

  it.each([
    [{ m: "abc" }],
    [{ m: "" }],
    [{ m: "301" }],
    [{ m: "-101" }],
    [{ s: "99999" }],
    [{ s: "Infinity" }],
    [{ "m.not-a-uuid": "10" }],
    [{ "p.x.y": "5000" }],
    [{ [`p.${P}.${C}`]: "-5" }],
    [{ [`p.${P}.${C}`]: "18000.5" }],
    [{ [`p.${P}.${C}`]: "3000000000" }],
    [{ [`p.${P}`]: "18000" }],
    [{ other: "1" }],
  ])("drops the invalid entry %j", (query) => {
    expect(parseOverrides(query)).toEqual({});
  });

  it("keeps valid entries next to invalid ones", () => {
    expect(parseOverrides({ m: "abc", s: "50" })).toEqual({ salesMultiplier: 1.5 });
  });
});

describe("overridesToSearchParams", () => {
  it("round-trips through parseOverrides", () => {
    const overrides = {
      materialPricePct: { [ALL_MATERIALS]: 25, [M]: -5 },
      salesMultiplier: 0.75,
      prices: { [priceKey(P, C)]: 12500 },
    };
    const params = overridesToSearchParams(overrides);
    expect(params.toString()).toBe(`m=25&m.${M}=-5&s=-25&p.${P}.${C}=12500`);
    expect(parseOverrides(Object.fromEntries(params))).toEqual(overrides);
  });

  it("leaves out a sales multiplier of 1", () => {
    expect(overridesToSearchParams({ salesMultiplier: 1 }).toString()).toBe("");
  });
});

describe("compareMetrics", () => {
  const now = computeMetrics(fixture());

  it("compares the fixture with all materials 50% more expensive", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { materialPricePct: { [ALL_MATERIALS]: 50 } }));
    const byKey = Object.fromEntries(compareMetrics(now, sim).map((c) => [c.key, c]));
    expect(byKey.netProfit).toMatchObject({ tone: "worse" });
    expect(byKey.netProfit.diff).toBeCloseTo(-1110000, 6);
    expect(byKey.grossRevenue).toMatchObject({ diff: 0, tone: "same" });
    // Break-even rises from 6 to 8 sales per day: worse.
    expect(byKey.bepUnitsDaily).toMatchObject({ now: 6, sim: 8, diff: 2, tone: "worse" });
    expect(byKey.paybackMonths.tone).toBe("worse");
    expect(byKey.netMarginPct.tone).toBe("worse");
  });

  it("calls more sales better and keeps the metric order", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 1.2 }));
    const comparisons = compareMetrics(now, sim);
    expect(comparisons.map((c) => c.key)).toEqual(["netProfit", "grossRevenue", "netMarginPct", "bepUnitsDaily", "paybackMonths"]);
    expect(comparisons[0].tone).toBe("better");
  });

  it("has no profit, revenue or difference when nothing sells", () => {
    const sim = computeMetrics(applyOverrides(fixture(), { salesMultiplier: 0 }));
    const byKey = Object.fromEntries(compareMetrics(now, sim).map((c) => [c.key, c]));
    expect(byKey.netProfit).toMatchObject({ sim: null, diff: null, tone: "same" });
    expect(byKey.grossRevenue).toMatchObject({ sim: null, diff: null });
    expect(byKey.bepUnitsDaily).toMatchObject({ sim: null, diff: null });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/simulation.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`lib/simulation/query.ts`:

```ts
import { ALL_MATERIALS, priceKey, type Overrides } from "@/lib/calc";
import { isUuid } from "@/lib/uuid";

/**
 * Simulation scenarios live in the URL (spec §4.4; Phase 5 AI links use the same format):
 *   m=<pct>                         all materials, +50 = 50% more expensive
 *   m.<materialId>=<pct>            one material (replaces m for that material)
 *   s=<pct>                         sales change, s=20 → 20% more sold
 *   p.<productId>.<channelId>=<Rp>  selling price
 * Each invalid entry is dropped on its own.
 */
export const SIMULATION_LIMITS = { minPct: -100, maxPct: 300, maxPrice: 2_000_000_000 } as const;

export type SearchParams = Record<string, string | string[] | undefined>;

function numberFrom(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const validPct = (value: number) => value >= SIMULATION_LIMITS.minPct && value <= SIMULATION_LIMITS.maxPct;
const validPrice = (value: number) => Number.isInteger(value) && value >= 0 && value <= SIMULATION_LIMITS.maxPrice;

export function parseOverrides(query: SearchParams): Overrides {
  const overrides: Overrides = {};
  for (const [key, raw] of Object.entries(query)) {
    const value = numberFrom(raw);
    if (value === null) continue;
    if ((key === "m" || key.startsWith("m.")) && validPct(value)) {
      const id = key === "m" ? ALL_MATERIALS : key.slice(2);
      if (id === ALL_MATERIALS || isUuid(id)) overrides.materialPricePct = { ...overrides.materialPricePct, [id]: value };
    } else if (key === "s" && validPct(value)) {
      overrides.salesMultiplier = 1 + value / 100;
    } else if (key.startsWith("p.") && validPrice(value)) {
      const ids = key.slice(2).split(".");
      if (ids.length === 2 && ids.every(isUuid)) overrides.prices = { ...overrides.prices, [priceKey(ids[0], ids[1])]: value };
    }
  }
  return overrides;
}

export function overridesToSearchParams(overrides: Overrides): URLSearchParams {
  const params = new URLSearchParams();
  for (const [id, pct] of Object.entries(overrides.materialPricePct ?? {})) {
    params.set(id === ALL_MATERIALS ? "m" : `m.${id}`, String(pct));
  }
  if (overrides.salesMultiplier !== undefined && overrides.salesMultiplier !== 1) {
    params.set("s", String(Math.round((overrides.salesMultiplier - 1) * 100 * 1e4) / 1e4));
  }
  for (const [key, price] of Object.entries(overrides.prices ?? {})) {
    const [productId, channelId] = key.split(":");
    params.set(`p.${productId}.${channelId}`, String(price));
  }
  return params;
}
```

`lib/simulation/compare.ts`:

```ts
import type { StoreMetrics } from "@/lib/calc";

export const COMPARED_METRICS = ["netProfit", "grossRevenue", "netMarginPct", "bepUnitsDaily", "paybackMonths"] as const;
export type ComparedMetric = (typeof COMPARED_METRICS)[number];
export type MetricComparison = {
  key: ComparedMetric;
  now: number | null;
  sim: number | null;
  diff: number | null;
  tone: "better" | "worse" | "same";
};

const HIGHER_IS_BETTER: Record<ComparedMetric, boolean> = {
  netProfit: true,
  grossRevenue: true,
  netMarginPct: true,
  bepUnitsDaily: false,
  paybackMonths: false,
};

/** Profit and revenue mean nothing when no sales are expected (the dashboard shows "—" then too). */
function valueOf(metrics: StoreMetrics, key: ComparedMetric): number | null {
  if ((key === "netProfit" || key === "grossRevenue") && metrics.totalUnits === 0) return null;
  return metrics[key];
}

export function compareMetrics(now: StoreMetrics, sim: StoreMetrics): MetricComparison[] {
  return COMPARED_METRICS.map((key) => {
    const before = valueOf(now, key);
    const after = valueOf(sim, key);
    const diff = before === null || after === null ? null : after - before;
    const tone =
      diff === null || Math.abs(diff) < 1e-9 ? "same" : diff > 0 === HIGHER_IS_BETTER[key] ? "better" : "worse";
    return { key, now: before, sim: after, diff, tone };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/simulation tests/unit/simulation.test.ts
git commit -m "feat(simulation): URL format for scenarios and Now-vs-Simulation comparison"
```

---

### Task 3: Simulation page

**Files:**
- Create: `app/[locale]/s/[storeId]/simulasi/page.tsx`, `app/[locale]/s/[storeId]/simulasi/simulation-panel.tsx`
- Modify: `messages/id.json`, `messages/en.json` (add `Simulation`)
- Test: `tests/e2e/simulation.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–2; `loadStoreData`, `tryAnalyzeStore`, `EmptyState`, `StatusBadge`, `buttonVariants`, `Card*`, `Input`, `Label`, `formatRupiah`, `formatPercent`, `formatNumber`, `priceInputSchema`, the `Warnings` messages (Phase 2), e2e helpers `signIn`, `createStoreViaOnboarding`, `storeUrl`, `addMaterial`, `addProduct`, `addCompositionRow`, `setPrice`, `addExpense`.
- Produces: the page `/s/[storeId]/simulasi`. Test ids: `sim-now-<metric>`, `sim-sim-<metric>`, `sim-diff-<metric>` for every `ComparedMetric`. Control labels: "Harga semua bahan", "Jumlah terjual", per material "Perubahan harga {material} (%)", per line "Harga jual {product} ({channel})"; reset button "Kembali ke angka sekarang".

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/simulation.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import {
  addCompositionRow,
  addExpense,
  addMaterial,
  addProduct,
  createStoreViaOnboarding,
  setPrice,
  signIn,
  storeUrl,
} from "./helpers";

/** Gula Rp15/g; Es teh: 200 g per 10 → Rp300; price Rp5.000 × 600/month; rent Rp1.000.000 → net Rp1.820.000. */
async function storeWithOneProduct(page: Page) {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Simulasi");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Gula", qty: "1", unit: "kg", price: "15.000" });
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await setPrice(page, { price: "5.000", est: "600" });
  await page.goto(storeUrl(page, "biaya"));
  await addExpense(page, { name: "Sewa", category: "sewa", amount: "1.000.000", frequency: "bulanan" });
  await page.goto(storeUrl(page, "simulasi"));
}

test("a store without priced products gets an empty state", async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kosong");
  await page.goto(storeUrl(page, "simulasi"));
  await expect(page.getByText("Belum ada yang bisa disimulasikan")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ke halaman produk" })).toBeVisible();
});

test("each control changes the simulated profit", async ({ page }) => {
  await storeWithOneProduct(page);
  await expect(page.getByTestId("sim-now-netProfit")).toHaveText("Rp1.820.000");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.820.000");

  // Materials +100%: 600 × (5.000 − 600) − 1.000.000
  await page.getByLabel("Harga semua bahan").fill("100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.640.000");
  await expect(page.getByTestId("sim-diff-netProfit")).toHaveText("-Rp180.000");

  await page.getByRole("button", { name: "Kembali ke angka sekarang" }).click();
  // Sales +50%: 900 × 4.700 − 1.000.000
  await page.getByLabel("Jumlah terjual").fill("50");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp3.230.000");
  await expect(page.getByTestId("sim-diff-netProfit")).toHaveText("+Rp1.410.000");

  await page.getByRole("button", { name: "Kembali ke angka sekarang" }).click();
  // Price Rp6.000: 600 × (6.000 − 300) − 1.000.000
  await page.getByLabel("Harga jual Es teh (Offline – Tunai)").fill("6.000");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp2.420.000");

  // Materials free: never NaN. The per-material fields sit in a closed <details>.
  await page.getByRole("button", { name: "Kembali ke angka sekarang" }).click();
  await page.getByText("Atur per bahan").click();
  await page.getByLabel("Perubahan harga Gula (%)").fill("-100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp2.000.000");
  expect(await page.getByRole("main").innerText()).not.toMatch(/NaN|Infinity/);
});

test("nothing sold shows dashes, never NaN", async ({ page }) => {
  await storeWithOneProduct(page);
  // The slider stops at −50%; a link can ask for −100% and widens it.
  await page.goto(`${storeUrl(page, "simulasi")}?s=-100`);
  await expect(page.getByLabel("Jumlah terjual")).toHaveValue("-100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("—");
  await expect(page.getByTestId("sim-sim-bepUnitsDaily")).toHaveText("—");
  expect(await page.getByRole("main").innerText()).not.toMatch(/NaN|Infinity/);
});

test("the address bar keeps the scenario, hostile links are ignored, and nothing is saved", async ({ page }) => {
  await storeWithOneProduct(page);
  await page.getByLabel("Harga semua bahan").fill("100");
  await expect(page).toHaveURL(/[?&]m=100(&|$)/);
  await page.reload();
  await expect(page.getByLabel("Harga semua bahan")).toHaveValue("100");
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.640.000");

  await page.goto(`${storeUrl(page, "simulasi")}?s=50`);
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp3.230.000");

  await page.goto(`${storeUrl(page, "simulasi")}?m=abc&s=99999&p.x.y=-5`);
  await expect(page.getByTestId("sim-sim-netProfit")).toHaveText("Rp1.820.000");

  await page.goto(storeUrl(page, "dashboard"));
  await expect(page.getByTestId("metric-netProfit")).toHaveText("Rp1.820.000");
});

test("fits a phone without horizontal scrolling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.setViewportSize({ width: 360, height: 800 });
  await storeWithOneProduct(page);
  await page.getByLabel("Harga semua bahan").fill("100");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

Run (production build): `npx playwright test tests/e2e/simulation.spec.ts` — Expected: FAIL (404).

- [ ] **Step 2: Add the messages**

`messages/id.json`:

```json
  "Simulation": {
    "title": "Simulasi",
    "intro": "Coba ubah harga bahan, jumlah terjual, atau harga jual. Tidak ada yang disimpan — data aslimu aman.",
    "controlsTitle": "Ubah angka",
    "materialAll": "Harga semua bahan",
    "sales": "Jumlah terjual",
    "perMaterial": "Atur per bahan",
    "perMaterialHint": "Kosongkan untuk ikut \"Harga semua bahan\".",
    "materialPct": "Perubahan harga {material} (%)",
    "prices": "Harga jual",
    "priceFor": "Harga jual {product} ({channel})",
    "reset": "Kembali ke angka sekarang",
    "resultsTitle": "Hasil",
    "now": "Sekarang",
    "sim": "Simulasi",
    "diff": "Selisih",
    "metrics": {
      "netProfit": "Laba bersih / bulan",
      "grossRevenue": "Omzet / bulan",
      "netMarginPct": "Margin bersih",
      "bepUnitsDaily": "Titik impas",
      "paybackMonths": "Balik modal"
    },
    "perDay": "{units, number} terjual/hari",
    "months": "≈ {months} bulan",
    "linesTitle": "Margin per produk",
    "lineMargin": "{now} → {sim}",
    "warningsTitle": "Peringatan di simulasi",
    "shareHint": "Alamat halaman ini menyimpan pengaturan simulasi, jadi bisa dibuka lagi atau dibagikan.",
    "emptyTitle": "Belum ada yang bisa disimulasikan",
    "emptyBody": "Isi produk dengan komposisi, harga, dan perkiraan penjualan dulu.",
    "emptyAction": "Ke halaman produk",
    "calcError": "Ada komposisi dengan satuan yang tidak cocok. Perbaiki dulu di halaman produk."
  },
```

`messages/en.json`:

```json
  "Simulation": {
    "title": "Simulation",
    "intro": "Try other material prices, sales or selling prices. Nothing is saved — your real data stays as it is.",
    "controlsTitle": "Change the numbers",
    "materialAll": "All material prices",
    "sales": "Units sold",
    "perMaterial": "Per material",
    "perMaterialHint": "Leave empty to follow \"All material prices\".",
    "materialPct": "Price change of {material} (%)",
    "prices": "Selling prices",
    "priceFor": "Selling price of {product} ({channel})",
    "reset": "Back to current numbers",
    "resultsTitle": "Results",
    "now": "Now",
    "sim": "Simulation",
    "diff": "Difference",
    "metrics": {
      "netProfit": "Net profit / month",
      "grossRevenue": "Revenue / month",
      "netMarginPct": "Net margin",
      "bepUnitsDaily": "Break-even",
      "paybackMonths": "Payback"
    },
    "perDay": "{units, plural, one {# sale/day} other {# sales/day}}",
    "months": "≈ {months} months",
    "linesTitle": "Margin per product",
    "lineMargin": "{now} → {sim}",
    "warningsTitle": "Warnings in the simulation",
    "shareHint": "This page's address keeps the simulation settings, so you can reopen or share it.",
    "emptyTitle": "Nothing to simulate yet",
    "emptyBody": "First give a product its composition, a price and expected sales.",
    "emptyAction": "Go to products",
    "calcError": "A composition row uses a unit that doesn't match its material. Fix it on the product page first."
  },
```

- [ ] **Step 3: Build the page**

`app/[locale]/s/[storeId]/simulasi/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { tryAnalyzeStore } from "@/lib/calc";
import { loadStoreData } from "@/lib/data/load-store-data";
import { parseOverrides, type SearchParams } from "@/lib/simulation/query";
import { SimulationPanel } from "./simulation-panel";

type Props = { params: Promise<{ locale: string; storeId: string }>; searchParams: Promise<SearchParams> };

export default async function SimulationPage({ params, searchParams }: Props) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Simulation");
  const { analysis } = tryAnalyzeStore(data);
  // A CalcError still opens the panel, which explains what to fix.
  const hasSomethingToSimulate = analysis === null || analysis.lines.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {hasSomethingToSimulate ? (
        <SimulationPanel data={data} initial={parseOverrides(await searchParams)} />
      ) : (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
          <Link href={`/s/${data.store.id}/produk`} className={buttonVariants({ variant: "outline" })}>
            {t("emptyAction")}
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
```

`app/[locale]/s/[storeId]/simulasi/simulation-panel.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/store/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALL_MATERIALS,
  applyOverrides,
  priceKey,
  tryAnalyzeStore,
  type LineRef,
  type Overrides,
  type StoreData,
} from "@/lib/calc";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { compareMetrics, type ComparedMetric, type MetricComparison } from "@/lib/simulation/compare";
import { overridesToSearchParams, SIMULATION_LIMITS } from "@/lib/simulation/query";
import { cn } from "@/lib/utils";
import { priceInputSchema } from "@/lib/validation/price";

const SLIDER = { min: -50, max: 100, step: 5 } as const;

const TONE: Record<MetricComparison["tone"], string> = {
  better: "text-emerald-700 dark:text-emerald-400",
  worse: "text-destructive",
  same: "text-muted-foreground",
};

export function SimulationPanel({ data, initial }: { data: StoreData; initial: Overrides }) {
  const t = useTranslations("Simulation");
  const tWarnings = useTranslations("Warnings");
  const locale = useLocale();
  const [overrides, setOverrides] = useState<Overrides>(initial);
  const [resetKey, setResetKey] = useState(0);

  const now = useMemo(() => tryAnalyzeStore(data).analysis, [data]);
  const sim = useMemo(() => tryAnalyzeStore(applyOverrides(data, overrides)).analysis, [data, overrides]);

  // The address bar carries the scenario so it can be reloaded or shared (spec §4.4).
  useEffect(() => {
    const query = overridesToSearchParams(overrides).toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, [overrides]);

  if (!now || !sim) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        {t("calcError")}
      </p>
    );
  }

  const signed = (text: string, value: number) => (value > 0 ? `+${text}` : text);
  const pctLabel = (value: number) => signed(formatPercent(value, locale), value);
  const productName = (id: string) => data.products.find((p) => p.id === id)?.name ?? "?";
  const channelName = (id: string) => data.channels.find((c) => c.id === id)?.name ?? "?";
  const lineLabel = (ref: LineRef) => `${productName(ref.productId)} (${channelName(ref.channelId)})`;

  function setMaterialPct(id: string, value: number | undefined) {
    setOverrides((current) => {
      const next = { ...current.materialPricePct };
      if (value === undefined || (id === ALL_MATERIALS && value === 0)) delete next[id];
      else next[id] = value;
      return { ...current, materialPricePct: next };
    });
  }

  function setSalesPct(value: number) {
    setOverrides((current) => ({ ...current, salesMultiplier: value === 0 ? undefined : 1 + value / 100 }));
  }

  function setPrice(key: string, raw: string) {
    const parsed = priceInputSchema.shape.price.safeParse(raw);
    setOverrides((current) => {
      const next = { ...current.prices };
      if (parsed.success) next[key] = parsed.data;
      else delete next[key];
      return { ...current, prices: next };
    });
  }

  function reset() {
    setOverrides({});
    setResetKey((key) => key + 1);
  }

  const materialAll = overrides.materialPricePct?.[ALL_MATERIALS] ?? 0;
  const salesPct = Math.round(((overrides.salesMultiplier ?? 1) - 1) * 100);

  const formatValue = (key: ComparedMetric, value: number | null) => {
    if (value === null) return "—";
    if (key === "netProfit" || key === "grossRevenue") return formatRupiah(value, locale);
    if (key === "netMarginPct") return formatPercent(value, locale);
    if (key === "bepUnitsDaily") return t("perDay", { units: value });
    return t("months", { months: formatNumber(value, locale, 1) });
  };
  const formatDiff = (key: ComparedMetric, diff: number | null) => {
    if (diff === null) return "—";
    if (key === "netProfit" || key === "grossRevenue") return signed(formatRupiah(diff, locale), diff);
    if (key === "netMarginPct") return signed(formatPercent(diff, locale), diff);
    return signed(formatNumber(diff, locale, key === "paybackMonths" ? 1 : 0), diff);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("resultsTitle")}</CardTitle>
          <CardDescription>{t("shareHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul aria-live="polite" className="divide-y">
            {compareMetrics(now, sim).map((row) => (
              <li key={row.key} className="space-y-1 py-3">
                <p className="text-sm text-muted-foreground">{t(`metrics.${row.key}`)}</p>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm">
                    {t("now")}: <span data-testid={`sim-now-${row.key}`}>{formatValue(row.key, row.now)}</span>
                  </span>
                  <span className="font-semibold [overflow-wrap:anywhere]">
                    {t("sim")}: <span data-testid={`sim-sim-${row.key}`}>{formatValue(row.key, row.sim)}</span>
                  </span>
                  <span className={cn("text-sm font-medium", TONE[row.tone])} data-testid={`sim-diff-${row.key}`}>
                    {formatDiff(row.key, row.diff)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("controlsTitle")}</CardTitle>
        </CardHeader>
        <CardContent key={resetKey} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="sim-materials">{t("materialAll")}</Label>
              <span className="text-sm font-medium">{pctLabel(materialAll)}</span>
            </div>
            <input
              id="sim-materials"
              type="range"
              min={Math.min(SLIDER.min, materialAll)}
              max={Math.max(SLIDER.max, materialAll)}
              step={SLIDER.step}
              value={materialAll}
              aria-valuetext={pctLabel(materialAll)}
              onChange={(event) => setMaterialPct(ALL_MATERIALS, Number(event.target.value))}
              className="h-10 w-full accent-primary"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="sim-sales">{t("sales")}</Label>
              <span className="text-sm font-medium">{pctLabel(salesPct)}</span>
            </div>
            <input
              id="sim-sales"
              type="range"
              min={Math.min(SLIDER.min, salesPct)}
              max={Math.max(SLIDER.max, salesPct)}
              step={SLIDER.step}
              value={salesPct}
              aria-valuetext={pctLabel(salesPct)}
              onChange={(event) => setSalesPct(Number(event.target.value))}
              className="h-10 w-full accent-primary"
            />
          </div>

          <details className="space-y-3">
            <summary className="flex min-h-10 cursor-pointer items-center text-sm font-medium">{t("perMaterial")}</summary>
            <p className="text-xs text-muted-foreground">{t("perMaterialHint")}</p>
            {data.materials.map((material) => (
              <div key={material.id} className="space-y-1">
                <Label htmlFor={`sim-material-${material.id}`}>{t("materialPct", { material: material.name })}</Label>
                <Input
                  id={`sim-material-${material.id}`}
                  inputMode="decimal"
                  defaultValue={overrides.materialPricePct?.[material.id]?.toString() ?? ""}
                  onChange={(event) => {
                    const raw = event.target.value.trim().replace(",", ".");
                    const value = raw === "" ? undefined : Number(raw);
                    const ok =
                      value === undefined ||
                      (Number.isFinite(value) && value >= SIMULATION_LIMITS.minPct && value <= SIMULATION_LIMITS.maxPct);
                    if (ok) setMaterialPct(material.id, value);
                  }}
                />
              </div>
            ))}
          </details>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t("prices")}</p>
            {now.lines.map((line) => {
              const key = priceKey(line.productId, line.channelId);
              const label = t("priceFor", { product: productName(line.productId), channel: channelName(line.channelId) });
              return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`sim-price-${key}`} className="[overflow-wrap:anywhere]">
                    {label}
                  </Label>
                  <Input
                    id={`sim-price-${key}`}
                    inputMode="numeric"
                    defaultValue={String(overrides.prices?.[key] ?? line.price)}
                    onChange={(event) => setPrice(key, event.target.value)}
                  />
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" onClick={reset}>
            {t("reset")}
          </Button>
        </CardContent>
      </Card>

      {sim.lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("linesTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {sim.lines.map((line) => {
                const before = now.lines.find((l) => l.productId === line.productId && l.channelId === line.channelId);
                const margin = (value: number | null | undefined) =>
                  value === null || value === undefined ? "—" : formatPercent(value, locale);
                return (
                  <li key={`${line.productId}:${line.channelId}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="min-w-0 text-sm [overflow-wrap:anywhere]">{lineLabel(line)}</span>
                    <span className="flex items-center gap-2 text-sm">
                      {t("lineMargin", { now: margin(before?.marginPct), sim: margin(line.marginPct) })}
                      <StatusBadge status={line.status} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {sim.warnings.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("warningsTitle")}</h2>
          <ul className="space-y-2">
            {sim.warnings.map((warning) => (
              <li key={warning.code} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm [overflow-wrap:anywhere]">
                {tWarnings(warning.code, { products: warning.lines.map(lineLabel).join(", ") })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

The price field label must match the e2e label exactly ("Harga jual Es teh (Offline – Tunai)"); the `priceFor` message produces it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .`, then (production build) `npx playwright test tests/e2e/simulation.spec.ts`, then the full e2e suite.
Expected: PASS. If a hand-calculated number in the test differs, recompute by hand and report it instead of changing code to match.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/s/[storeId]/simulasi" messages tests/e2e/simulation.spec.ts
git commit -m "feat(simulation): what-if page with Now vs Simulation and a shareable URL"
```

---

### Task 4: Navigation, dashboard link and spec notes

**Files:**
- Modify: `lib/nav.ts`, `app/[locale]/s/[storeId]/dashboard/page.tsx`, `messages/id.json`, `messages/en.json` (`StoreShell.nav.simulation`, `StoreShell.moreDescriptions.simulation`, `Dashboard.trySimulation`), `docs/superpowers/specs/2026-10-16-untungin-design.md`
- Test: `tests/unit/nav.test.ts`, `tests/e2e/store-shell.spec.ts`, `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `NavLabelKey` gains `"simulation"` (path `simulasi`, icon `FlaskConical`); sidebar order dashboard, products, materials, channels, expenses, assets, simulation, settings; "Lainnya" lists channels, expenses, assets, simulation, settings. The dashboard shows a "Coba simulasi" outline button (to `/s/{id}/simulasi`) when the analysis has at least one line.

- [ ] **Step 1: Write the failing tests**

Update `tests/unit/nav.test.ts`: sidebar becomes `dashboard /dashboard, products /produk, materials /bahan, channels /kanal, expenses /biaya, assets /inventaris, simulation /simulasi, settings /pengaturan`; `moreNavItems` becomes `channels, expenses, assets, simulation, settings` with their hrefs; add `["/s/abc/simulasi", true]` to the `isMoreActive` table. In `tests/e2e/store-shell.spec.ts` add `"Simulasi"` to the names the "Lainnya lists …" test expects. In `tests/e2e/dashboard.spec.ts`, at the end of "the full flow shows profit, break-even and payback", add:

```ts
  await page.getByRole("link", { name: "Coba simulasi" }).click();
  await expect(page).toHaveURL(/\/simulasi$/);
  await expect(page.getByTestId("sim-now-netProfit")).toHaveText("Rp170.000");
```

and in "a new store shows the checklist …" add `await expect(page.getByRole("link", { name: "Coba simulasi" })).toHaveCount(0);`.

Run them — FAIL.

- [ ] **Step 2: Implement**

In `lib/nav.ts`: import `FlaskConical` from `lucide-react`; add `"simulation"` to `NavLabelKey`; add `simulation: { path: "simulasi", icon: FlaskConical }` to `PAGES`; `MORE_KEYS = ["channels", "expenses", "assets", "simulation", "settings"] as const`; sidebar keys `["dashboard", "products", "materials", "channels", "expenses", "assets", "simulation", "settings"]`.

Messages: `StoreShell.nav.simulation` "Simulasi" / "Simulation"; `StoreShell.moreDescriptions.simulation` "Coba ubah harga dan penjualan tanpa mengubah datamu" / "Try other prices and sales without changing your data"; `Dashboard.trySimulation` "Coba simulasi" / "Try a simulation".

In `app/[locale]/s/[storeId]/dashboard/page.tsx`, inside the `{analysis && (<>…</>)}` block, right after `<MetricCards analysis={analysis} />`, add:

```tsx
          {analysis.lines.length > 0 && (
            <Link href={`/s/${data.store.id}/simulasi`} className={buttonVariants({ variant: "outline" })}>
              {t("trySimulation")}
            </Link>
          )}
```

(import `buttonVariants` from `@/components/ui/button`).

- [ ] **Step 3: Update the spec**

In `docs/superpowers/specs/2026-10-16-untungin-design.md` §4.4, after the "Overrides can be filled from the query string" sentence, add: "URL format: `m=<pct>` all materials, `m.<materialId>=<pct>` one material (replaces `m` for it), `s=<pct>` sales change (`s=20` → multiplier 1.2), `p.<productId>.<channelId>=<price>`; percentages −100…300, prices whole Rupiah 0…2.000.000.000, ids must be UUIDs; each invalid entry is dropped. A price for a product/channel without a saved price adds a row with 0 sales." In §10, after item 4, add an indented note: "Phase 4 notes: sliders −50%…+100% (wider when the URL asks for more); per-material fields replace the all-materials change; the page keeps the scenario in the address bar via `history.replaceState`; navigation in the sidebar and the phone 'Lainnya' page, plus a 'Coba simulasi' button on the dashboard."

- [ ] **Step 4: Run everything**

Run: `npm test && npx tsc --noEmit && npx eslint . && npm run test:rls`, then build and run the **whole** e2e suite against the production server.
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nav.ts "app/[locale]/s/[storeId]/dashboard/page.tsx" messages docs/superpowers/specs tests
git commit -m "feat(simulation): navigation, dashboard shortcut and spec notes"
```

---

## Self-review notes (for the executor)

- Spec coverage: §4.4 `applyOverrides` with the exact `Overrides` shape (Task 1), query-string prefill (Task 2, used by Task 3), Now vs Simulation side by side with the difference (Tasks 2–3), not saved (Task 3 test), §5.2 `simulasi` page and navigation (Tasks 3–4). Phase 5 will build AI "Coba di simulasi" links with `overridesToSearchParams`.
- Names to keep consistent: `Overrides`, `ALL_MATERIALS`, `priceKey`, `applyOverrides`, `SIMULATION_LIMITS`, `SearchParams`, `parseOverrides`, `overridesToSearchParams`, `COMPARED_METRICS`, `ComparedMetric`, `MetricComparison`, `compareMetrics`, test ids `sim-now-*`, `sim-sim-*`, `sim-diff-*`.
- Hand-checked numbers: Task 1 (1.920.000; 8.500/8.700; 5.250.000; 3.966.000; 3.190.000), Task 2 (diff −1.110.000; break-even 6 → 8), Task 3 (1.820.000 → 1.640.000 / 3.230.000 / 2.420.000 / materials free 2.000.000).
