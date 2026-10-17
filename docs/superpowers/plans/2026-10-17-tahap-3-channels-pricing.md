# Phase 3 — Channels & Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller can add sales channels (custom or from templates such as GoFood and Shopee), set a price, sales estimate and competitor price per channel, add packaging used only in one channel, and see a recommended price with a "Pakai harga rekomendasi" button.

**Architecture:** `lib/calc/pricing.ts` adds the spec's price-recommendation formula as pure functions. A new `kanal` page manages `sales_channels` (custom form + template buttons from `lib/config/channel-templates.ts`). The product page gets one client `PriceSection` that receives `StoreData` once and renders a form per channel with competitor price, recommendation and live preview. Composition rows gain an optional channel. A shared `parseForm` helper replaces the five copied `parseX` functions before the sixth CRUD is added.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript strict, Supabase (RLS, composite FKs), zod 4, next-intl 4, Tailwind 4 + shadcn (Base UI), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-untungin-design.md` — §3.3 (`product_materials.channel_id`), §3.4 (channels, templates, prices), §4.2 item 9 (price recommendation), §4.3 (`COMPETITOR_GAP`), §5.2 (`kanal`, `produk/[id]`, checklist), §5.4, §10 item 3.

**Base branch:** create `feat/tahap-3-kanal` from `feat/tahap-2-hpp` (PR #2). If PR #2 is already merged, branch from `master`.

## Global Constraints

- Read `AGENTS.md`: Next.js 16.4 — check `node_modules/next/dist/docs/` for any API you are unsure of. Page `params` are `Promise<…>`.
- Code comments, README and docs in English. Every user-facing string comes from `messages/id.json` and `messages/en.json` with identical keys (`tests/unit/messages.test.ts`); Indonesian is the default locale. Brand names (GoFood, Shopee, …) are not translated.
- Money is integer Rupiah shown with `formatRupiah`; percentages with `formatPercent`; quantities and percentages parsed with `localeNumber`, Rupiah and counts with `wholeNumber`.
- Server code authenticates with `requireUser()` (getClaims), never `getSession()`. Every Server Action: uuid-check every id, scope updates/deletes by `id` AND `store_id`, `.select("id")` to detect 0-row results, `revalidateStore()` after success.
- Validation errors are message keys under `Validation`, translated server-side; raw `values` are echoed so forms refill (React 19 resets uncontrolled forms).
- Links/redirects from `@/i18n/navigation` with unprefixed paths; `buttonVariants` on `<Link>`, never `asChild`.
- Mobile first: tap targets ≥ 40px, no horizontal scroll at 360px, native selects via `NativeSelect`, empty states with explanation + example + action.
- `lib/calc` imports nothing from next, react, @supabase/*, @/lib/data or @/lib/config.
- No new runtime dependencies.
- Tests: `npm test`, `npm run test:rls`, and e2e against a production build only (`npm run build`, `npx next start -p 3100` in the background, `npx playwright test`, stop the server). Never `rm -rf .next` and never touch the dev server on port 3000.
- Commit messages are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Commission + target margin at or above 100% (e.g. a 70% channel with a 40% target) must show "no price satisfies this" — never Infinity, a negative, or Rp0 as a recommendation. — Tests in Task 2 and Task 6.
2. Deleting a channel that has prices and channel-only packaging must say what will be removed, remove them, update the dashboard; the last remaining channel cannot be deleted. — Tests in Task 5.
3. Adding the same template twice (or a custom channel with an existing name) must be refused instead of creating a duplicate "GoFood". — Tests in Task 5.
4. Packaging used only in one channel must raise that channel's HPP and leave every other channel's HPP unchanged. — Test in Task 7.
5. Competitor price typed with separators ("Rp 17.000") must read as 17000, and clearing it must remove it (and its `COMPETITOR_GAP` warning). — Tests in Task 3 and Task 6.

## Rulings

- **Template fees (verified October 2026, shown as estimates):** Offline – QRIS 0% (BI: MDR 0% for micro businesses up to Rp500.000 from 1 Oct 2026), GoFood 20% + Rp1.000 per order, GrabFood 30%, ShopeeFood 20%, Shopee 9% + Rp1.250 per order, Tokopedia 8%, TikTok Shop 8%. PPN on commission is not included; the UI says "perkiraan, cek di dashboard merchant kamu". Template names are brand names (identical in both locales), so they are stored as-is.
- **Number input follow-ups from Phase 2 (parked findings):** `localeNumber` also rejects the comma-grouped "1,000" (ambiguous for English users), accepts "0.125"/"0,125" (a zero integer part is not a thousands group), and accepts a leading "-" so the schemas' "can't be negative" messages show again.
- **Shared form parsing:** the Phase 2 final review parked the five copied `parseX` functions until the sixth CRUD arrives; Task 4 extracts `parseForm` first.
- **Last channel:** a store must keep at least one channel, otherwise products cannot have prices.
- **Channel of an existing composition row** is fixed after creation (like its material); to move a row, delete it and add it again.
- **Checklist:** "Tambah kanal online" is an optional step; the checklist hides once every required step is done.

## File Structure

```
lib/validation/number.ts          localeNumber follow-ups
lib/calc/pricing.ts               ceilTo500, recommendPrice, recommendForChannel
lib/config/channel-templates.ts   CHANNEL_TEMPLATES, findTemplate
lib/validation/channel.ts         channelInputSchema, toChannelColumns
lib/validation/price.ts           + competitorPrice
lib/validation/composition.ts     + channelId
lib/forms.ts                      + FormAction type
lib/forms-server.ts               parseForm (server-only)
lib/nav.ts                        + channels page
lib/dashboard/checklist.ts        + optional "channels" step
app/[locale]/s/[storeId]/kanal/{page,actions,channel-form,template-button}.tsx(.ts)
app/[locale]/s/[storeId]/kanal/[channelId]/page.tsx
app/[locale]/s/[storeId]/produk/[productId]/{page,price-section,price-form,composition-editor}.tsx
tests/unit/{number,calc/pricing,entity-validation,forms-server,nav,checklist}.test.ts
tests/e2e/{channels,pricing,composition,dashboard}.spec.ts
```

---

### Task 1: Number input follow-ups

**Files:**
- Modify: `lib/validation/number.ts`, `docs/superpowers/specs/2026-10-16-untungin-design.md`
- Test: `tests/unit/number.test.ts`, `tests/unit/entity-validation.test.ts`, `tests/unit/store-validation.test.ts`

**Interfaces:**
- Produces: `localeNumber(inner)` with the same signature; new accepted/rejected inputs as below.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/number.test.ts`, inside the `localeNumber` describe block (keep its existing cases except any that assert "-5" is rejected — delete that case, the new behaviour is below), add:

```ts
  it.each([
    ["0.125", 0.125],
    ["0,125", 0.125],
    ["0,5", 0.5],
    ["-5", -5],
    ["-1,5", -1.5],
    ["- 2", -2],
  ])("reads %j as %d", (input, expected) => {
    expect(localeNumber(z.number()).parse(input)).toBe(expected);
  });

  it.each(["1,000", "12,500", "1,000,000", "-1.000", "--5", "1e3", "0x10"])("rejects the ambiguous or invalid %j", (input) => {
    expect(localeNumber(z.number({ error: "nan" })).safeParse(input).error?.issues[0].message).toBe("nan");
  });
```

In `tests/unit/entity-validation.test.ts`, the material case `[{ wastePct: "-1" }, "wastePct", …]` must expect `"material.wasteMin"`. In `tests/unit/store-validation.test.ts`, the case typing a negative target margin ("-5") must expect `"store.marginMin"`. (The Phase 2 fix wave changed both to the generic number message; this restores the specific ones.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/number.test.ts tests/unit/entity-validation.test.ts tests/unit/store-validation.test.ts`
Expected: FAIL — "0.125" and "-5" rejected, "1,000" accepted, min messages not reached.

- [ ] **Step 3: Implement**

Replace `localeNumber` in `lib/validation/number.ts` with:

```ts
/**
 * Parses quantities and percentages: "12,5" or "12.5" → 12.5, "1.000,5" → 1000.5, "0,125" → 0.125,
 * "-5" → -5 (the schema's min() reports negatives); a trailing "%" is ignored. Grouped thousands
 * without a decimal part ("1.000", "1,000") are ambiguous — one thousand or one? — so they become
 * NaN and the field asks the user to write 1000 or 1,5. Anything else unrecognised is NaN too.
 * Blank input becomes undefined so `inner` reports its required-field message.
 */
export function localeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    let s = value.trim().replace(/%$/, "").trim();
    if (s === "") return undefined;
    let sign = 1;
    if (s.startsWith("-")) {
      sign = -1;
      s = s.slice(1).trim();
    }
    const parsed = parseUnsigned(s);
    return Number.isNaN(parsed) ? parsed : sign * parsed;
  }, inner);
}

function parseUnsigned(s: string): number {
  if (/^\d+$/.test(s)) return Number(s);
  // A zero integer part can't be a thousands group: "0.125" and "0,125" are decimals.
  if (/^0[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number.NaN;
  if (/^\d+[.,]\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number.NaN;
}
```

- [ ] **Step 4: Update the spec**

In the spec's §4 "Number input:" paragraph and §5.4 formatting bullet, replace the description of quantity parsing with: quantities and percentages accept digits with at most one decimal separator ("," or "."), Indonesian grouping with a decimal comma ("1.000,5"), a leading "0" decimal ("0,125") and a leading "-" (rejected by each field's minimum); grouped thousands without a decimal part ("1.000", "1,000") are rejected as ambiguous — write 1000, or 1,5 for a decimal.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/validation/number.ts tests/unit docs/superpowers/specs/2026-10-16-untungin-design.md
git commit -m "fix(validation): accept 0,125 and negatives, reject comma-grouped thousands in quantities"
```

---

### Task 2: Price recommendation (`lib/calc/pricing.ts`)

**Files:**
- Create: `lib/calc/pricing.ts`
- Modify: `lib/calc/index.ts` (export it)
- Test: `tests/unit/calc/pricing.test.ts`

**Interfaces:**
- Consumes: `materialCostPerUnit`, `mapById` (products.ts), `StoreMetrics` (metrics.ts), `StoreData`; the Phase 2 fixture `tests/unit/calc/fixture.ts` (store target 40%; channels `offline` 0% + 0, `online` 20% + Rp1.000; product `eskopi`; overhead 4.125; materialCost offline 5.500, online 5.700).
- Produces:
  ```ts
  export type Recommendation =
    | { kind: "price"; price: number; includesOperatingCosts: boolean }
    | { kind: "impossible" };
  export function ceilTo500(value: number): number;
  export function recommendPrice(input: { cost: number; includesOperatingCosts: boolean; fixedFee: number; commissionPct: number; targetMarginPct: number }): Recommendation;
  export function recommendForChannel(data: StoreData, metrics: Pick<StoreMetrics, "overheadPerUnit">, productId: string, channelId: string): Recommendation | null; // null: unknown product/channel; throws CalcError like materialCostPerUnit
  ```

- [ ] **Step 1: Write the failing tests**

`tests/unit/calc/pricing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ceilTo500, computeMetrics, recommendForChannel, recommendPrice } from "@/lib/calc";
import { fixture } from "./fixture";

describe("ceilTo500", () => {
  it.each([
    [0, 0],
    [1, 500],
    [500, 500],
    [16041.67, 16500],
    [1000.0000000001, 1000],
    [27062.5, 27500],
  ])("%d → %d", (value, expected) => {
    expect(ceilTo500(value)).toBe(expected);
  });
});

describe("recommendPrice", () => {
  it("covers cost, fee, commission and margin, rounded up to Rp500", () => {
    // (9.825 + 1.000) / (1 − 0,2 − 0,4) = 27.062,5 → 27.500
    expect(recommendPrice({ cost: 9825, includesOperatingCosts: true, fixedFee: 1000, commissionPct: 20, targetMarginPct: 40 })).toEqual({
      kind: "price",
      price: 27500,
      includesOperatingCosts: true,
    });
  });

  it("is impossible when commission + margin reach 100%", () => {
    expect(recommendPrice({ cost: 1000, includesOperatingCosts: true, fixedFee: 0, commissionPct: 60, targetMarginPct: 40 })).toEqual({ kind: "impossible" });
    expect(recommendPrice({ cost: 1000, includesOperatingCosts: true, fixedFee: 0, commissionPct: 70, targetMarginPct: 40 })).toEqual({ kind: "impossible" });
  });
});

describe("recommendForChannel — the coffee-shop fixture", () => {
  const data = fixture();
  const metrics = computeMetrics(data);

  it("uses full cost (with overhead) per channel", () => {
    // offline: 9.625 / 0,6 = 16.041,67 → 16.500
    expect(recommendForChannel(data, metrics, "eskopi", "offline")).toEqual({ kind: "price", price: 16500, includesOperatingCosts: true });
    // online: (9.825 + 1.000) / 0,4 → 27.500
    expect(recommendForChannel(data, metrics, "eskopi", "online")).toEqual({ kind: "price", price: 27500, includesOperatingCosts: true });
  });

  it("uses the product's own target margin", () => {
    const own = fixture();
    own.products[0] = { ...own.products[0], targetMarginPct: 20 };
    // (9.825 + 1.000) / (1 − 0,2 − 0,2) = 18.041,67 → 18.500
    expect(recommendForChannel(own, computeMetrics(own), "eskopi", "online")).toMatchObject({ price: 18500 });
  });

  it("falls back to material cost without sales estimates, and says so", () => {
    const noSales = fixture();
    noSales.prices = noSales.prices.map((p) => ({ ...p, estMonthlySales: 0 }));
    // (5.700 + 1.000) / 0,4 = 16.750 → 17.000
    expect(recommendForChannel(noSales, computeMetrics(noSales), "eskopi", "online")).toEqual({
      kind: "price",
      price: 17000,
      includesOperatingCosts: false,
    });
  });

  it("works for a channel without a price yet", () => {
    const extra = fixture();
    extra.channels.push({ id: "qris", name: "Offline – QRIS", commissionPct: 0, fixedFee: 0 });
    expect(recommendForChannel(extra, computeMetrics(extra), "eskopi", "qris")).toMatchObject({ kind: "price", price: 16500 });
  });

  it("returns null for an unknown product or channel", () => {
    expect(recommendForChannel(data, metrics, "nope", "offline")).toBeNull();
    expect(recommendForChannel(data, metrics, "eskopi", "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/calc/pricing.test.ts`
Expected: FAIL — `ceilTo500` not exported.

- [ ] **Step 3: Implement**

`lib/calc/pricing.ts`:

```ts
import type { StoreMetrics } from "./metrics";
import { mapById, materialCostPerUnit } from "./products";
import type { StoreData } from "./types";

export type Recommendation =
  | { kind: "price"; price: number; includesOperatingCosts: boolean }
  | { kind: "impossible" };

/** Rounds up to the next Rp500, ignoring floating-point noise just above a multiple. */
export function ceilTo500(value: number): number {
  return (Math.ceil(value / 500 - 1e-9) || 0) * 500;
}

/**
 * Spec §4.2 item 9: price = ceilTo500((cost + fixedFee) / (1 − commission − margin)), where margin is
 * profit as a share of the selling price. When commission + margin reach 100% no price works.
 */
export function recommendPrice(input: {
  cost: number;
  includesOperatingCosts: boolean;
  fixedFee: number;
  commissionPct: number;
  targetMarginPct: number;
}): Recommendation {
  const share = 1 - input.commissionPct / 100 - input.targetMarginPct / 100;
  if (share <= 0) return { kind: "impossible" };
  return {
    kind: "price",
    price: ceilTo500((input.cost + input.fixedFee) / share),
    includesOperatingCosts: input.includesOperatingCosts,
  };
}

/** Recommendation for one product in one channel, using the store's current overhead per unit. */
export function recommendForChannel(
  data: StoreData,
  metrics: Pick<StoreMetrics, "overheadPerUnit">,
  productId: string,
  channelId: string,
): Recommendation | null {
  const product = data.products.find((candidate) => candidate.id === productId);
  const channel = data.channels.find((candidate) => candidate.id === channelId);
  if (!product || !channel) return null;
  const materialCost = materialCostPerUnit(product, data.composition, mapById(data.materials), channel.id);
  const overhead = metrics.overheadPerUnit;
  return recommendPrice({
    cost: overhead === null ? materialCost : materialCost + overhead,
    includesOperatingCosts: overhead !== null,
    fixedFee: channel.fixedFee,
    commissionPct: channel.commissionPct,
    targetMarginPct: product.targetMarginPct ?? data.store.targetMarginPct,
  });
}
```

In `lib/calc/index.ts` add `export * from "./pricing";` next to the other re-exports.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/calc && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc tests/unit/calc/pricing.test.ts
git commit -m "feat(calc): price recommendation per channel, rounded up to Rp500"
```

---

### Task 3: Channel and competitor-price validation, channel templates

**Files:**
- Create: `lib/validation/channel.ts`, `lib/config/channel-templates.ts`
- Modify: `lib/validation/price.ts`, `messages/id.json`, `messages/en.json` (`Validation.channel`, two `Validation.price` keys), `tests/unit/messages.test.ts` (include `CHANNEL_VALIDATION_KEYS`)
- Test: `tests/unit/entity-validation.test.ts`, `tests/unit/channel-templates.test.ts`

**Interfaces:**
- Produces:
  - `channelInputSchema` → `{ name: string; commissionPct: number; fixedFee: number }` (blank commission/fee → 0); `toChannelColumns(input)` → `{ name, commission_pct, fixed_fee }`; `CHANNEL_DUPLICATE_KEY = "channel.duplicate"`; `CHANNEL_VALIDATION_KEYS`.
  - `priceInputSchema` gains `competitorPrice: number | null` (blank or absent → null); `toPriceColumns(input)` → `{ price, est_monthly_sales, competitor_price }`; `PRICE_VALIDATION_KEYS` gains `"price.competitorNumber"`, `"price.competitorMin"`.
  - `CHANNEL_TEMPLATES: readonly ChannelTemplate[]` with `type ChannelTemplate = { key: string; name: string; commissionPct: number; fixedFee: number }`; `findTemplate(key: string): ChannelTemplate | undefined`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/entity-validation.test.ts` (add the imports `channelInputSchema`, `toChannelColumns` from `@/lib/validation/channel` and `toPriceColumns` from `@/lib/validation/price`):

```ts
describe("channelInputSchema", () => {
  it("parses a channel; blank commission and fee mean 0", () => {
    const parsed = channelInputSchema.parse({ name: " GoFood ", commissionPct: "20", fixedFee: "1.000" });
    expect(parsed).toEqual({ name: "GoFood", commissionPct: 20, fixedFee: 1000 });
    expect(toChannelColumns(parsed)).toEqual({ name: "GoFood", commission_pct: 20, fixed_fee: 1000 });
    expect(channelInputSchema.parse({ name: "Titip toko", commissionPct: "", fixedFee: "" })).toMatchObject({ commissionPct: 0, fixedFee: 0 });
  });

  it.each([
    [{ name: "" }, "name", "channel.nameRequired"],
    [{ name: "x".repeat(61) }, "name", "channel.nameTooLong"],
    [{ commissionPct: "100" }, "commissionPct", "channel.commissionMax"],
    [{ commissionPct: "-1" }, "commissionPct", "channel.commissionMin"],
    [{ commissionPct: "dua puluh" }, "commissionPct", "channel.commissionNumber"],
    [{ fixedFee: "1,5" }, "fixedFee", "channel.feeNumber"],
  ])("%j → %s: %s", (patch, field, key) => {
    expect(errorsFor(channelInputSchema, { name: "GoFood", commissionPct: "20", fixedFee: "0", ...patch })[field]).toBe(key);
  });
});

describe("priceInputSchema competitor price", () => {
  it.each([
    [{ price: "18.000", estMonthlySales: "100", competitorPrice: "Rp 17.000" }, 17000],
    [{ price: "18.000", estMonthlySales: "100", competitorPrice: "" }, null],
    [{ price: "18.000", estMonthlySales: "100" }, null],
  ])("reads %j", (input, expected) => {
    const parsed = priceInputSchema.parse(input);
    expect(parsed.competitorPrice).toBe(expected);
    expect(toPriceColumns(parsed).competitor_price).toBe(expected);
  });

  it("rejects a competitor price with decimals", () => {
    expect(errorsFor(priceInputSchema, { price: "1000", estMonthlySales: "1", competitorPrice: "17.5" }).competitorPrice).toBe(
      "price.competitorNumber",
    );
  });
});
```

The existing `priceInputSchema` "parses …" cases that use `toEqual({ price, estMonthlySales })` must now include `competitorPrice: null` in the expected object — update them.

`tests/unit/channel-templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHANNEL_TEMPLATES, findTemplate } from "@/lib/config/channel-templates";
import { channelInputSchema } from "@/lib/validation/channel";

describe("channel templates", () => {
  it("lists the spec's templates with unique keys and names", () => {
    expect(CHANNEL_TEMPLATES.map((t) => t.name)).toEqual([
      "Offline – QRIS",
      "GoFood",
      "GrabFood",
      "ShopeeFood",
      "Shopee",
      "Tokopedia",
      "TikTok Shop",
    ]);
    expect(new Set(CHANNEL_TEMPLATES.map((t) => t.key)).size).toBe(CHANNEL_TEMPLATES.length);
  });

  it("every template passes channel validation", () => {
    for (const template of CHANNEL_TEMPLATES) {
      expect(
        channelInputSchema.safeParse({
          name: template.name,
          commissionPct: String(template.commissionPct),
          fixedFee: String(template.fixedFee),
        }).success,
        template.key,
      ).toBe(true);
    }
  });

  it("finds a template by key", () => {
    expect(findTemplate("gofood")).toMatchObject({ name: "GoFood", commissionPct: 20, fixedFee: 1000 });
    expect(findTemplate("nope")).toBeUndefined();
  });
});
```

In `tests/unit/messages.test.ts`, add `import("@/lib/validation/channel").then((m) => m.CHANNEL_VALIDATION_KEYS),` to the list of key arrays.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/entity-validation.test.ts tests/unit/channel-templates.test.ts tests/unit/messages.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/validation/channel.ts`:

```ts
import { z } from "zod";
import { blankAs, MAX_AMOUNT, requiredName } from "./common";
import { localeNumber, wholeNumber } from "./number";

export const CHANNEL_DUPLICATE_KEY = "channel.duplicate";

export const CHANNEL_VALIDATION_KEYS = [
  "channel.nameRequired",
  "channel.nameTooLong",
  "channel.commissionNumber",
  "channel.commissionMin",
  "channel.commissionMax",
  "channel.feeNumber",
  "channel.feeMin",
  CHANNEL_DUPLICATE_KEY,
] as const;

export const channelInputSchema = z.object({
  name: requiredName("channel", 60),
  commissionPct: blankAs(
    "0",
    localeNumber(z.number({ error: "channel.commissionNumber" }).min(0, "channel.commissionMin").lt(100, "channel.commissionMax")),
  ),
  fixedFee: blankAs(
    "0",
    wholeNumber(
      z.number({ error: "channel.feeNumber" }).int("channel.feeNumber").min(0, "channel.feeMin").max(MAX_AMOUNT, "common.amountTooLarge"),
    ),
  ),
});

export type ChannelInput = z.infer<typeof channelInputSchema>;

export function toChannelColumns(input: ChannelInput) {
  return { name: input.name, commission_pct: input.commissionPct, fixed_fee: input.fixedFee };
}
```

In `lib/validation/price.ts`: add `"price.competitorNumber", "price.competitorMin"` to `PRICE_VALIDATION_KEYS`; add to the schema

```ts
  competitorPrice: blankAs(
    null,
    wholeNumber(
      z
        .number({ error: "price.competitorNumber" })
        .int("price.competitorNumber")
        .min(0, "price.competitorMin")
        .max(MAX_AMOUNT, "common.amountTooLarge"),
    ).nullable(),
  ),
```

and make `toPriceColumns` return `{ price: input.price, est_monthly_sales: input.estMonthlySales, competitor_price: input.competitorPrice }`.

`lib/config/channel-templates.ts`:

```ts
export type ChannelTemplate = { key: string; name: string; commissionPct: number; fixedFee: number };

/**
 * Typical seller fees, verified October 2026 (spec §3.4). The UI marks them as estimates: fees vary by
 * category, promotions and PPN, so sellers should check their merchant dashboard. Names are brand
 * names, identical in every locale, so they are stored as-is when a template is added.
 */
export const CHANNEL_TEMPLATES: readonly ChannelTemplate[] = [
  // BI: QRIS MDR is 0% for micro businesses up to Rp500.000 per transaction from 1 Oct 2026.
  { key: "qris", name: "Offline – QRIS", commissionPct: 0, fixedFee: 0 },
  { key: "gofood", name: "GoFood", commissionPct: 20, fixedFee: 1000 },
  { key: "grabfood", name: "GrabFood", commissionPct: 30, fixedFee: 0 },
  { key: "shopeefood", name: "ShopeeFood", commissionPct: 20, fixedFee: 0 },
  { key: "shopee", name: "Shopee", commissionPct: 9, fixedFee: 1250 },
  { key: "tokopedia", name: "Tokopedia", commissionPct: 8, fixedFee: 0 },
  { key: "tiktokshop", name: "TikTok Shop", commissionPct: 8, fixedFee: 0 },
];

export function findTemplate(key: string): ChannelTemplate | undefined {
  return CHANNEL_TEMPLATES.find((template) => template.key === key);
}
```

- [ ] **Step 4: Add the messages**

Inside `"Validation"` in `messages/id.json`:

```json
    "channel": {
      "nameRequired": "Nama kanal wajib diisi",
      "nameTooLong": "Nama kanal maksimal 60 karakter",
      "commissionNumber": "Isi komisi dengan angka, contoh 20",
      "commissionMin": "Komisi tidak boleh negatif",
      "commissionMax": "Komisi harus kurang dari 100%",
      "feeNumber": "Isi biaya per pesanan dengan angka bulat, contoh 1.000",
      "feeMin": "Biaya tidak boleh negatif",
      "duplicate": "Kanal dengan nama ini sudah ada"
    },
```

and inside `Validation.price` add `"competitorNumber": "Isi harga pesaing dengan angka bulat, contoh 15.000"` and `"competitorMin": "Harga pesaing tidak boleh negatif"`.

`messages/en.json`:

```json
    "channel": {
      "nameRequired": "Channel name is required",
      "nameTooLong": "Channel name can be at most 60 characters",
      "commissionNumber": "Enter the commission as a number, e.g. 20",
      "commissionMin": "Commission can't be negative",
      "commissionMax": "Commission must be less than 100%",
      "feeNumber": "Enter the fee per order as a whole number, e.g. 1,000",
      "feeMin": "The fee can't be negative",
      "duplicate": "A channel with this name already exists"
    },
```

and in `Validation.price`: `"competitorNumber": "Enter the competitor price as a whole number, e.g. 15,000"`, `"competitorMin": "The competitor price can't be negative"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/validation lib/config tests/unit messages
git commit -m "feat(validation): channel and competitor-price schemas; channel templates"
```

---

### Task 4: Shared form parsing helper

**Files:**
- Create: `lib/forms-server.ts`
- Modify: `lib/forms.ts` (add `FormAction`); the Server Actions in `app/[locale]/s/[storeId]/{bahan,biaya,inventaris,produk}/actions.ts` (replace `parseMaterial`, `parseExpense`, `parseAsset`, `parseProduct`, `parseRow` and the inline parsing in `savePriceAction`); the client forms that declare a local `type Action` (`bahan/material-form.tsx`, `biaya/expense-form.tsx`, `inventaris/asset-form.tsx`, `produk/product-form.tsx`, `produk/[productId]/composition-editor.tsx`, `produk/[productId]/price-form.tsx`, `components/forms/delete-button.tsx`)
- Test: `tests/unit/forms-server.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // lib/forms.ts
  export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;
  // lib/forms-server.ts (server-only)
  export type ParsedForm<T> =
    | { values: Record<string, string>; input: T; error: undefined }
    | { values: Record<string, string>; input: undefined; error: NonNullable<FormState> };
  export async function parseForm<S extends z.ZodType>(schema: S, formData: FormData, fields: readonly string[]): Promise<ParsedForm<z.output<S>>>;
  ```
  Behaviour is identical to the helpers it replaces: raw `values` of the named fields; on failure `{ fieldErrors (translated), values }`.

- [ ] **Step 1: Write the failing test**

`tests/unit/forms-server.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/i18n/server", () => ({ getValidationTranslator: async () => (key: string) => `t:${key}` }));

import { parseForm } from "@/lib/forms-server";

const schema = z.object({ name: z.string().min(1, "x.nameRequired"), qty: z.coerce.number({ error: "x.qtyNumber" }) });

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("parseForm", () => {
  it("returns the parsed input and the raw values of the named fields only", async () => {
    const result = await parseForm(schema, form({ name: "Gula", qty: "2", other: "ignored" }), ["name", "qty"]);
    expect(result).toEqual({ values: { name: "Gula", qty: "2" }, input: { name: "Gula", qty: 2 }, error: undefined });
  });

  it("returns translated field errors with the values echoed", async () => {
    const result = await parseForm(schema, form({ name: "", qty: "2" }), ["name", "qty"]);
    expect(result.input).toBeUndefined();
    expect(result.error).toEqual({ fieldErrors: { name: ["t:x.nameRequired"] }, values: { name: "", qty: "2" } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/forms-server.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Append to `lib/forms.ts`:

```ts
/** A Server Action used with useActionState. */
export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;
```

`lib/forms-server.ts`:

```ts
import "server-only";
import { z } from "zod";
import { getValidationTranslator } from "@/lib/i18n/server";
import { translateFieldErrors } from "@/lib/i18n/translate";
import { rawValues, type FormState } from "./forms";

export type ParsedForm<T> =
  | { values: Record<string, string>; input: T; error: undefined }
  | { values: Record<string, string>; input: undefined; error: NonNullable<FormState> };

/** Reads the named fields and validates them; on failure returns translated field errors with the raw values echoed. */
export async function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
  fields: readonly string[],
): Promise<ParsedForm<z.output<S>>> {
  const values = rawValues(formData, fields);
  const parsed = schema.safeParse(values);
  if (parsed.success) return { values, input: parsed.data, error: undefined };
  const t = await getValidationTranslator();
  const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
  return { values, input: undefined, error: { fieldErrors: translateFieldErrors(fieldErrors, t), values } };
}
```

- [ ] **Step 4: Use it everywhere**

In each actions file, delete the local `parseX` function and replace its calls `await parseX(formData)` with `await parseForm(<schema>, formData, <FIELDS constant>)` — e.g. `await parseForm(materialInputSchema, formData, FIELDS)`, `await parseForm(compositionInputSchema, formData, ROW_FIELDS)`. In `savePriceAction`, replace the inline `rawValues` + `safeParse` + translation block with `const parsed = await parseForm(priceInputSchema, formData, PRICE_FIELDS); if (parsed.error) return parsed.error;` and use `parsed.values` / `parsed.input` below (the uuid check keeps returning `values: parsed.values`). Remove imports that become unused (`z`, `rawValues`, `getValidationTranslator`, `translateFieldErrors`) only where nothing else uses them — `rowErrors` and the material unit guard still use `getValidationTranslator`.

In each listed client file, delete the local `type Action = …` and import `type FormAction` from `@/lib/forms`, renaming uses of `Action` to `FormAction`.

- [ ] **Step 5: Run everything**

Run: `npm test && npx tsc --noEmit && npx eslint .`, then the full e2e suite against a production build.
Expected: all PASS (behaviour is unchanged).

- [ ] **Step 6: Commit**

```bash
git add lib/forms.ts lib/forms-server.ts "app/[locale]/s/[storeId]" components/forms/delete-button.tsx tests/unit/forms-server.test.ts
git commit -m "refactor(forms): shared parseForm helper and FormAction type"
```

---

### Task 5: Channels page (`kanal`)

**Files:**
- Create: `app/[locale]/s/[storeId]/kanal/page.tsx`, `kanal/actions.ts`, `kanal/channel-form.tsx`, `kanal/template-button.tsx`, `kanal/[channelId]/page.tsx`
- Modify: `lib/nav.ts`, `messages/id.json`, `messages/en.json` (add `Channels`; `StoreShell.nav.channels`, `StoreShell.moreDescriptions.channels`), `tests/unit/nav.test.ts`, `tests/e2e/store-shell.spec.ts`, `tests/e2e/helpers.ts` (add `addChannel`, `addTemplateChannel`, `priceSection`)
- Test: `tests/e2e/channels.spec.ts`

**Interfaces:**
- Consumes: Task 3 (`channelInputSchema`, `toChannelColumns`, `CHANNEL_DUPLICATE_KEY`, `CHANNEL_TEMPLATES`, `findTemplate`), Task 4 (`parseForm`, `FormAction`), Phase 2 (`loadStoreData`, `revalidateStore`, `DeleteButton`, `FormMessage`, `useRemountKey`, `SubmitButton`, `FieldError`, `formatPercent`, `formatRupiah`).
- Produces:
  - Server Actions `createChannelAction(storeId, prev, formData)`, `addTemplateChannelAction(storeId, templateKey)`, `updateChannelAction(storeId, channelId, prev, formData)`, `deleteChannelAction(storeId, channelId)` — fields `name`, `commissionPct`, `fixedFee`. Duplicate names (trim, case-insensitive) are refused; new channels get `sort_order = max + 1`; deleting the last channel is refused; delete redirects to `/s/{storeId}/kanal`.
  - Nav: `NavLabelKey` gains `"channels"` (path `kanal`, icon `Store`); sidebar order dashboard, products, materials, channels, expenses, assets, settings; "Lainnya" lists channels, expenses, assets, settings.
  - e2e helpers: `addChannel(page, c: { name: string; commissionPct: string; fixedFee?: string })` (form `#add-channel`, waits for "Kanal ditambahkan." and the name field to clear); `addTemplateChannel(page, name: string)` (clicks the template button whose name starts with `name`, waits for the channel link); `priceSection(page, channelName: string)` → the `<section>` on a product page whose heading is that channel name.

- [ ] **Step 1: Write the failing tests**

Update `tests/unit/nav.test.ts`: the sidebar list becomes `dashboard /produk /bahan /kanal /biaya /inventaris /pengaturan` (labelKeys `dashboard, products, materials, channels, expenses, assets, settings`); `moreNavItems` becomes `channels /kanal, expenses /biaya, assets /inventaris, settings /pengaturan`; add `["/s/abc/kanal/123", true]` to the `isMoreActive` table. In `tests/e2e/store-shell.spec.ts`, add `"Kanal"` to the names the "Lainnya lists …" test expects.

Append to `tests/e2e/helpers.ts`:

```ts
export async function addChannel(page: Page, c: { name: string; commissionPct: string; fixedFee?: string }) {
  const form = page.locator("#add-channel");
  await form.getByLabel("Nama kanal").fill(c.name);
  await form.getByLabel("Komisi (%)").fill(c.commissionPct);
  if (c.fixedFee) await form.getByLabel("Biaya per pesanan (Rp)").fill(c.fixedFee);
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(page.getByText("Kanal ditambahkan.")).toBeVisible();
  await expect(form.getByLabel("Nama kanal")).toHaveValue("");
}

export async function addTemplateChannel(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(`^${name} ·`) }).click();
  await expect(page.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
}

/** The price block of one channel on a product page. */
export function priceSection(page: Page, channelName: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: channelName, exact: true }) });
}
```

`tests/e2e/channels.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { addChannel, addProduct, addTemplateChannel, createStoreViaOnboarding, priceSection, signIn, storeUrl } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await createStoreViaOnboarding(page, "Toko Kanal");
  await page.goto(storeUrl(page, "kanal"));
});

test("lists the default channel and adds one from a template", async ({ page }) => {
  await expect(page.getByRole("link", { name: /Offline – Tunai/ })).toContainText("Tanpa potongan");
  await expect(page.getByText(/Perkiraan Oktober 2026/)).toBeVisible();
  await addTemplateChannel(page, "GoFood");
  await expect(page.getByRole("link", { name: /GoFood/ })).toContainText("Komisi 20% + Rp1.000/pesanan");
  await expect(page.getByRole("button", { name: /^GoFood ·/ })).toHaveCount(0);
});

test("refuses a duplicate channel name", async ({ page }) => {
  await addTemplateChannel(page, "GoFood");
  const form = page.locator("#add-channel");
  await form.getByLabel("Nama kanal").fill(" gofood ");
  await form.getByLabel("Komisi (%)").fill("15");
  await form.getByRole("button", { name: "Tambah" }).click();
  await expect(form.getByText("Kanal dengan nama ini sudah ada")).toBeVisible();
  await expect(page.getByRole("link", { name: /GoFood/i })).toHaveCount(1);
});

test("adds a custom channel and edits it", async ({ page }) => {
  await addChannel(page, { name: "Titip warung", commissionPct: "10", fixedFee: "500" });
  await page.getByRole("link", { name: /Titip warung/ }).click();
  await expect(page.getByRole("heading", { name: "Ubah kanal" })).toBeVisible();
  await page.getByLabel("Komisi (%)").fill("12,5");
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByText("Tersimpan.")).toBeVisible();
  await page.goto(storeUrl(page, "kanal"));
  await expect(page.getByRole("link", { name: /Titip warung/ })).toContainText("Komisi 12,5% + Rp500/pesanan");
});

test("the last channel can't be deleted", async ({ page }) => {
  await page.getByRole("link", { name: /Offline – Tunai/ }).click();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await expect(page.getByText("Kanal terakhir tidak bisa dihapus. Tambahkan kanal lain dulu.")).toBeVisible();
});

test("deleting a channel removes its prices from products", async ({ page }) => {
  await addTemplateChannel(page, "GoFood");
  await page.goto(storeUrl(page, "produk"));
  await addProduct(page, { name: "Es teh", yieldQty: "10" });
  const productUrl = page.url();
  await expect(priceSection(page, "GoFood")).toBeVisible();

  await page.goto(storeUrl(page, "kanal"));
  await page.getByRole("link", { name: /GoFood/ }).click();
  await expect(page.getByText(/juga menghapus harga produk/)).toBeVisible();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await page.getByRole("button", { name: "Hapus kanal" }).click();
  await expect(page).toHaveURL(/\/kanal$/);
  await page.goto(productUrl);
  await expect(priceSection(page, "GoFood")).toHaveCount(0);
  await expect(priceSection(page, "Offline – Tunai")).toBeVisible();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/nav.test.ts` (FAIL) and, against a production build, `npx playwright test tests/e2e/channels.spec.ts` (FAIL — 404).

- [ ] **Step 3: Navigation**

In `lib/nav.ts`: import `Store` from `lucide-react`; add `"channels"` to `NavLabelKey`; add `channels: { path: "kanal", icon: Store }` to `PAGES`; set `MORE_KEYS = ["channels", "expenses", "assets", "settings"] as const`; set the sidebar keys in `storeNavItems` to `["dashboard", "products", "materials", "channels", "expenses", "assets", "settings"]`. Messages: `StoreShell.nav.channels` = "Kanal" / "Channels"; `StoreShell.moreDescriptions.channels` = "GoFood, Shopee, QRIS, dan tempat jualan lain" / "GoFood, Shopee, QRIS and other places you sell".

- [ ] **Step 4: Add the messages**

`messages/id.json`:

```json
  "Channels": {
    "title": "Kanal penjualan",
    "intro": "Tempat kamu berjualan: offline, ojek online, atau marketplace. Komisi dan biaya per pesanan dipakai untuk menghitung uang yang benar-benar kamu terima.",
    "addTitle": "Tambah kanal sendiri",
    "editTitle": "Ubah kanal",
    "name": "Nama kanal",
    "namePlaceholder": "Contoh: Titip di warung",
    "commissionPct": "Komisi (%)",
    "fixedFee": "Biaya per pesanan (Rp)",
    "feeHint": "Potongan tetap per pesanan, misalnya biaya layanan. Isi 0 jika tidak ada.",
    "feeNone": "Tanpa potongan",
    "feePct": "Komisi {pct}",
    "feeFixed": "{fee}/pesanan",
    "feeBoth": "Komisi {pct} + {fee}/pesanan",
    "templatesTitle": "Tambah dari daftar",
    "templatesHint": "Perkiraan Oktober 2026, belum termasuk PPN. Cek angka pastinya di dashboard merchant kamu, lalu ubah jika perlu.",
    "created": "Kanal ditambahkan.",
    "templateExists": "{name} sudah ada di kanalmu.",
    "delete": "Hapus kanal",
    "deleteWarning": "Menghapus kanal juga menghapus harga produk dan kemasan khusus di kanal ini.",
    "lastChannel": "Kanal terakhir tidak bisa dihapus. Tambahkan kanal lain dulu."
  },
```

`messages/en.json`:

```json
  "Channels": {
    "title": "Sales channels",
    "intro": "Where you sell: offline, food delivery apps or marketplaces. Commission and per-order fees are used to calculate what you actually receive.",
    "addTitle": "Add your own channel",
    "editTitle": "Edit channel",
    "name": "Channel name",
    "namePlaceholder": "E.g. Consignment at a shop",
    "commissionPct": "Commission (%)",
    "fixedFee": "Fee per order (Rp)",
    "feeHint": "A fixed deduction per order, such as a service fee. Enter 0 if none.",
    "feeNone": "No fees",
    "feePct": "Commission {pct}",
    "feeFixed": "{fee}/order",
    "feeBoth": "Commission {pct} + {fee}/order",
    "templatesTitle": "Add from the list",
    "templatesHint": "Estimates as of October 2026, excluding VAT. Check the exact numbers in your merchant dashboard and edit them if needed.",
    "created": "Channel added.",
    "templateExists": "{name} is already one of your channels.",
    "delete": "Delete channel",
    "deleteWarning": "Deleting a channel also deletes product prices and packaging used only in this channel.",
    "lastChannel": "The last channel can't be deleted. Add another channel first."
  },
```

- [ ] **Step 5: Implement the actions**

`app/[locale]/s/[storeId]/kanal/actions.ts`:

```ts
"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { findTemplate } from "@/lib/config/channel-templates";
import { revalidateStore } from "@/lib/data/revalidate";
import type { FormState } from "@/lib/forms";
import { parseForm } from "@/lib/forms-server";
import { getValidationTranslator } from "@/lib/i18n/server";
import { isUuid } from "@/lib/uuid";
import { CHANNEL_DUPLICATE_KEY, channelInputSchema, toChannelColumns } from "@/lib/validation/channel";

const FIELDS = ["name", "commissionPct", "fixedFee"] as const;

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function storeChannels(supabase: Supabase, storeId: string) {
  const { data, error } = await supabase.from("sales_channels").select("id, name, sort_order").eq("store_id", storeId);
  if (error) throw error;
  return data;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function createChannelAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(channelInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const channels = await storeChannels(supabase, storeId);
  if (channels.some((channel) => sameName(channel.name, parsed.input.name))) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { name: [tValidation(CHANNEL_DUPLICATE_KEY)] }, values: parsed.values };
  }
  const sortOrder = Math.max(0, ...channels.map((channel) => channel.sort_order)) + 1;
  const { error } = await supabase
    .from("sales_channels")
    .insert({ store_id: storeId, sort_order: sortOrder, ...toChannelColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Channels"))("created") };
}

export async function addTemplateChannelAction(storeId: string, templateKey: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const template = findTemplate(templateKey);
  if (!isUuid(storeId) || !template) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const channels = await storeChannels(supabase, storeId);
  if (channels.some((channel) => sameName(channel.name, template.name))) {
    return { message: (await getTranslations("Channels"))("templateExists", { name: template.name }) };
  }
  const sortOrder = Math.max(0, ...channels.map((channel) => channel.sort_order)) + 1;
  const { error } = await supabase.from("sales_channels").insert({
    store_id: storeId,
    sort_order: sortOrder,
    name: template.name,
    commission_pct: template.commissionPct,
    fixed_fee: template.fixedFee,
  });
  if (error) return { message: tCommon("saveFailed") };

  revalidateStore();
  return { ok: true };
}

export async function updateChannelAction(
  storeId: string,
  channelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(channelInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(channelId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const channels = await storeChannels(supabase, storeId);
  if (channels.some((channel) => channel.id !== channelId && sameName(channel.name, parsed.input.name))) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { name: [tValidation(CHANNEL_DUPLICATE_KEY)] }, values: parsed.values };
  }
  const { data, error } = await supabase
    .from("sales_channels")
    .update(toChannelColumns(parsed.input))
    .eq("id", channelId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteChannelAction(storeId: string, channelId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(channelId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  // Products need at least one channel to have a price.
  if ((await storeChannels(supabase, storeId)).length <= 1) {
    return { message: (await getTranslations("Channels"))("lastChannel") };
  }
  // Prices and channel-only composition rows cascade with the channel.
  const { data, error } = await supabase
    .from("sales_channels")
    .delete()
    .eq("id", channelId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/kanal`, locale: await getLocale() });
}
```

- [ ] **Step 6: Implement the form, template button and pages**

`app/[locale]/s/[storeId]/kanal/channel-form.tsx`:

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
import type { FormAction } from "@/lib/forms";

export type ChannelFormDefaults = Partial<Record<"name" | "commissionPct" | "fixedFee", string>>;

type Props = { action: FormAction; defaults?: ChannelFormDefaults; submitLabel: string; pendingLabel: string; id?: string };

export function ChannelForm({ action, defaults = {}, submitLabel, pendingLabel, id }: Props) {
  const t = useTranslations("Channels");
  const [state, formAction] = useActionState(action, undefined);
  const key = useRemountKey(state);
  const current = state?.values ?? defaults;
  const errors = state?.fieldErrors ?? {};
  const field = (name: string) => `${id ?? "channel"}-${name}`;

  return (
    <form id={id} action={formAction} className="space-y-4">
      <fieldset key={key} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor={field("name")}>{t("name")}</Label>
          <Input id={field("name")} name="name" defaultValue={current.name} placeholder={t("namePlaceholder")} maxLength={60} />
          <FieldError errors={errors.name} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={field("commission")}>{t("commissionPct")}</Label>
            <Input id={field("commission")} name="commissionPct" inputMode="decimal" defaultValue={current.commissionPct ?? "0"} />
            <FieldError errors={errors.commissionPct} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={field("fee")}>{t("fixedFee")}</Label>
            <Input id={field("fee")} name="fixedFee" inputMode="numeric" defaultValue={current.fixedFee ?? "0"} />
            <FieldError errors={errors.fixedFee} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("feeHint")}</p>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
```

`app/[locale]/s/[storeId]/kanal/template-button.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormAction } from "@/lib/forms";

/** One-click "add this template" form; success re-renders the page without the button. */
export function TemplateButton({ action, label }: { action: FormAction; label: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-1">
      <SubmitButton variant="outline" className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" pendingText={label}>
        {label}
      </SubmitButton>
      {state && !state.ok && <FormMessage state={state} />}
    </form>
  );
}
```

`app/[locale]/s/[storeId]/kanal/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { CalcChannel } from "@/lib/calc";
import { CHANNEL_TEMPLATES } from "@/lib/config/channel-templates";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatPercent, formatRupiah } from "@/lib/format";
import { addTemplateChannelAction, createChannelAction } from "./actions";
import { ChannelForm } from "./channel-form";
import { TemplateButton } from "./template-button";

export default async function ChannelsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Channels");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();

  const fees = (channel: Pick<CalcChannel, "commissionPct" | "fixedFee">) => {
    const pct = formatPercent(channel.commissionPct, locale);
    const fee = formatRupiah(channel.fixedFee, locale);
    if (channel.commissionPct > 0 && channel.fixedFee > 0) return t("feeBoth", { pct, fee });
    if (channel.commissionPct > 0) return t("feePct", { pct });
    if (channel.fixedFee > 0) return t("feeFixed", { fee });
    return t("feeNone");
  };
  const taken = new Set(data.channels.map((channel) => channel.name.trim().toLowerCase()));
  const templates = CHANNEL_TEMPLATES.filter((template) => !taken.has(template.name.toLowerCase()));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <ul className="divide-y rounded-lg border">
        {data.channels.map((channel) => (
          <li key={channel.id}>
            <Link
              href={`/s/${data.store.id}/kanal/${channel.id}`}
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
            >
              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{channel.name}</span>
              <span className="shrink-0 text-right text-sm text-muted-foreground">{fees(channel)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("templatesTitle")}</CardTitle>
            <CardDescription>{t("templatesHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {templates.map((template) => (
                <li key={template.key}>
                  <TemplateButton
                    action={addTemplateChannelAction.bind(null, data.store.id, template.key)}
                    label={`${template.name} · ${fees(template)}`}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelForm
            id="add-channel"
            action={createChannelAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

`app/[locale]/s/[storeId]/kanal/[channelId]/page.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteChannelAction, updateChannelAction } from "../actions";
import { ChannelForm } from "../channel-form";

type Params = Promise<{ locale: string; storeId: string; channelId: string }>;

export default async function EditChannelPage({ params }: { params: Params }) {
  const { storeId, channelId } = await params;
  const data = await loadStoreData(storeId);
  const channel = data?.channels.find((c) => c.id === channelId);
  if (!data || !channel) notFound();
  const t = await getTranslations("Channels");
  const tCommon = await getTranslations("Common");

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/kanal`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <ChannelForm
            action={updateChannelAction.bind(null, data.store.id, channel.id)}
            defaults={{ name: channel.name, commissionPct: String(channel.commissionPct), fixedFee: String(channel.fixedFee) }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("deleteWarning")}</p>
      <DeleteButton action={deleteChannelAction.bind(null, data.store.id, channel.id)} label={t("delete")} />
    </div>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .`, then (production build) `npx playwright test tests/e2e/channels.spec.ts tests/e2e/store-shell.spec.ts`, then the full e2e suite.
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/nav.ts "app/[locale]/s/[storeId]/kanal" messages tests
git commit -m "feat(channels): channels page with templates, custom channels, edit and delete"
```

---

### Task 6: Competitor price and recommended price on the product page

**Files:**
- Create: `app/[locale]/s/[storeId]/produk/[productId]/price-section.tsx`
- Modify: `app/[locale]/s/[storeId]/produk/[productId]/price-form.tsx`, `app/[locale]/s/[storeId]/produk/[productId]/page.tsx`, `app/[locale]/s/[storeId]/produk/actions.ts` (`savePriceAction`), `messages/id.json`, `messages/en.json` (`Pricing`), `tests/e2e/helpers.ts` (`setPrice` gains `competitor?`)
- Test: `tests/e2e/pricing.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 2 (`recommendForChannel`, `Recommendation`), Task 3 (`priceInputSchema` with `competitorPrice`, `toPriceColumns` with `competitor_price`), Task 4 (`FormAction`, `parseForm`), Task 5 (`addChannel`, `priceSection`).
- Produces: `<PriceSection data productId inactive entries={{ channel, action, defaults: { price, estMonthlySales, competitorPrice } }[]} />` — the server passes `StoreData` once; each channel's `PriceForm` shows price, sales estimate and competitor price inputs, the live preview (material cost, full cost, net price, competitor price, margin, status) and the recommendation with a "Pakai harga rekomendasi" button that fills the price input. `savePriceAction` saves `competitor_price` too (blank clears it).

- [ ] **Step 1: Write the failing tests**

Change `setPrice` in `tests/e2e/helpers.ts` to:

```ts
export async function setPrice(page: Page, p: { price: string; est: string; competitor?: string; channel?: string }) {
  const form = p.channel ? priceSection(page, p.channel) : page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill(p.price);
  await form.getByLabel("Perkiraan terjual / bulan").fill(p.est);
  if (p.competitor !== undefined) await form.getByLabel("Harga pesaing (Rp, opsional)").fill(p.competitor);
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(form.getByText("Harga tersimpan.")).toBeVisible();
}
```

Append to `tests/e2e/pricing.spec.ts` (its `beforeEach` creates "Toko Harga" with Gula 1 kg Rp15.000, product "Es teh" yield 10, row Gula 200 g → material cost Rp300; import `addChannel`, `priceSection`, `setPrice` as needed):

```ts
test("recommends a price and fills it in", async ({ page }) => {
  const form = page.locator("form[id^='price-']").first();
  await form.getByLabel("Harga jual (Rp)").fill("5.000");
  await form.getByLabel("Perkiraan terjual / bulan").fill("600");
  // No fixed costs: full cost Rp300; 300 / (1 − 0,4) = 500.
  await expect(form.getByText("Harga rekomendasi: Rp500")).toBeVisible();
  await form.getByRole("button", { name: "Pakai harga rekomendasi" }).click();
  await expect(form.getByLabel("Harga jual (Rp)")).toHaveValue("500");
  await expect(form).toContainText("40%");
  await expect(form).toContainText("Sesuai target");
  await form.getByRole("button", { name: "Simpan harga" }).click();
  await expect(form.getByText("Harga tersimpan.")).toBeVisible();
});

test("commission plus margin of 100% or more has no recommended price", async ({ page }) => {
  const productUrl = page.url();
  await page.goto(page.url().replace(/\/produk\/.*$/, "/kanal"));
  await addChannel(page, { name: "Titip 70", commissionPct: "70" });
  await page.goto(productUrl);
  await expect(priceSection(page, "Titip 70")).toContainText("Komisi + target margin ≥ 100%");
  await expect(priceSection(page, "Titip 70").getByRole("button", { name: "Pakai harga rekomendasi" })).toHaveCount(0);
});

test("a competitor price far from yours warns on the dashboard until it is cleared", async ({ page }) => {
  await setPrice(page, { price: "5.000", est: "600", competitor: "Rp 3.000" });
  const productUrl = page.url();
  await page.goto(page.url().replace(/\/produk\/.*$/, "/dashboard"));
  await expect(page.getByText("Harga beda lebih dari 25% dari pesaing: Es teh (Offline – Tunai).")).toBeVisible();

  await page.goto(productUrl);
  await setPrice(page, { price: "5.000", est: "600", competitor: "" });
  await page.reload();
  await expect(page.locator("form[id^='price-']").first().getByLabel("Harga pesaing (Rp, opsional)")).toHaveValue("");
  await page.goto(page.url().replace(/\/produk\/.*$/, "/dashboard"));
  await expect(page.getByText(/dari pesaing/)).toHaveCount(0);
});
```

Run (production build): `npx playwright test tests/e2e/pricing.spec.ts` — Expected: the new tests FAIL.

- [ ] **Step 2: Add the messages**

Add to `Pricing` in `messages/id.json`:

```json
    "competitorPrice": "Harga pesaing (Rp, opsional)",
    "competitorHint": "Harga produk serupa di tempat lain, untuk perbandingan.",
    "competitor": "Harga pesaing",
    "recommendation": "Harga rekomendasi: {price}",
    "recommendationNoOverhead": "Belum termasuk biaya operasional — isi perkiraan penjualan supaya lebih akurat.",
    "recommendationImpossible": "Komisi + target margin ≥ 100%, tidak ada harga yang memenuhi. Turunkan target margin atau pakai kanal lain.",
    "useRecommendation": "Pakai harga rekomendasi"
```

and to `Pricing` in `messages/en.json`:

```json
    "competitorPrice": "Competitor price (Rp, optional)",
    "competitorHint": "The price of a similar product elsewhere, for comparison.",
    "competitor": "Competitor price",
    "recommendation": "Recommended price: {price}",
    "recommendationNoOverhead": "Doesn't include operating costs yet — fill in expected sales for a better estimate.",
    "recommendationImpossible": "Commission + target margin ≥ 100%: no price satisfies this. Lower the target margin or use another channel.",
    "useRecommendation": "Use recommended price"
```

- [ ] **Step 3: Save the competitor price**

In `app/[locale]/s/[storeId]/produk/actions.ts`, set `const PRICE_FIELDS = ["price", "estMonthlySales", "competitorPrice"] as const;` and replace the comment above the upsert with `// competitor_price is included: a blank field clears it.` (the upsert already spreads `toPriceColumns(parsed.input)`, which now carries `competitor_price`).

- [ ] **Step 4: Build the price section**

`app/[locale]/s/[storeId]/produk/[productId]/price-section.tsx`:

```tsx
"use client";

import type { CalcChannel, StoreData } from "@/lib/calc";
import type { FormAction } from "@/lib/forms";
import { PriceForm, type PriceDefaults } from "./price-form";

type Entry = { channel: CalcChannel; action: FormAction; defaults: PriceDefaults };

/** One price form per channel. StoreData crosses the server/client boundary once, not once per channel. */
export function PriceSection({ data, productId, inactive, entries }: { data: StoreData; productId: string; inactive: boolean; entries: Entry[] }) {
  return (
    <div className="space-y-6">
      {entries.map(({ channel, action, defaults }) => (
        <section key={channel.id} className="space-y-3">
          <h3 className="font-medium [overflow-wrap:anywhere]">{channel.name}</h3>
          <PriceForm
            id={`price-${channel.id}`}
            action={action}
            data={data}
            productId={productId}
            channel={channel}
            defaults={defaults}
            inactive={inactive}
          />
        </section>
      ))}
    </div>
  );
}
```

Replace `app/[locale]/s/[storeId]/produk/[productId]/price-form.tsx` with:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useRemountKey } from "@/components/forms/use-remount-key";
import { StatusBadge } from "@/components/store/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recommendForChannel,
  tryAnalyzeStore,
  type CalcChannel,
  type MetricsLine,
  type Recommendation,
  type StoreData,
} from "@/lib/calc";
import { formatPercent, formatRupiah } from "@/lib/format";
import type { FormAction } from "@/lib/forms";
import { priceInputSchema } from "@/lib/validation/price";

export type PriceDefaults = { price: string; estMonthlySales: string; competitorPrice: string };

type Props = {
  id: string;
  action: FormAction;
  data: StoreData;
  productId: string;
  channel: CalcChannel;
  defaults: PriceDefaults;
  inactive?: boolean;
};

export function PriceForm({ id, action, data, productId, channel, defaults, inactive }: Props) {
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
        inactive={inactive}
        defaults={{ ...defaults, ...(state?.values as Partial<PriceDefaults> | undefined) }}
        errors={state?.fieldErrors ?? {}}
      />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto" pendingText={tCommon("savePending")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}

type Preview = { line: MetricsLine | null; recommendation: Recommendation | null };

/**
 * Recomputes the whole store with the typed values, so full cost, margin and the recommendation match
 * the dashboard. The recommendation is shown even before a valid price is typed.
 */
function preview(data: StoreData, productId: string, channelId: string, values: Record<string, unknown>): Preview {
  const parsed = priceInputSchema.safeParse(values);
  const scenario: StoreData = parsed.success
    ? {
        ...data,
        prices: [
          ...data.prices.filter((row) => !(row.productId === productId && row.channelId === channelId)),
          {
            productId,
            channelId,
            price: parsed.data.price,
            estMonthlySales: parsed.data.estMonthlySales,
            competitorPrice: parsed.data.competitorPrice,
          },
        ],
      }
    : data;
  const { analysis } = tryAnalyzeStore(scenario);
  if (!analysis) return { line: null, recommendation: null };
  let recommendation: Recommendation | null = null;
  try {
    recommendation = recommendForChannel(scenario, analysis, productId, channelId);
  } catch {
    recommendation = null; // a CalcError in this product's composition; the page shows the alert
  }
  const line = parsed.success
    ? (analysis.lines.find((candidate) => candidate.productId === productId && candidate.channelId === channelId) ?? null)
    : null;
  return { line, recommendation };
}

function PriceFields({
  data,
  productId,
  channel,
  defaults,
  inactive,
  errors,
}: {
  data: StoreData;
  productId: string;
  channel: CalcChannel;
  defaults: PriceDefaults;
  inactive?: boolean;
  errors: Record<string, string[] | undefined>;
}) {
  const t = useTranslations("Pricing");
  const locale = useLocale();
  const priceRef = useRef<HTMLInputElement>(null);
  const [{ line, recommendation }, setPreview] = useState(() => preview(data, productId, channel.id, defaults));
  const field = (name: string) => `price-${channel.id}-${name}`;

  function refresh(form: HTMLFormElement | null | undefined) {
    if (form) setPreview(preview(data, productId, channel.id, Object.fromEntries(new FormData(form))));
  }

  function useRecommended() {
    if (recommendation?.kind !== "price" || !priceRef.current) return;
    priceRef.current.value = String(recommendation.price);
    refresh(priceRef.current.form);
  }

  return (
    <fieldset className="space-y-3" onChange={(event) => refresh(event.currentTarget.form)}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={field("price")}>{t("price")}</Label>
          <Input
            ref={priceRef}
            id={field("price")}
            name="price"
            inputMode="numeric"
            defaultValue={defaults.price}
            placeholder={t("pricePlaceholder")}
          />
          <FieldError errors={errors.price} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={field("est")}>{t("estMonthlySales")}</Label>
          <Input id={field("est")} name="estMonthlySales" inputMode="numeric" defaultValue={defaults.estMonthlySales} placeholder="300" />
          <FieldError errors={errors.estMonthlySales} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor={field("competitor")}>{t("competitorPrice")}</Label>
          <Input id={field("competitor")} name="competitorPrice" inputMode="numeric" defaultValue={defaults.competitorPrice} />
          <p className="text-xs text-muted-foreground">{t("competitorHint")}</p>
          <FieldError errors={errors.competitorPrice} />
        </div>
      </div>

      {!inactive && recommendation && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          {recommendation.kind === "impossible" ? (
            <p>{t("recommendationImpossible")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t("recommendation", { price: formatRupiah(recommendation.price, locale) })}</span>
                <Button type="button" variant="outline" onClick={useRecommended}>
                  {t("useRecommendation")}
                </Button>
              </div>
              {!recommendation.includesOperatingCosts && (
                <p className="text-xs text-muted-foreground">{t("recommendationNoOverhead")}</p>
              )}
            </>
          )}
        </div>
      )}

      {inactive ? (
        <p className="text-sm text-muted-foreground">{t("inactivePreview")}</p>
      ) : line ? (
        <div className="space-y-2">
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
            {line.competitorPrice !== null && (
              <>
                <dt className="text-muted-foreground">{t("competitor")}</dt>
                <dd className="text-right font-medium">{formatRupiah(line.competitorPrice, locale)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("margin")}</dt>
            <dd className="text-right font-medium">
              {line.marginPct === null ? "—" : formatPercent(line.marginPct, locale)}{" "}
              <span className="font-normal text-muted-foreground">({t("target", { pct: formatPercent(line.targetMarginPct, locale) })})</span>
            </dd>
          </dl>
          <div aria-live="polite" className="flex flex-wrap items-center gap-2">
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

In `app/[locale]/s/[storeId]/produk/[productId]/page.tsx`, replace the `{data.channels.map((channel) => { … })}` block inside the price `CardContent` with:

```tsx
          <PriceSection
            data={data}
            productId={product.id}
            inactive={!product.isActive}
            entries={data.channels.map((channel) => {
              const saved = data.prices.find((row) => row.productId === product.id && row.channelId === channel.id);
              return {
                channel,
                action: savePriceAction.bind(null, data.store.id, product.id, channel.id),
                defaults: {
                  price: saved ? String(saved.price) : "",
                  estMonthlySales: saved ? String(saved.estMonthlySales) : "",
                  competitorPrice: saved?.competitorPrice == null ? "" : String(saved.competitorPrice),
                },
              };
            })}
          />
```

and replace `import { PriceForm } from "./price-form";` with `import { PriceSection } from "./price-section";`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .`, then (production build) `npx playwright test tests/e2e/pricing.spec.ts tests/e2e/dashboard.spec.ts`, then the full e2e suite.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/s/[storeId]/produk" messages tests/e2e
git commit -m "feat(pricing): competitor price and recommended price per channel"
```

---

### Task 7: Packaging used only in one channel

**Files:**
- Modify: `lib/validation/composition.ts`, `app/[locale]/s/[storeId]/produk/actions.ts` (`ROW_FIELDS`, `addCompositionRowAction`), `app/[locale]/s/[storeId]/produk/[productId]/composition-editor.tsx`, `app/[locale]/s/[storeId]/produk/[productId]/page.tsx`, `messages/id.json`, `messages/en.json` (`Composition`, `Validation.composition.channelInvalid`), `tests/e2e/helpers.ts` (`addCompositionRow` gains `channel?`)
- Test: `tests/unit/entity-validation.test.ts`, `tests/e2e/composition.spec.ts`

**Interfaces:**
- Consumes: Task 4 (`parseForm`), Task 5 (`addTemplateChannel`, `priceSection`).
- Produces: `compositionInputSchema` gains `channelId: string | null` (blank → null; non-uuid → `composition.channelInvalid`); `toCompositionColumns` returns `channel_id` too; `COMPOSITION_VALIDATION_KEYS` gains `"composition.channelInvalid"`. The add form shows a "Dipakai di" select (Semua kanal / one channel) when the store has more than one channel; a row with a channel shows "Hanya di {channel}". A row's channel is fixed after creation (Rulings).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/entity-validation.test.ts`, the composition "parses a row" expectation becomes `{ ...row, qty: 200, channelId: null }`, and add:

```ts
  it("accepts an optional channel", () => {
    const channelId = "7a1c3c1e-2d4b-4f7a-9c1a-1b2c3d4e5f61";
    expect(compositionInputSchema.parse({ ...row, channelId }).channelId).toBe(channelId);
    expect(compositionInputSchema.parse({ ...row, channelId: "" }).channelId).toBeNull();
    expect(errorsFor(compositionInputSchema, { ...row, channelId: "gofood" }).channelId).toBe("composition.channelInvalid");
  });
```

Change `addCompositionRow` in `tests/e2e/helpers.ts`: add `channel?: string` to its parameter type and, before clicking the add button, `if (r.channel) await form.getByLabel("Dipakai di").selectOption({ label: r.channel });`.

Append to `tests/e2e/composition.spec.ts`:

```ts
test("packaging used only in one channel raises only that channel's cost", async ({ page }) => {
  await page.goto(storeUrl(page, "kanal"));
  await addTemplateChannel(page, "GoFood");
  await page.goto(storeUrl(page, "bahan"));
  await addMaterial(page, { name: "Bubble wrap", qty: "100", unit: "pcs", price: "20.000", category: "kemasan" });
  await page.goto(productUrl);
  await addCompositionRow(page, { material: "Gula", qty: "200" });
  await addCompositionRow(page, { material: "Bubble wrap", qty: "1", channel: "GoFood" });
  await expect(row(page, "Bubble wrap")).toContainText("Hanya di GoFood");

  for (const [channel, cost] of [["Offline – Tunai", "Rp300"], ["GoFood", "Rp500"]] as const) {
    const section = priceSection(page, channel);
    await section.getByLabel("Harga jual (Rp)").fill("5.000");
    await section.getByLabel("Perkiraan terjual / bulan").fill("100");
    await expect(section).toContainText(cost);
  }
});
```

(import `addTemplateChannel` and `priceSection`; the file's `beforeEach` already creates Gula 1 kg Rp15.000, Cup, and the product "Es teh manis" yield 10, and keeps `productUrl`). Run them — the unit cases and the new e2e test FAIL.

- [ ] **Step 2: Add the messages**

`Validation.composition.channelInvalid`: id "Pilih kanal yang ada", en "Choose an existing channel". Add to `Composition` in `messages/id.json`:

```json
    "channel": "Dipakai di",
    "allChannels": "Semua kanal",
    "channelHint": "Pilih satu kanal untuk kemasan khusus, misalnya bubble wrap hanya untuk pesanan online.",
    "onlyChannel": "Hanya di {channel}"
```

and in `messages/en.json`:

```json
    "channel": "Used in",
    "allChannels": "All channels",
    "channelHint": "Pick one channel for packaging used only there, e.g. bubble wrap only for online orders.",
    "onlyChannel": "Only in {channel}"
```

- [ ] **Step 3: Validation and action**

In `lib/validation/composition.ts`: add `"composition.channelInvalid"` to `COMPOSITION_VALIDATION_KEYS`; add to the schema

```ts
  channelId: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.string().refine(isUuid, "composition.channelInvalid").nullable(),
  ),
```

and make `toCompositionColumns` return `{ material_id: input.materialId, qty: input.qty, unit: input.unit, basis: input.basis, channel_id: input.channelId }`.

In `app/[locale]/s/[storeId]/produk/actions.ts`: `const ROW_FIELDS = ["materialId", "qty", "unit", "basis", "channelId"] as const;`. In `addCompositionRowAction`, after the `rowErrors` check, add:

```ts
  if (parsed.input.channelId) {
    const { data: channel } = await supabase
      .from("sales_channels")
      .select("id")
      .eq("id", parsed.input.channelId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!channel) {
      const tValidation = await getValidationTranslator();
      return { fieldErrors: { channelId: [tValidation("composition.channelInvalid")] }, values: parsed.values };
    }
  }
```

and change the insert to `{ store_id: storeId, product_id: productId, ...toCompositionColumns(parsed.input) }` (drop the explicit `channel_id: null`). `updateCompositionRowAction` keeps updating only `qty`, `unit`, `basis`.

- [ ] **Step 4: Editor and page**

In `composition-editor.tsx`:
- `EditorRow` gains `channelName: string | null`; add `export type EditorChannel = { id: string; name: string };`; `Props` gains `channels: EditorChannel[]`; pass `channels` from `CompositionEditor` to `AddRowForm`, and from `AddRowForm` to `AddRowFields`.
- In `RowEditor`, under the material name paragraph, render `{row.channelName && <p className="text-xs text-muted-foreground">{t("onlyChannel", { channel: row.channelName })}</p>}` (wrap the name and this line in a `<div className="min-w-0">` so the cost stays right-aligned).
- In `AddRowFields`, inside the `{material && …}` block after the quantity/unit/basis grid, add:

```tsx
          {channels.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="composition-channel">{t("channel")}</Label>
              <NativeSelect id="composition-channel" name="channelId" defaultValue={echoed ? (defaults.channelId ?? "") : ""}>
                <option value="">{t("allChannels")}</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">{t("channelHint")}</p>
              <FieldError errors={errors.channelId} />
            </div>
          )}
```

(wrap the existing grid and this block in a `<div className="space-y-3">` inside the `material &&` branch).

In `produk/[productId]/page.tsx`: drop the `.filter(... && row.channelId === null)` (keep `row.productId === product.id`) and its Phase 2 comment; build `const channelNames = new Map(data.channels.map((c) => [c.id, c.name]));` and set `channelName: row.channelId ? (channelNames.get(row.channelId) ?? null) : null` in each mapped row; pass `channels={data.channels.map(({ id, name }) => ({ id, name }))}` to `CompositionEditor`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npx tsc --noEmit && npx eslint .`, then (production build) `npx playwright test tests/e2e/composition.spec.ts tests/e2e/pricing.spec.ts`, then the full e2e suite.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/validation/composition.ts "app/[locale]/s/[storeId]/produk" messages tests
git commit -m "feat(products): composition rows used only in one channel"
```

---

### Task 8: Optional channels step in the checklist; spec notes

**Files:**
- Modify: `lib/dashboard/checklist.ts`, `app/[locale]/s/[storeId]/dashboard/setup-checklist.tsx`, `app/[locale]/s/[storeId]/dashboard/page.tsx`, `messages/id.json`, `messages/en.json` (`Checklist`), `docs/superpowers/specs/2026-10-16-untungin-design.md`
- Test: `tests/unit/checklist.test.ts`, `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Produces: `CHECKLIST_KEYS` gains `"channels"` (last); `ChecklistItem` gains `optional: boolean` (true only for `channels`); `channels` is done when the store has more than one channel; its href is `/s/{id}/kanal`. The dashboard shows the checklist while any **required** step is undone.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/checklist.test.ts`: in the empty-store expectation add `optional: false` to each existing item and append `{ key: "channels", done: false, href: "/s/store/kanal", optional: true }`; in the fixture expectation add `channels: true` (the fixture has two channels). Add:

```ts
  it("the channels step is optional and done once there is a second channel", () => {
    const one = fixture();
    one.channels = one.channels.slice(0, 1);
    const item = setupChecklist(one).find((entry) => entry.key === "channels");
    expect(item).toEqual({ key: "channels", done: false, href: "/s/store/kanal", optional: true });
  });
```

In `tests/e2e/dashboard.spec.ts`, in "a new store shows the checklist …", add:

```ts
  await expect(page.getByRole("link", { name: /Tambah kanal online/ })).toContainText("(opsional)");
```

Run them — FAIL.

- [ ] **Step 2: Implement**

In `lib/dashboard/checklist.ts`: `CHECKLIST_KEYS = ["materials", "products", "expenses", "ownerSalary", "assets", "channels"] as const`; `ChecklistItem = { key: ChecklistKey; done: boolean; href: string; optional: boolean }`; add `channels: data.channels.length > 1` to `done` and `channels: `${base}/kanal`` to `href`; return `CHECKLIST_KEYS.map((key) => ({ key, done: done[key], href: href[key], optional: key === "channels" }))`.

In `dashboard/page.tsx`, show the checklist when `checklist.some((item) => !item.done && !item.optional)`.

In `dashboard/setup-checklist.tsx`, after the item label span add `{item.optional && <span className="shrink-0 text-xs text-muted-foreground">{t("optional")}</span>}`.

Messages `Checklist`: `items.channels` id "Tambah kanal online (GoFood, Shopee, …)" / en "Add online channels (GoFood, Shopee, …)"; `optional` id "(opsional)" / en "(optional)".

- [ ] **Step 3: Update the spec**

In `docs/superpowers/specs/2026-10-16-untungin-design.md`:
1. §3.4, after the template paragraph, add: "Template fees verified October 2026 (estimates, excluding PPN): Offline – QRIS 0%; GoFood 20% + Rp1.000; GrabFood 30%; ShopeeFood 20%; Shopee 9% + Rp1.250; Tokopedia 8%; TikTok Shop 8%. Template names are brand names and are stored as-is. Duplicate channel names (case-insensitive) are refused, and a store always keeps at least one channel."
2. §8: change the `calc/` line to list `pricing.ts` as present (only `overrides.ts` remains for Phase 4) and add `lib/forms-server.ts (parseForm)`.
3. §10, after item 3, add an indented note: "Phase 3 notes: a composition row's channel is fixed after creation; the checklist's channels step is optional; the recommendation uses full cost when sales estimates exist, otherwise material cost (and says so)."

- [ ] **Step 4: Run everything**

Run: `npm test && npx tsc --noEmit && npx eslint . && npm run test:rls`, then build and run the **whole** e2e suite against the production server.
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard "app/[locale]/s/[storeId]/dashboard" messages docs/superpowers/specs tests
git commit -m "feat(dashboard): optional channels step in the setup checklist; Phase 3 spec notes"
```

---

## Self-review notes (for the executor)

- Spec coverage: §3.3 `channel_id` rows (Task 7), §3.4 channels, templates, competitor price (Tasks 3, 5, 6), §4.2 item 9 (Task 2), §4.3 `COMPETITOR_GAP` now reachable from the UI (Task 6), §5.2 `kanal` and `produk/[id]` comparison + "Pakai harga rekomendasi" (Tasks 5, 6), checklist "Online channels (optional)" (Task 8). Deferred: §4.4 simulation (Phase 4).
- Names to keep consistent: `Recommendation`, `recommendForChannel`, `ceilTo500`, `CHANNEL_TEMPLATES`, `findTemplate`, `channelInputSchema`, `toChannelColumns`, `CHANNEL_DUPLICATE_KEY`, `parseForm`, `FormAction`, `PriceSection`, `PriceDefaults`, `EditorChannel`, form ids `#add-channel`, `form[id^='price-']`, helpers `addChannel`, `addTemplateChannel`, `priceSection`.
