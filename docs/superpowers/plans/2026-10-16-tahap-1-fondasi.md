# Tahap 1 — Fondasi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Next.js 16 app where a user signs in (Google in production, email/password "dev login" locally), creates one or more stores through a 2-step onboarding, switches between stores, edits/deletes a store — on top of the full v1 Supabase schema protected by RLS.

**Architecture:** Next.js App Router (Server Components + Server Actions) talking to Supabase through `@supabase/ssr`. `proxy.ts` (Next 16's replacement for `middleware.ts`) refreshes the session and guards protected routes. All authorization is enforced in Postgres via RLS (`is_store_owner()`); the app never trusts client-supplied ownership. The complete v1 schema is created now so later phases only add UI and logic.

**Tech Stack:** Next.js 16.4, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui, `@supabase/ssr` 0.12, `@supabase/supabase-js` 2.118, Supabase CLI 2.121 (local stack in Docker), zod 4, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-businessnote-design.md` (sections 2, 3, 5.1, 5.2 `pengaturan`, 5.3, 8, 9, 10 item 1, 11)

## Global Constraints

- All UI copy is Indonesian. Code identifiers, file names, and commit messages are English.
- Mobile-first: every page must be usable at 360px width with no horizontal scroll; 16px side padding (`px-4`).
- TypeScript `strict: true`; no `any` in app code (tests may use untyped Supabase clients).
- Env var names, exactly: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_ENABLE_DEV_LOGIN`.
- `SUPABASE_SECRET_KEY` is never imported by app code in this phase and must never get a `NEXT_PUBLIC_` prefix.
- Server code checks auth with `supabase.auth.getClaims()`, never `getSession()`.
- Every table has RLS enabled. Store-scoped tables use `public.is_store_owner(store_id)`.
- Money columns are `integer` (Rupiah). Quantities/percentages are `numeric`.
- Supported units (DB check constraint): `g, ons, kg, ml, l, pcs, lusin`.
- Plan limits: free = 2 stores, 3 AI analyses/day; pro = 10 stores, 20 AI analyses/day.
- Store defaults: `target_margin_pct` 40, `operating_days_per_month` 26.
- Use `buttonVariants()` on `<Link>` for link-buttons; do not rely on `asChild` (shadcn may be generated on Radix or Base UI).
- Selects are native `<select>` elements (better on phones, posts with forms natively).
- Commit after every task with the message given. End every commit message with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **`next` redirect parameter abuse** (`?next=https://evil.com`, `//evil.com`, `/\evil.com`, `/\t/evil.com`) — user must always land inside the app. Pinned by `tests/unit/auth-paths.test.ts` (Task 4) and `tests/e2e/auth.spec.ts` (Task 5).
2. **Bad `storeId` in the URL** (malformed string, random UUID, another user's store) — must render the Indonesian 404 page, never a 500 or another user's data. Pinned by `tests/unit/uuid.test.ts` (Task 4) and `tests/e2e/store-shell.spec.ts` (Task 7).
3. **Indonesian number input** (`"12,5"`, `"40%"`, `" 26 "`, `""`, `"abc"`) — commas are decimals, `%` is ignored, blanks/garbage produce an Indonesian field error. Pinned by `tests/unit/store-validation.test.ts` (Task 6).
4. **Store limit reached** (free user creating a 3rd store) — friendly message, no store created. Pinned by `tests/unit/plans.test.ts` and `tests/e2e/onboarding.spec.ts` (Task 6).
5. **Duplicate store name / double-submit** (same name twice, or double-clicking "Buat toko") — at most one store is created; a duplicate name shows a field error. Pinned by `tests/rls/core.test.ts` (Task 2), `tests/e2e/onboarding.spec.ts` (Task 6), and the double-click test in `tests/e2e/store-shell.spec.ts` (Task 7).

---

## File Map

```
app/
  layout.tsx                         root layout (lang="id", metadata)          [Task 1, 9]
  page.tsx                           landing                                    [Task 9]
  not-found.tsx                      Indonesian 404                             [Task 5]
  login/page.tsx                     login (Google + dev login)                 [Task 5]
  login/google-button.tsx            client: signInWithOAuth                    [Task 5]
  login/dev-login-form.tsx           client: dev email/password form            [Task 5]
  login/actions.ts                   devLoginAction                             [Task 5]
  auth/callback/route.ts             OAuth code exchange                        [Task 5]
  auth/actions.ts                    signOutAction                              [Task 5]
  mulai/route.ts                     post-login resolver → onboarding/dashboard [Task 5]
  onboarding/page.tsx                                                           [Task 6]
  onboarding/onboarding-form.tsx     client 2-step wizard                       [Task 6]
  onboarding/actions.ts              createStoreAction                          [Task 6]
  toko/page.tsx                      store list / switcher                      [Task 7]
  s/[storeId]/layout.tsx             store shell (header, nav)                  [Task 7]
  s/[storeId]/dashboard/page.tsx                                                [Task 7]
  s/[storeId]/pengaturan/page.tsx                                               [Task 8]
  s/[storeId]/pengaturan/settings-form.tsx      client                          [Task 8]
  s/[storeId]/pengaturan/delete-store-form.tsx  client                          [Task 8]
  s/[storeId]/pengaturan/actions.ts  updateStoreAction, deleteStoreAction       [Task 8]
components/
  ui/*                               shadcn (button, input, label, card)        [Task 1]
  forms/field-error.tsx                                                         [Task 5]
  forms/submit-button.tsx                                                       [Task 5]
  store/store-fields.tsx             shared store form fields                   [Task 6]
  store/store-nav.tsx                client: sidebar + bottom nav               [Task 7]
lib/
  utils.ts                           cn() (shadcn)                              [Task 1]
  uuid.ts                            isUuid()                                   [Task 4]
  format.ts                          formatPercent()                            [Task 7]
  forms.ts                           FormState type                             [Task 5]
  nav.ts                             storeNavItems(), isNavActive()             [Task 7]
  auth/paths.ts                      isProtectedPath(), safeNextPath()          [Task 4]
  auth/require-user.ts               requireUser()                              [Task 4]
  supabase/server.ts                 server client                              [Task 4]
  supabase/client.ts                 browser client                             [Task 4]
  supabase/proxy.ts                  updateSession()                            [Task 4]
  supabase/database.types.ts         generated                                  [Task 3]
  config/plans.ts                    PLAN_LIMITS, toPlan(), canCreateStore()    [Task 6]
  validation/number.ts               localeNumber()                             [Task 6]
  validation/store.ts                storeInputSchema & helpers                 [Task 6]
  data/stores.ts                     getStore(), listStores()                   [Task 6]
proxy.ts                                                                        [Task 4]
supabase/config.toml                                                            [Task 2]
supabase/migrations/20261016000001_core.sql                                     [Task 2]
supabase/migrations/20261016000002_domain.sql                                   [Task 3]
scripts/write-env-local.mjs                                                     [Task 2]
tests/unit/*.test.ts                 Vitest, no network                         [Tasks 1,4,6,7,8]
tests/rls/*.test.ts                  Vitest against local Supabase              [Tasks 2,3]
tests/e2e/*.spec.ts                  Playwright against local app + Supabase    [Tasks 5–8]
vitest.config.ts / vitest.rls.config.ts / playwright.config.ts
.env.example, README.md                                                         [Task 9]
```

---

### Task 1: Scaffold Next.js app with tooling

**Files:**
- Create: whole Next.js scaffold at repo root (`app/`, `public/`, `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`)
- Create: `components/ui/{button,input,label,card}.tsx`, `lib/utils.ts`, `components.json` (shadcn)
- Create: `vitest.config.ts`
- Test: `tests/unit/utils.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`; `Button`, `buttonVariants` from `@/components/ui/button`; `Input`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` from `@/components/ui/*`; npm scripts `test`, `typecheck`, `lint`, `build`.

- [ ] **Step 1: Scaffold into a temp dir and copy in** (the repo root already contains `docs/` and `.git`, which `create-next-app` refuses)

```bash
cd /Users/YC7321/Developments/BusinessNote
SCAFFOLD="$(mktemp -d)"
npx --yes create-next-app@16.4.2 "$SCAFFOLD/app" --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack --yes
rsync -a --exclude .git --exclude node_modules "$SCAFFOLD/app/" ./
rm -rf "$SCAFFOLD"
npm install
```

If `create-next-app` rejects a flag, run `npx create-next-app@16.4.2 --help` and use the equivalent; the required outcome is: TypeScript, Tailwind, ESLint, App Router, no `src/`, alias `@/*`, npm.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/ssr@^0.12 @supabase/supabase-js@^2.118 zod@^4 server-only lucide-react
npm install -D vitest@^5 vite @playwright/test supabase@^2.121
```

- [ ] **Step 3: Init shadcn and add components**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button input label card --yes
```

Expected: `components.json`, `lib/utils.ts` (exports `cn`), `components/ui/button.tsx` (exports `Button` and `buttonVariants`), `input.tsx`, `label.tsx`, `card.tsx`.

- [ ] **Step 4: Add scripts and Vitest config**

In `package.json` `"scripts"`, keep `dev`, `build`, `start`, `lint` as generated and add:

```json
"typecheck": "tsc --noEmit",
"test": "vitest run --config vitest.config.ts",
"test:rls": "vitest run --config vitest.rls.config.ts",
"test:e2e": "playwright test",
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:types": "supabase gen types typescript --local > lib/supabase/database.types.ts",
"env:local": "node scripts/write-env-local.mjs"
```

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 5: Write a smoke test**

Create `tests/unit/utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("lets later tailwind classes win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
```

- [ ] **Step 6: Set root layout language and metadata**

In `app/layout.tsx`, keep the generated font setup, change `<html lang="en">` to `<html lang="id">`, and set:

```ts
export const metadata: Metadata = {
  title: "BusinessNote — Hitung HPP & Laba Usaha",
  description:
    "Hitung HPP, harga jual, biaya operasional, dan laba usahamu dengan mudah.",
};
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 2 tests pass; typecheck, lint, build succeed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Tailwind, shadcn, Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Local Supabase + core schema (profiles, stores, create_store)

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261016000001_core.sql`
- Create: `scripts/write-env-local.mjs`, `vitest.rls.config.ts`
- Test: `tests/rls/helpers.ts`, `tests/rls/core.test.ts`

**Interfaces:**
- Consumes: npm scripts from Task 1.
- Produces (SQL):
  - `public.profiles(id, full_name, plan, created_at)`; trigger creates a row per new auth user.
  - `public.stores(id, owner_id, name, business_type, target_margin_pct, operating_days_per_month, target_market, created_at)`; unique `(owner_id, lower(name))`.
  - `public.sales_channels(id, store_id, name, commission_pct, fixed_fee, sort_order, created_at)`; unique `(id, store_id)`.
  - `public.is_store_owner(sid uuid) returns boolean`.
  - `public.create_store(p_name text, p_business_type text, p_operating_days integer, p_target_margin numeric, p_target_market text default null) returns uuid` — creates the store owned by `auth.uid()` plus channel `'Offline – Tunai'`.
- Produces (TS, tests only): `admin`, `anonClient()`, `createTestUser(label): Promise<TestUser>`, `createStore(user, name): Promise<string>`, `type TestUser = { id: string; client: SupabaseClient }` from `tests/rls/helpers.ts`.

- [ ] **Step 1: Init Supabase and start the local stack**

```bash
npx supabase init
npm run db:start
```

Answer "N" to any VS Code/Deno prompt. First start pulls Docker images and can take several minutes. Expected: output lists `API URL: http://127.0.0.1:54321`.

In `supabase/config.toml`, section `[auth]`, set:

```toml
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/**", "http://localhost:3100/**"]
```

- [ ] **Step 2: Write the env script**

Create `scripts/write-env-local.mjs`:

```js
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const status = JSON.parse(
  execSync("npx supabase status -o json", { encoding: "utf8" }),
);
const pick = (...keys) => keys.map((k) => status[k]).find(Boolean);

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  SUPABASE_SECRET_KEY: pick("SECRET_KEY", "SERVICE_ROLE_KEY"),
  NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true",
};

for (const [key, value] of Object.entries(vars)) {
  if (!value) {
    throw new Error(
      `Missing ${key}. Keys in supabase status: ${Object.keys(status).join(", ")}`,
    );
  }
}

const path = ".env.local";
const kept = existsSync(path)
  ? readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line && !Object.keys(vars).some((k) => line.startsWith(`${k}=`)))
  : [];
const lines = [...kept, ...Object.entries(vars).map(([k, v]) => `${k}=${v}`)];
writeFileSync(path, `${lines.join("\n")}\n`);
console.log(`Wrote ${Object.keys(vars).length} Supabase vars to ${path}`);
```

Run: `npm run env:local`
Expected: `Wrote 4 Supabase vars to .env.local`. Confirm `.env.local` is git-ignored: `git check-ignore .env.local` prints `.env.local`.

- [ ] **Step 3: Write the RLS test config and helpers**

Create `vitest.rls.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
}));
```

Create `tests/rls/helpers.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    "Supabase env missing. Run `npm run db:start && npm run env:local` first.",
  );
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin = createClient(url, secretKey, noSession);
export const anonClient = () => createClient(url, publishableKey, noSession);

export type TestUser = { id: string; client: SupabaseClient };

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID()}@test.local`;
  const password = "password-123456";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error) throw error;

  const client = createClient(url!, publishableKey!, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, client };
}

export async function createStore(user: TestUser, name: string): Promise<string> {
  const { data, error } = await user.client.rpc("create_store", {
    p_name: name,
    p_business_type: "minuman",
    p_operating_days: 26,
    p_target_margin: 40,
  });
  if (error) throw error;
  return data as string;
}
```

- [ ] **Step 4: Write the failing core RLS tests**

Create `tests/rls/core.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, createStore, createTestUser, type TestUser } from "./helpers";

describe("profiles", () => {
  let a: TestUser;

  beforeAll(async () => {
    a = await createTestUser("profile");
  });

  it("creates a free-plan profile with the auth full_name on signup", async () => {
    const { data, error } = await a.client
      .from("profiles")
      .select("plan, full_name")
      .eq("id", a.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ plan: "free", full_name: "Test profile" });
  });

  it("lets a user update their own full_name", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ full_name: "Budi" })
      .eq("id", a.id);
    expect(error).toBeNull();
  });

  it("does not let a user change their own plan", async () => {
    const { error } = await a.client.from("profiles").update({ plan: "pro" }).eq("id", a.id);
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("profiles").select("plan").eq("id", a.id).single();
    expect(data?.plan).toBe("free");
  });
});

describe("stores", () => {
  let a: TestUser;
  let b: TestUser;
  let storeA: string;

  beforeAll(async () => {
    a = await createTestUser("store-a");
    b = await createTestUser("store-b");
    storeA = await createStore(a, "Kopi A");
  });

  it("create_store creates a store owned by the caller with defaults", async () => {
    const { data } = await a.client
      .from("stores")
      .select("owner_id, name, target_margin_pct, operating_days_per_month, target_market")
      .eq("id", storeA)
      .single();
    expect(data).toEqual({
      owner_id: a.id,
      name: "Kopi A",
      target_margin_pct: 40,
      operating_days_per_month: 26,
      target_market: null,
    });
  });

  it("create_store adds the 'Offline – Tunai' channel", async () => {
    const { data } = await a.client
      .from("sales_channels")
      .select("name, commission_pct, fixed_fee")
      .eq("store_id", storeA);
    expect(data).toEqual([{ name: "Offline – Tunai", commission_pct: 0, fixed_fee: 0 }]);
  });

  it("hides other users' stores and channels", async () => {
    const stores = await b.client.from("stores").select("id").eq("id", storeA);
    expect(stores.data).toEqual([]);
    const channels = await b.client.from("sales_channels").select("id").eq("store_id", storeA);
    expect(channels.data).toEqual([]);
  });

  it("does not let other users update or delete a store", async () => {
    const updated = await b.client.from("stores").update({ name: "Dibajak" }).eq("id", storeA).select("id");
    expect(updated.data).toEqual([]);
    const deleted = await b.client.from("stores").delete().eq("id", storeA).select("id");
    expect(deleted.data).toEqual([]);
    const { data } = await admin.from("stores").select("name").eq("id", storeA).single();
    expect(data?.name).toBe("Kopi A");
  });

  it("does not let a user insert a store owned by someone else", async () => {
    const { error } = await b.client
      .from("stores")
      .insert({ owner_id: a.id, name: "Palsu", business_type: "minuman" });
    expect(error?.code).toBe("42501");
  });

  it("rejects a duplicate store name for the same owner, case-insensitively", async () => {
    await expect(createStore(a, "kopi a")).rejects.toMatchObject({ code: "23505" });
  });

  it("allows the same store name for different owners", async () => {
    await expect(createStore(b, "Kopi A")).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects an unknown business type", async () => {
    const { error } = await a.client.rpc("create_store", {
      p_name: "Jasa",
      p_business_type: "jasa",
      p_operating_days: 26,
      p_target_margin: 40,
    });
    expect(error?.code).toBe("23514");
  });

  it("rejects create_store for anonymous callers", async () => {
    const { error } = await anonClient().rpc("create_store", {
      p_name: "Anon",
      p_business_type: "minuman",
      p_operating_days: 26,
      p_target_margin: 40,
    });
    expect(error).not.toBeNull();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm run test:rls`
Expected: FAIL — errors like `relation "public.profiles" does not exist` / `Could not find the function public.create_store`.

- [ ] **Step 6: Write the core migration**

Create `supabase/migrations/20261016000001_core.sql`:

```sql
-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Users may only change full_name; plan is managed by admins.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Stores --------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  business_type text not null check (
    business_type in ('makanan', 'minuman', 'kue_roti', 'katering', 'produk_olahan', 'lainnya')
  ),
  target_margin_pct numeric not null default 40
    check (target_margin_pct >= 0 and target_margin_pct < 100),
  operating_days_per_month integer not null default 26
    check (operating_days_per_month between 1 and 31),
  target_market text check (target_market in ('menengah_bawah', 'menengah', 'menengah_atas')),
  created_at timestamptz not null default now()
);

create index stores_owner_id_idx on public.stores (owner_id);
create unique index stores_owner_name_key on public.stores (owner_id, lower(name));

alter table public.stores enable row level security;

create policy stores_select_own on public.stores
  for select to authenticated using (owner_id = auth.uid());
create policy stores_insert_own on public.stores
  for insert to authenticated with check (owner_id = auth.uid());
create policy stores_update_own on public.stores
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy stores_delete_own on public.stores
  for delete to authenticated using (owner_id = auth.uid());

create function public.is_store_owner(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stores where id = sid and owner_id = auth.uid()
  );
$$;

revoke execute on function public.is_store_owner(uuid) from public, anon;
grant execute on function public.is_store_owner(uuid) to authenticated;

-- Sales channels --------------------------------------------------------------
create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  commission_pct numeric not null default 0 check (commission_pct >= 0 and commission_pct < 100),
  fixed_fee integer not null default 0 check (fixed_fee >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);

create index sales_channels_store_id_idx on public.sales_channels (store_id);

alter table public.sales_channels enable row level security;

create policy sales_channels_select on public.sales_channels
  for select to authenticated using (public.is_store_owner(store_id));
create policy sales_channels_insert on public.sales_channels
  for insert to authenticated with check (public.is_store_owner(store_id));
create policy sales_channels_update on public.sales_channels
  for update to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy sales_channels_delete on public.sales_channels
  for delete to authenticated using (public.is_store_owner(store_id));

-- create_store: store + default channel in one transaction ------------------
create function public.create_store(
  p_name text,
  p_business_type text,
  p_operating_days integer,
  p_target_margin numeric,
  p_target_market text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.stores (owner_id, name, business_type, operating_days_per_month, target_margin_pct, target_market)
  values (auth.uid(), trim(p_name), p_business_type, p_operating_days, p_target_margin, p_target_market)
  returning id into v_store_id;

  insert into public.sales_channels (store_id, name, commission_pct, fixed_fee, sort_order)
  values (v_store_id, 'Offline – Tunai', 0, 0, 0);

  return v_store_id;
end;
$$;

revoke execute on function public.create_store(text, text, integer, numeric, text) from public, anon;
grant execute on function public.create_store(text, text, integer, numeric, text) to authenticated;
```

- [ ] **Step 7: Apply and run tests**

Run: `npm run db:reset && npm run test:rls`
Expected: all tests in `core.test.ts` PASS.

If `does not let a user change their own plan` returns a different code, print `error` and confirm it is a permission error; the assertion on `plan` still being `free` is the one that matters — adjust only the code assertion, never weaken the `plan` check.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(db): add profiles, stores, sales_channels with RLS and create_store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Domain schema (materials → ai_analyses) + generated types

**Files:**
- Create: `supabase/migrations/20261016000002_domain.sql`
- Create: `lib/supabase/database.types.ts` (generated)
- Test: `tests/rls/domain.test.ts`

**Interfaces:**
- Consumes: `stores`, `sales_channels`, `is_store_owner` (Task 2); test helpers (Task 2).
- Produces (SQL tables, all with `store_id` + RLS via `is_store_owner`): `materials`, `products`, `product_materials`, `product_channel_prices`, `operating_expenses`, `assets`, `ai_analyses` — columns exactly as spec §3.2–3.7.
- Produces (TS): `Database`, `Tables<"...">`, `TablesInsert<"...">` types from `@/lib/supabase/database.types`.

- [ ] **Step 1: Write the failing domain RLS tests**

Create `tests/rls/domain.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { admin, createStore, createTestUser, type TestUser } from "./helpers";

const rows = {
  materials: (storeId: string) => ({
    store_id: storeId,
    name: "Gula",
    category: "bahan",
    purchase_qty: 1,
    purchase_unit: "kg",
    purchase_price: 18000,
  }),
  products: (storeId: string) => ({ store_id: storeId, name: "Es Kopi Susu" }),
  operating_expenses: (storeId: string) => ({
    store_id: storeId,
    name: "Listrik",
    category: "listrik_air",
    amount: 300000,
    frequency: "bulanan",
  }),
  assets: (storeId: string) => ({
    store_id: storeId,
    name: "Meja",
    category: "furnitur",
    qty: 2,
    unit_price: 500000,
    useful_life_months: 36,
  }),
} as const;

async function insertOne(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table).insert(row).select("id").single();
  if (error) throw error;
  return data.id as string;
}

describe("store-scoped tables", () => {
  let a: TestUser;
  let b: TestUser;
  let storeA: string;

  beforeAll(async () => {
    a = await createTestUser("dom-a");
    b = await createTestUser("dom-b");
    storeA = await createStore(a, "Toko A");
  });

  for (const [table, row] of Object.entries(rows)) {
    it(`${table}: owner can insert and read; others cannot read or insert`, async () => {
      const id = await insertOne(a, table, row(storeA));

      const own = await a.client.from(table).select("id").eq("id", id);
      expect(own.data).toEqual([{ id }]);

      const other = await b.client.from(table).select("id").eq("id", id);
      expect(other.data).toEqual([]);

      const { error } = await b.client.from(table).insert(row(storeA));
      expect(error?.code).toBe("42501");
    });
  }

  it("rejects units outside the supported list", async () => {
    const { error } = await a.client
      .from("materials")
      .insert({ ...rows.materials(storeA), purchase_unit: "sdm" });
    expect(error?.code).toBe("23514");
  });
});

describe("cross-store references", () => {
  let a: TestUser;
  let store1: string;
  let store2: string;
  let product1: string;
  let material1: string;
  let material2: string;
  let channel2: string;

  beforeAll(async () => {
    a = await createTestUser("cross");
    store1 = await createStore(a, "Satu");
    store2 = await createStore(a, "Dua");
    product1 = await insertOne(a, "products", rows.products(store1));
    material1 = await insertOne(a, "materials", rows.materials(store1));
    material2 = await insertOne(a, "materials", rows.materials(store2));
    const { data } = await a.client.from("sales_channels").select("id").eq("store_id", store2).single();
    channel2 = data!.id;
  });

  it("product_materials rejects a material from another store", async () => {
    const { error } = await a.client.from("product_materials").insert({
      store_id: store1,
      product_id: product1,
      material_id: material2,
      qty: 15,
      unit: "g",
    });
    expect(error?.code).toBe("23503");
  });

  it("product_materials rejects a channel from another store", async () => {
    const { error } = await a.client.from("product_materials").insert({
      store_id: store1,
      product_id: product1,
      material_id: material1,
      qty: 1,
      unit: "pcs",
      basis: "unit",
      channel_id: channel2,
    });
    expect(error?.code).toBe("23503");
  });

  it("product_channel_prices rejects a channel from another store", async () => {
    const { error } = await a.client.from("product_channel_prices").insert({
      store_id: store1,
      product_id: product1,
      channel_id: channel2,
      price: 15000,
    });
    expect(error?.code).toBe("23503");
  });

  it("blocks deleting a material that a product uses", async () => {
    await insertOne(a, "product_materials", {
      store_id: store1,
      product_id: product1,
      material_id: material1,
      qty: 15,
      unit: "g",
    });
    const { error } = await a.client.from("materials").delete().eq("id", material1);
    expect(error?.code).toBe("23503");
  });

  it("deleting a store removes all of its data", async () => {
    const { error } = await a.client.from("stores").delete().eq("id", store1);
    expect(error).toBeNull();
    const left = await admin.from("materials").select("id").eq("store_id", store1);
    expect(left.data).toEqual([]);
    const pm = await admin.from("product_materials").select("id").eq("store_id", store1);
    expect(pm.data).toEqual([]);
  });
});

describe("ai_analyses", () => {
  let a: TestUser;
  let b: TestUser;
  let storeA: string;

  beforeAll(async () => {
    a = await createTestUser("ai-a");
    b = await createTestUser("ai-b");
    storeA = await createStore(a, "AI Toko");
  });

  const analysis = (storeId: string, userId: string) => ({
    store_id: storeId,
    user_id: userId,
    model: "test-model",
    snapshot_hash: "abc",
    input_snapshot: {},
    output: { summary: "ok" },
  });

  it("users cannot insert analyses directly", async () => {
    const { error } = await a.client.from("ai_analyses").insert(analysis(storeA, a.id));
    expect(error?.code).toBe("42501");
  });

  it("owner can read analyses written by the server; others cannot", async () => {
    const { error } = await admin.from("ai_analyses").insert(analysis(storeA, a.id));
    expect(error).toBeNull();
    const own = await a.client.from("ai_analyses").select("model").eq("store_id", storeA);
    expect(own.data).toEqual([{ model: "test-model" }]);
    const other = await b.client.from("ai_analyses").select("model").eq("store_id", storeA);
    expect(other.data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:rls -- tests/rls/domain.test.ts`
Expected: FAIL — `relation "public.materials" does not exist` (or PostgREST `PGRST205` table-not-found).

- [ ] **Step 3: Write the domain migration**

Create `supabase/migrations/20261016000002_domain.sql`:

```sql
-- Materials -----------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category text not null check (category in ('bahan', 'kemasan')),
  purchase_qty numeric not null check (purchase_qty > 0),
  purchase_unit text not null check (purchase_unit in ('g', 'ons', 'kg', 'ml', 'l', 'pcs', 'lusin')),
  purchase_price integer not null check (purchase_price >= 0),
  waste_pct numeric not null default 0 check (waste_pct >= 0 and waste_pct < 100),
  created_at timestamptz not null default now(),
  unique (id, store_id)
);
create index materials_store_id_idx on public.materials (store_id);

-- Products ------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category text,
  yield_qty numeric not null default 1 check (yield_qty > 0),
  target_margin_pct numeric check (target_margin_pct >= 0 and target_margin_pct < 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, store_id)
);
create index products_store_id_idx on public.products (store_id);

-- Product composition ---------------------------------------------------------
create table public.product_materials (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null,
  material_id uuid not null,
  qty numeric not null check (qty > 0),
  unit text not null check (unit in ('g', 'ons', 'kg', 'ml', 'l', 'pcs', 'lusin')),
  basis text not null default 'batch' check (basis in ('batch', 'unit')),
  channel_id uuid,
  created_at timestamptz not null default now(),
  foreign key (product_id, store_id) references public.products (id, store_id) on delete cascade,
  -- NO ACTION (not RESTRICT): deleting a used material fails, but deleting the
  -- whole store succeeds because the check runs after all cascades finish.
  foreign key (material_id, store_id) references public.materials (id, store_id) on delete no action,
  foreign key (channel_id, store_id) references public.sales_channels (id, store_id) on delete cascade
);
create index product_materials_store_id_idx on public.product_materials (store_id);
create index product_materials_product_id_idx on public.product_materials (product_id);
create index product_materials_material_id_idx on public.product_materials (material_id);

-- Prices per channel ----------------------------------------------------------
create table public.product_channel_prices (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null,
  channel_id uuid not null,
  price integer not null check (price >= 0),
  est_monthly_sales integer not null default 0 check (est_monthly_sales >= 0),
  competitor_price integer check (competitor_price >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, channel_id),
  foreign key (product_id, store_id) references public.products (id, store_id) on delete cascade,
  foreign key (channel_id, store_id) references public.sales_channels (id, store_id) on delete cascade
);
create index product_channel_prices_store_id_idx on public.product_channel_prices (store_id);

-- Operating expenses ----------------------------------------------------------
create table public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category text not null check (category in (
    'sewa', 'listrik_air', 'internet_pulsa', 'gaji_karyawan', 'gaji_pemilik',
    'transportasi', 'pemasaran', 'lainnya'
  )),
  amount integer not null check (amount >= 0),
  frequency text not null check (frequency in ('harian', 'mingguan', 'bulanan', 'tahunan')),
  created_at timestamptz not null default now()
);
create index operating_expenses_store_id_idx on public.operating_expenses (store_id);

-- Assets ----------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  category text not null check (category in (
    'peralatan', 'furnitur', 'elektronik', 'kendaraan', 'renovasi', 'perizinan', 'lainnya'
  )),
  qty integer not null default 1 check (qty >= 1),
  unit_price integer not null check (unit_price >= 0),
  useful_life_months integer not null check (useful_life_months >= 1),
  created_at timestamptz not null default now()
);
create index assets_store_id_idx on public.assets (store_id);

-- AI analyses (written only by the server with the secret key) --------------
create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  model text not null,
  snapshot_hash text not null,
  input_snapshot jsonb not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);
create index ai_analyses_user_created_idx on public.ai_analyses (user_id, created_at);
create index ai_analyses_store_created_idx on public.ai_analyses (store_id, created_at desc);

alter table public.ai_analyses enable row level security;
create policy ai_analyses_select on public.ai_analyses
  for select to authenticated using (public.is_store_owner(store_id));

-- RLS for owner-editable store tables -------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'materials', 'products', 'product_materials', 'product_channel_prices',
    'operating_expenses', 'assets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_store_owner(store_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_store_owner(store_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_store_owner(store_id))',
      t || '_delete', t);
  end loop;
end;
$$;
```

- [ ] **Step 4: Apply and run all RLS tests**

Run: `npm run db:reset && npm run test:rls`
Expected: `core.test.ts` and `domain.test.ts` all PASS.

- [ ] **Step 5: Generate TypeScript types**

Run: `npm run db:types && npm run typecheck`
Expected: `lib/supabase/database.types.ts` exists and exports `Database`, `Tables`, `TablesInsert`; typecheck passes. Check that `create_store` `Args` show `p_target_market?: string`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add domain tables with RLS, composite FKs, and generated types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Supabase clients, route guard helpers, and proxy

**Files:**
- Create: `lib/uuid.ts`, `lib/auth/paths.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy.ts`, `lib/auth/require-user.ts`, `proxy.ts`
- Test: `tests/unit/uuid.test.ts`, `tests/unit/auth-paths.test.ts`

**Interfaces:**
- Consumes: `Database` (Task 3).
- Produces:
  - `isUuid(value: string): boolean` — `@/lib/uuid`
  - `isProtectedPath(pathname: string): boolean`, `safeNextPath(next: string | null | undefined): string | null`, `DEFAULT_AFTER_LOGIN = "/mulai"` — `@/lib/auth/paths`
  - `createClient(): Promise<SupabaseClient<Database>>` — `@/lib/supabase/server`
  - `createClient(): SupabaseClient<Database>` — `@/lib/supabase/client`
  - `updateSession(request: NextRequest): Promise<NextResponse>` — `@/lib/supabase/proxy`
  - `requireUser(): Promise<{ supabase: SupabaseClient<Database>; userId: string }>` — `@/lib/auth/require-user` (redirects to `/login` when signed out)

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/uuid.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/uuid";

describe("isUuid", () => {
  it.each([
    ["3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c", true],
    ["3F2B8C1E-9D4A-4B7E-8F21-0C5D6E7A8B9C", true],
    ["00000000-0000-0000-0000-000000000000", true],
    ["not-a-uuid", false],
    ["3f2b8c1e9d4a4b7e8f210c5d6e7a8b9c", false],
    ["3f2b8c1e-9d4a-4b7e-8f21-0c5d6e7a8b9c-extra", false],
    ["", false],
  ])("%s → %s", (value, expected) => {
    expect(isUuid(value)).toBe(expected);
  });
});
```

Create `tests/unit/auth-paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "@/lib/auth/paths";

describe("isProtectedPath", () => {
  it.each([
    ["/s/abc/dashboard", true],
    ["/s", true],
    ["/onboarding", true],
    ["/toko", true],
    ["/mulai", true],
    ["/", false],
    ["/login", false],
    ["/auth/callback", false],
    ["/sabun", false],
    ["/tokoh", false],
    ["/privasi", false],
  ])("%s → %s", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/s/abc/dashboard", "/s/abc/dashboard"],
    ["/toko?x=1#a", "/toko?x=1#a"],
    [null, null],
    [undefined, null],
    ["", null],
    ["toko", null],
    ["https://evil.example", null],
    ["//evil.example", null],
    ["/\\evil.example", null],
    ["/\t/evil.example", null],
    ["javascript:alert(1)", null],
  ])("%j → %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/uuid"` and `"@/lib/auth/paths"`.

- [ ] **Step 3: Implement helpers**

Create `lib/uuid.ts`:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
```

Create `lib/auth/paths.ts`:

```ts
const PROTECTED_PREFIXES = ["/s", "/onboarding", "/toko", "/mulai"] as const;

export const DEFAULT_AFTER_LOGIN = "/mulai";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Returns a same-origin path to redirect to, or null if `next` is unsafe. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return null;
  }
  const base = "http://app.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implement Supabase clients**

Create `lib/supabase/server.ts`:

```ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/** Create a new client per request; never store it in a module-level variable. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; proxy.ts refreshes the session.
          }
        },
      },
    },
  );
}
```

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

Create `lib/supabase/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AFTER_LOGIN, isProtectedPath } from "@/lib/auth/paths";
import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectKeepingCookies(url, response);
  }

  if (isLoggedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AFTER_LOGIN;
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
```

Create `proxy.ts` at the repo root:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Create `lib/auth/require-user.ts`:

```ts
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return { supabase, userId: data.claims.sub };
}
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all pass. (Route behavior is verified end-to-end in Task 5.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): add Supabase clients, route guard helpers, and proxy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Login (Google + dev login), callback, sign-out, /mulai, 404, and Playwright

**Files:**
- Create: `lib/forms.ts`, `components/forms/field-error.tsx`, `components/forms/submit-button.tsx`
- Create: `app/login/page.tsx`, `app/login/google-button.tsx`, `app/login/dev-login-form.tsx`, `app/login/actions.ts`
- Create: `app/auth/callback/route.ts`, `app/auth/actions.ts`, `app/mulai/route.ts`, `app/not-found.tsx`
- Create: `playwright.config.ts`, `tests/e2e/helpers.ts`
- Test: `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `safeNextPath`, `DEFAULT_AFTER_LOGIN` (Task 4); server/browser `createClient` (Task 4).
- Produces:
  - `type FormState = { ok?: boolean; message?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined` — `@/lib/forms`
  - `<FieldError errors?: string[] />`, `<SubmitButton pendingText: string, ...ButtonProps />` — `@/components/forms/*`
  - `signOutAction(): Promise<void>` — `@/app/auth/actions`
  - Route `/mulai`: redirects to `/onboarding` when the user has 0 stores, else `/s/<first store id>/dashboard`.
  - E2E helpers: `uniqueEmail(label: string): string`, `devLogin(page: Page, email?: string, next?: string): Promise<string>` — `tests/e2e/helpers.ts`

- [ ] **Step 1: Configure Playwright and write the failing e2e test**

```bash
npx playwright install chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_PUBLIC_ENABLE_DEV_LOGIN: "true" },
  },
});
```

Create `tests/e2e/helpers.ts`:

```ts
import type { Page } from "@playwright/test";

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

export async function devLogin(page: Page, email = uniqueEmail("e2e"), next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123456");
  await page.getByRole("button", { name: "Masuk (dev)" }).click();
  return email;
}
```

Create `tests/e2e/auth.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { devLogin } from "./helpers";

test("signed-out user is sent to login with a next param", async ({ page }) => {
  await page.goto("/toko");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoko$/);
  await expect(page.getByRole("button", { name: "Masuk dengan Google" })).toBeVisible();
});

test("new user lands on onboarding after login", async ({ page }) => {
  await devLogin(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("an external next param is ignored", async ({ page }) => {
  await devLogin(page, undefined, "https://evil.example/steal");
  await expect(page).toHaveURL(/^http:\/\/localhost:3100\/onboarding$/);
});

test("signed-in user visiting /login is redirected into the app", async ({ page }) => {
  await devLogin(page);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("unknown pages show the Indonesian 404", async ({ page }) => {
  await page.goto("/halaman-yang-tidak-ada");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});
```

Run: `npm run test:e2e -- tests/e2e/auth.spec.ts`
Expected: FAIL — login page has no "Masuk dengan Google" button / 404 heading missing.

- [ ] **Step 2: Add form primitives**

Create `lib/forms.ts`:

```ts
export type FormState =
  | {
      ok?: boolean;
      message?: string;
      fieldErrors?: Record<string, string[] | undefined>;
    }
  | undefined;
```

Create `components/forms/field-error.tsx`:

```tsx
export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}
```

Create `components/forms/submit-button.tsx`:

```tsx
"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = ComponentProps<typeof Button> & { pendingText: string };

export function SubmitButton({ children, pendingText, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
```

- [ ] **Step 3: Implement login page, Google button, dev login**

Create `app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/**
 * Local-only email/password login. Production stays safe even if the flag leaks:
 * the Email provider is disabled in the production Supabase project.
 */
export async function devLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== "true") {
    return { message: "Login dev tidak aktif." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? DEFAULT_AFTER_LOGIN;

  if (!email || password.length < 6) {
    return { message: "Isi email dan password (minimal 6 karakter)." };
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error || !signUp.data.session) {
      return { message: signUp.error?.message ?? "Gagal masuk." };
    }
  }

  redirect(next);
}
```

Create `app/login/dev-login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { devLoginAction } from "./actions";

export function DevLoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(devLoginAction, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-xs font-medium text-muted-foreground">Mode pengembangan</p>
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1">
        <Label htmlFor="dev-email">Email</Label>
        <Input id="dev-email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="dev-password">Password</Label>
        <Input id="dev-password" name="password" type="password" minLength={6} required />
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <SubmitButton variant="secondary" className="w-full" pendingText="Masuk…">
        Masuk (dev)
      </SubmitButton>
    </form>
  );
}
```

Create `app/login/google-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError("Gagal membuka login Google. Coba lagi.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={signIn} disabled={pending} size="lg" className="w-full">
        {pending ? "Membuka Google…" : "Masuk dengan Google"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

Create `app/login/page.tsx`:

```tsx
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { DevLoginForm } from "./dev-login-form";
import { GoogleSignInButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next) ?? DEFAULT_AFTER_LOGIN;
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Masuk ke BusinessNote</h1>
        <p className="text-sm text-muted-foreground">
          Hitung HPP, harga jual, dan laba usahamu.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Gagal masuk. Silakan coba lagi.
        </p>
      )}
      <GoogleSignInButton next={target} />
      {devLogin && <DevLoginForm next={target} />}
    </main>
  );
}
```

- [ ] **Step 4: Implement callback, sign-out, /mulai, 404**

Create `app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next")) ?? DEFAULT_AFTER_LOGIN;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
```

Create `app/auth/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

Create `app/mulai/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;

  const target = data.length === 0 ? "/onboarding" : `/s/${data[0].id}/dashboard`;
  return NextResponse.redirect(new URL(target, request.url));
}
```

Create `app/not-found.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">
        Halaman ini tidak ada, atau kamu tidak punya akses ke sana.
      </p>
      <Link href="/mulai" className={buttonVariants()}>
        Kembali ke aplikasi
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Run e2e to verify it passes**

Run: `npm run test:e2e -- tests/e2e/auth.spec.ts`
Expected: PASS on both `mobile` and `desktop` projects. (`/onboarding` itself renders the 404 until Task 6 — the tests only assert the URL.)

- [ ] **Step 6: Verify the rest**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(auth): add Google and dev login, OAuth callback, sign-out, 404

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Store validation, plan limits, and onboarding wizard

**Files:**
- Create: `lib/validation/number.ts`, `lib/validation/store.ts`, `lib/config/plans.ts`, `lib/data/stores.ts`
- Create: `components/store/store-fields.tsx`
- Create: `app/onboarding/page.tsx`, `app/onboarding/onboarding-form.tsx`, `app/onboarding/actions.ts`
- Test: `tests/unit/store-validation.test.ts`, `tests/unit/plans.test.ts`, `tests/e2e/onboarding.spec.ts`

**Interfaces:**
- Consumes: `requireUser` (Task 4); `FormState`, `FieldError`, `SubmitButton` (Task 5); `Database`, `Tables` (Task 3); `devLogin` (Task 5).
- Produces:
  - `localeNumber<T extends z.ZodType>(inner: T)` — `@/lib/validation/number`
  - `BUSINESS_TYPES`, `TARGET_MARKETS`, `type BusinessType`, `type TargetMarket`, `BUSINESS_TYPE_LABELS: Record<BusinessType, string>`, `TARGET_MARKET_LABELS: Record<TargetMarket, string>`, `businessTypeLabel(value: string): string`, `storeInputSchema`, `type StoreInput`, `toStoreColumns(input: StoreInput)`, `confirmationMatches(input: string, storeName: string): boolean`, `STORE_DEFAULTS`, `DUPLICATE_STORE_NAME_MESSAGE` — `@/lib/validation/store`
  - `PLAN_LIMITS`, `type Plan`, `toPlan(value: string | null | undefined): Plan`, `canCreateStore(plan: Plan, currentCount: number): boolean` — `@/lib/config/plans`
  - `type Store = Tables<"stores">`, `getStore(storeId: string): Promise<Store | null>`, `listStores(): Promise<StoreSummary[]>`, `type StoreSummary = Pick<Store, "id" | "name" | "business_type">` — `@/lib/data/stores` (both wrapped in React `cache`)
  - `<StoreFields section: "identity" | "operations"; defaults?: StoreFieldDefaults; errors?: Record<string, string[] | undefined> />`, `type StoreFieldDefaults` — `@/components/store/store-fields`
  - E2E helper `createStoreViaOnboarding(page: Page, name: string, margin?: string): Promise<void>` appended to `tests/e2e/helpers.ts`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/store-validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  storeInputSchema,
  toStoreColumns,
} from "@/lib/validation/store";

const valid = {
  name: "  Kopi Senja  ",
  businessType: "minuman",
  targetMarket: "",
  operatingDaysPerMonth: "26",
  targetMarginPct: "40",
};

function errorsFor(input: Record<string, unknown>) {
  const result = storeInputSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("storeInputSchema", () => {
  it("parses a valid form and trims the name", () => {
    expect(storeInputSchema.parse(valid)).toEqual({
      name: "Kopi Senja",
      businessType: "minuman",
      targetMarket: null,
      operatingDaysPerMonth: 26,
      targetMarginPct: 40,
    });
  });

  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["40%", 40],
    [" 35 % ", 35],
    ["0", 0],
  ])("accepts margin %j as %d", (raw, expected) => {
    expect(storeInputSchema.parse({ ...valid, targetMarginPct: raw }).targetMarginPct).toBe(expected);
  });

  it("accepts operating days with surrounding spaces", () => {
    expect(storeInputSchema.parse({ ...valid, operatingDaysPerMonth: " 30 " }).operatingDaysPerMonth).toBe(30);
  });

  it("accepts a target market", () => {
    expect(storeInputSchema.parse({ ...valid, targetMarket: "menengah" }).targetMarket).toBe("menengah");
  });

  it.each([
    [{ name: "   " }, "name", "Nama toko wajib diisi"],
    [{ name: "x".repeat(61) }, "name", "Nama toko maksimal 60 karakter"],
    [{ businessType: "jasa" }, "businessType", "Pilih jenis usaha"],
    [{ targetMarket: "kaya" }, "targetMarket", "Pilih target pasar yang tersedia"],
    [{ targetMarginPct: "" }, "targetMarginPct", "Isi target margin dengan angka"],
    [{ targetMarginPct: "abc" }, "targetMarginPct", "Isi target margin dengan angka"],
    [{ targetMarginPct: "100" }, "targetMarginPct", "Target margin harus kurang dari 100%"],
    [{ targetMarginPct: "-5" }, "targetMarginPct", "Target margin minimal 0%"],
    [{ operatingDaysPerMonth: "" }, "operatingDaysPerMonth", "Isi jumlah hari buka dengan angka"],
    [{ operatingDaysPerMonth: "0" }, "operatingDaysPerMonth", "Minimal 1 hari"],
    [{ operatingDaysPerMonth: "32" }, "operatingDaysPerMonth", "Maksimal 31 hari"],
    [{ operatingDaysPerMonth: "25,5" }, "operatingDaysPerMonth", "Jumlah hari harus bilangan bulat"],
  ])("rejects %j", (patch, field, message) => {
    expect(errorsFor({ ...valid, ...patch })[field]).toBe(message);
  });
});

describe("toStoreColumns", () => {
  it("maps form fields to database columns", () => {
    expect(
      toStoreColumns({
        name: "Kopi",
        businessType: "minuman",
        targetMarket: null,
        operatingDaysPerMonth: 26,
        targetMarginPct: 40,
      }),
    ).toEqual({
      name: "Kopi",
      business_type: "minuman",
      target_market: null,
      operating_days_per_month: 26,
      target_margin_pct: 40,
    });
  });
});

describe("confirmationMatches", () => {
  it.each([
    ["Kopi Senja", "Kopi Senja", true],
    ["  Kopi Senja ", "Kopi Senja", true],
    ["kopi senja", "Kopi Senja", false],
    ["", "Kopi Senja", false],
  ])("%j vs %j → %s", (input, name, expected) => {
    expect(confirmationMatches(input, name)).toBe(expected);
  });
});
```

Create `tests/unit/plans.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canCreateStore, PLAN_LIMITS, toPlan } from "@/lib/config/plans";

describe("plans", () => {
  it("has the limits from the spec", () => {
    expect(PLAN_LIMITS).toEqual({
      free: { maxStores: 2, aiAnalysesPerDay: 3 },
      pro: { maxStores: 10, aiAnalysesPerDay: 20 },
    });
  });

  it.each([
    ["free", 0, true],
    ["free", 1, true],
    ["free", 2, false],
    ["pro", 9, true],
    ["pro", 10, false],
  ] as const)("%s with %d stores → %s", (plan, count, expected) => {
    expect(canCreateStore(plan, count)).toBe(expected);
  });

  it.each([
    ["pro", "pro"],
    ["free", "free"],
    ["enterprise", "free"],
    [null, "free"],
    [undefined, "free"],
  ])("toPlan(%j) → %s", (value, expected) => {
    expect(toPlan(value)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/validation/store` and `@/lib/config/plans`.

- [ ] **Step 3: Implement number parsing, store schema, plans**

Create `lib/validation/number.ts`:

```ts
import { z } from "zod";

/**
 * Parses numbers typed the Indonesian way: "12,5" → 12.5, "1.000,5" → 1000.5,
 * a trailing "%" is ignored. Without a comma, "." is the decimal point ("12.5").
 * Blank input becomes undefined so `inner` reports its required-field message.
 */
export function localeNumber<T extends z.ZodType>(inner: T) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    let s = value.trim().replace(/%$/, "").trim();
    if (s === "") return undefined;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return Number(s);
  }, inner);
}
```

Create `lib/validation/store.ts`:

```ts
import { z } from "zod";
import { localeNumber } from "./number";

export const BUSINESS_TYPES = [
  "makanan",
  "minuman",
  "kue_roti",
  "katering",
  "produk_olahan",
  "lainnya",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  makanan: "Makanan",
  minuman: "Minuman",
  kue_roti: "Kue & roti",
  katering: "Katering",
  produk_olahan: "Produk olahan (sabun, lilin, kerajinan, dll.)",
  lainnya: "Lainnya",
};

export function businessTypeLabel(value: string): string {
  return (BUSINESS_TYPE_LABELS as Record<string, string>)[value] ?? value;
}

export const TARGET_MARKETS = ["menengah_bawah", "menengah", "menengah_atas"] as const;
export type TargetMarket = (typeof TARGET_MARKETS)[number];

export const TARGET_MARKET_LABELS: Record<TargetMarket, string> = {
  menengah_bawah: "Menengah ke bawah",
  menengah: "Menengah",
  menengah_atas: "Menengah ke atas",
};

export const STORE_DEFAULTS = { operatingDaysPerMonth: 26, targetMarginPct: 40 } as const;

export const DUPLICATE_STORE_NAME_MESSAGE = "Kamu sudah punya toko dengan nama ini.";

export const storeInputSchema = z.object({
  name: z
    .string({ error: "Nama toko wajib diisi" })
    .trim()
    .min(1, "Nama toko wajib diisi")
    .max(60, "Nama toko maksimal 60 karakter"),
  businessType: z.enum(BUSINESS_TYPES, { error: "Pilih jenis usaha" }),
  targetMarket: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(TARGET_MARKETS, { error: "Pilih target pasar yang tersedia" }).nullable(),
  ),
  operatingDaysPerMonth: localeNumber(
    z
      .number({ error: "Isi jumlah hari buka dengan angka" })
      .int("Jumlah hari harus bilangan bulat")
      .min(1, "Minimal 1 hari")
      .max(31, "Maksimal 31 hari"),
  ),
  targetMarginPct: localeNumber(
    z
      .number({ error: "Isi target margin dengan angka" })
      .min(0, "Target margin minimal 0%")
      .lt(100, "Target margin harus kurang dari 100%"),
  ),
});

export type StoreInput = z.infer<typeof storeInputSchema>;

export function toStoreColumns(input: StoreInput) {
  return {
    name: input.name,
    business_type: input.businessType,
    target_market: input.targetMarket,
    operating_days_per_month: input.operatingDaysPerMonth,
    target_margin_pct: input.targetMarginPct,
  };
}

/** Delete confirmation: surrounding spaces ignored, case-sensitive. */
export function confirmationMatches(input: string, storeName: string): boolean {
  return input.trim() !== "" && input.trim() === storeName.trim();
}
```

Create `lib/config/plans.ts`:

```ts
export const PLAN_LIMITS = {
  free: { maxStores: 2, aiAnalysesPerDay: 3 },
  pro: { maxStores: 10, aiAnalysesPerDay: 20 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export function toPlan(value: string | null | undefined): Plan {
  return value === "pro" ? "pro" : "free";
}

export function canCreateStore(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxStores;
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npm test`
Expected: PASS. If the `"abc"` case reports zod's default message instead of `"Isi target margin dengan angka"`, the `error` option on `z.number` is not being applied to `NaN` — fix by keeping `error` on `z.number(...)` (zod 4 treats `NaN` as `invalid_type`), not by changing the test.

- [ ] **Step 5: Add store data access**

Create `lib/data/stores.ts`:

```ts
import "server-only";
import { cache } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type Store = Tables<"stores">;
export type StoreSummary = Pick<Store, "id" | "name" | "business_type">;

/** RLS returns nothing for stores the user does not own, so null means 404. */
export const getStore = cache(async (storeId: string): Promise<Store | null> => {
  if (!isUuid(storeId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("stores").select("*").eq("id", storeId).maybeSingle();
  if (error) throw error;
  return data;
});

export const listStores = cache(async (): Promise<StoreSummary[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, business_type")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
});
```

- [ ] **Step 6: Add shared store fields**

Create `components/store/store-fields.tsx`:

```tsx
import { FieldError } from "@/components/forms/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  STORE_DEFAULTS,
  TARGET_MARKETS,
  TARGET_MARKET_LABELS,
} from "@/lib/validation/store";

export type StoreFieldDefaults = {
  name?: string;
  businessType?: string;
  targetMarket?: string | null;
  operatingDaysPerMonth?: number;
  targetMarginPct?: number;
};

type Props = {
  section: "identity" | "operations";
  defaults?: StoreFieldDefaults;
  errors?: Record<string, string[] | undefined>;
};

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StoreFields({ section, defaults = {}, errors = {} }: Props) {
  if (section === "identity") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">Nama toko</Label>
          <Input id="name" name="name" defaultValue={defaults.name} maxLength={60} required />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="businessType">Jenis usaha</Label>
          <select
            id="businessType"
            name="businessType"
            defaultValue={defaults.businessType ?? ""}
            required
            className={selectClass}
          >
            <option value="" disabled>
              Pilih jenis usaha
            </option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {BUSINESS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError errors={errors.businessType} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="targetMarket">Target pasar (opsional)</Label>
          <select
            id="targetMarket"
            name="targetMarket"
            defaultValue={defaults.targetMarket ?? ""}
            className={selectClass}
          >
            <option value="">Belum tahu</option>
            {TARGET_MARKETS.map((market) => (
              <option key={market} value={market}>
                {TARGET_MARKET_LABELS[market]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Dipakai untuk menyesuaikan saran harga.
          </p>
          <FieldError errors={errors.targetMarket} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="operatingDaysPerMonth">Hari buka per bulan</Label>
        <Input
          id="operatingDaysPerMonth"
          name="operatingDaysPerMonth"
          inputMode="numeric"
          defaultValue={defaults.operatingDaysPerMonth ?? STORE_DEFAULTS.operatingDaysPerMonth}
          required
        />
        <p className="text-xs text-muted-foreground">
          Dipakai untuk menghitung biaya harian dan target penjualan per hari.
        </p>
        <FieldError errors={errors.operatingDaysPerMonth} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="targetMarginPct">Target margin (%)</Label>
        <Input
          id="targetMarginPct"
          name="targetMarginPct"
          inputMode="decimal"
          defaultValue={defaults.targetMarginPct ?? STORE_DEFAULTS.targetMarginPct}
          required
        />
        <p className="text-xs text-muted-foreground">
          Margin 40% artinya 40% dari harga jual adalah untung. Ini berbeda dengan markup 40%
          (harga = modal + 40%), yang hanya memberi margin sekitar 29%.
        </p>
        <FieldError errors={errors.targetMarginPct} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implement the create-store action**

Create `app/onboarding/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { canCreateStore, PLAN_LIMITS, toPlan } from "@/lib/config/plans";
import type { FormState } from "@/lib/forms";
import { DUPLICATE_STORE_NAME_MESSAGE, storeInputSchema } from "@/lib/validation/store";

export async function createStoreAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = storeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { supabase, userId } = await requireUser();

  const [profile, stores] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).single(),
    supabase.from("stores").select("id", { count: "exact", head: true }),
  ]);
  const plan = toPlan(profile.data?.plan);
  if (!canCreateStore(plan, stores.count ?? 0)) {
    return {
      message: `Batas jumlah toko untuk paketmu sudah tercapai (maksimal ${PLAN_LIMITS[plan].maxStores} toko).`,
    };
  }

  const input = parsed.data;
  const { data: storeId, error } = await supabase.rpc("create_store", {
    p_name: input.name,
    p_business_type: input.businessType,
    p_operating_days: input.operatingDaysPerMonth,
    p_target_margin: input.targetMarginPct,
    p_target_market: input.targetMarket ?? undefined,
  });

  if (error?.code === "23505") {
    return { fieldErrors: { name: [DUPLICATE_STORE_NAME_MESSAGE] } };
  }
  if (error || !storeId) {
    return { message: "Gagal membuat toko. Coba lagi." };
  }

  redirect(`/s/${storeId}/dashboard`);
}
```

- [ ] **Step 8: Implement the wizard**

Create `app/onboarding/onboarding-form.tsx`:

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { StoreFields } from "@/components/store/store-fields";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { createStoreAction } from "./actions";

const IDENTITY_FIELDS = ["name", "businessType", "targetMarket"] as const;

function hasIdentityError(state: FormState) {
  return IDENTITY_FIELDS.some((field) => state?.fieldErrors?.[field]?.length);
}

export function OnboardingForm() {
  const [state, formAction] = useActionState(createStoreAction, undefined);
  const [step, setStep] = useState<1 | 2>(1);
  const [seenState, setSeenState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);

  // When the server reports an error on step-1 fields, jump back to step 1.
  if (state !== seenState) {
    setSeenState(state);
    if (hasIdentityError(state)) setStep(1);
  }

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    const fields = ["name", "businessType"].map(
      (name) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement,
    );
    if (fields.every((field) => field.reportValidity())) setStep(2);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <p className="text-sm text-muted-foreground">Langkah {step} dari 2</p>

      <div hidden={step !== 1} className="space-y-6">
        <StoreFields section="identity" errors={state?.fieldErrors} />
        <Button type="button" className="w-full" onClick={goNext}>
          Lanjut
        </Button>
      </div>

      <div hidden={step !== 2} className="space-y-6">
        <StoreFields section="operations" errors={state?.fieldErrors} />
        {state?.message && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.message}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Kembali
          </Button>
          <SubmitButton className="flex-1" pendingText="Membuat toko…">
            Buat toko
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
```

Create `app/onboarding/page.tsx`:

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { listStores } from "@/lib/data/stores";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();
  const stores = await listStores();
  const isFirstStore = stores.length === 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {isFirstStore ? "Selamat datang! Buat tokomu" : "Tambah toko baru"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Cukup isi data dasar. Semua bisa diubah nanti di Pengaturan.
        </p>
      </div>
      <OnboardingForm />
      {!isFirstStore && (
        <Link href="/toko" className="block text-center text-sm text-muted-foreground underline">
          Batal
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 9: Write the onboarding e2e test**

Replace `tests/e2e/helpers.ts` with:

```ts
import { expect, type Page } from "@playwright/test";

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

export async function devLogin(page: Page, email = uniqueEmail("e2e"), next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123456");
  await page.getByRole("button", { name: "Masuk (dev)" }).click();
  return email;
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
```

Create `tests/e2e/onboarding.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await devLogin(page);
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("creates a store and lands on its dashboard", async ({ page }) => {
  await createStoreViaOnboarding(page, "Kopi Senja");
});

test("accepts a margin typed with a decimal comma", async ({ page }) => {
  await createStoreViaOnboarding(page, "Kue Bunda", "12,5");
});

test("does not advance to step 2 without a store name", async ({ page }) => {
  await page.getByRole("button", { name: "Lanjut" }).click();
  await expect(page.getByLabel("Target margin (%)")).toBeHidden();
  await expect(page.getByText("Langkah 1 dari 2")).toBeVisible();
});

test("shows an Indonesian error for a 100% margin", async ({ page }) => {
  await page.getByLabel("Nama toko").fill("Toko Margin");
  await page.getByLabel("Jenis usaha").selectOption("makanan");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Target margin (%)").fill("100");
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page.getByText("Target margin harus kurang dari 100%")).toBeVisible();
});

test("rejects a duplicate store name and returns to step 1", async ({ page }) => {
  await createStoreViaOnboarding(page, "Warung Sama");
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill("warung sama");
  await page.getByLabel("Jenis usaha").selectOption("makanan");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page.getByText("Kamu sudah punya toko dengan nama ini.")).toBeVisible();
  await expect(page.getByLabel("Nama toko")).toBeVisible();
});

test("stops a free user at 2 stores", async ({ page }) => {
  await createStoreViaOnboarding(page, "Toko Satu");
  await createStoreViaOnboarding(page, "Toko Dua");
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill("Toko Tiga");
  await page.getByLabel("Jenis usaha").selectOption("makanan");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Buat toko" }).click();
  await expect(page.getByText(/Batas jumlah toko untuk paketmu sudah tercapai/)).toBeVisible();
});
```

- [ ] **Step 10: Run tests**

Run: `npm test && npm run test:e2e -- tests/e2e/onboarding.spec.ts tests/e2e/auth.spec.ts`
Expected: PASS. (The dashboard page renders the 404 until Task 7; the onboarding tests only assert the URL.)

- [ ] **Step 11: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: pass.

```bash
git add -A
git commit -m "feat(onboarding): add store validation, plan limits, and 2-step wizard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Store shell — layout, navigation, dashboard, store list

**Files:**
- Create: `lib/format.ts`, `lib/nav.ts`, `components/store/store-nav.tsx`
- Create: `app/s/[storeId]/layout.tsx`, `app/s/[storeId]/dashboard/page.tsx`, `app/toko/page.tsx`
- Test: `tests/unit/format.test.ts`, `tests/unit/nav.test.ts`, `tests/e2e/store-shell.spec.ts`

**Interfaces:**
- Consumes: `getStore`, `listStores`, `businessTypeLabel` (Task 6); `signOutAction`, `SubmitButton` (Task 5); `createStoreViaOnboarding`, `devLogin` (Tasks 5–6).
- Produces:
  - `formatPercent(value: number): string` — `@/lib/format` (`12.5` → `"12,5%"`)
  - `type StoreNavItem = { label: string; href: string; icon: LucideIcon }`, `storeNavItems(storeId: string): StoreNavItem[]`, `isNavActive(pathname: string, href: string): boolean` — `@/lib/nav`. Later phases add items to `storeNavItems`.
  - `<StoreNav storeId: string; variant: "sidebar" | "bottom" />` — `@/components/store/store-nav`

- [ ] **Step 1: Write failing unit tests**

Create `tests/unit/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPercent } from "@/lib/format";

describe("formatPercent", () => {
  it.each([
    [40, "40%"],
    [12.5, "12,5%"],
    [33.333, "33,3%"],
    [0, "0%"],
  ])("%d → %s", (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});
```

Create `tests/unit/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isNavActive, storeNavItems } from "@/lib/nav";

describe("storeNavItems", () => {
  it("builds store-scoped links", () => {
    expect(storeNavItems("abc").map((i) => [i.label, i.href])).toEqual([
      ["Dashboard", "/s/abc/dashboard"],
      ["Pengaturan", "/s/abc/pengaturan"],
    ]);
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/format` and `@/lib/nav`.

- [ ] **Step 3: Implement format and nav**

Create `lib/format.ts`:

```ts
const percentFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}
```

Create `lib/nav.ts`:

```ts
import { LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type StoreNavItem = { label: string; href: string; icon: LucideIcon };

export function storeNavItems(storeId: string): StoreNavItem[] {
  return [
    { label: "Dashboard", href: `/s/${storeId}/dashboard`, icon: LayoutDashboard },
    { label: "Pengaturan", href: `/s/${storeId}/pengaturan`, icon: Settings },
  ];
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Implement nav component, layout, dashboard, store list**

Create `components/store/store-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, storeNavItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function StoreNav({ storeId, variant }: { storeId: string; variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  const items = storeNavItems(storeId);

  if (variant === "bottom") {
    return (
      <nav
        aria-label="Menu toko"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Menu toko" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Create `app/s/[storeId]/layout.tsx`:

```tsx
import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { StoreNav } from "@/components/store/store-nav";
import { buttonVariants } from "@/components/ui/button";
import { getStore } from "@/lib/data/stores";

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
        <p className="mb-4 px-3 text-sm font-semibold">BusinessNote</p>
        <StoreNav storeId={store.id} variant="sidebar" />
      </aside>
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-3 md:px-8">
          <Link
            href="/toko"
            aria-label="Ganti toko"
            className={buttonVariants({ variant: "outline", className: "max-w-[65vw] justify-between gap-2" })}
          >
            <span className="truncate">{store.name}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </Link>
          <form action={signOutAction}>
            <SubmitButton variant="ghost" size="sm" pendingText="Keluar…">
              Keluar
            </SubmitButton>
          </form>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
      <StoreNav storeId={store.id} variant="bottom" />
    </div>
  );
}
```

Create `app/s/[storeId]/dashboard/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/data/stores";
import { formatPercent } from "@/lib/format";
import { businessTypeLabel } from "@/lib/validation/store";

export default async function DashboardPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dasar perhitungan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Hari buka per bulan</p>
            <p className="text-lg font-medium">{store.operating_days_per_month} hari</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target margin</p>
            <p className="text-lg font-medium">{formatPercent(store.target_margin_pct)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

Create `app/toko/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { listStores } from "@/lib/data/stores";
import { businessTypeLabel } from "@/lib/validation/store";

export default async function StoresPage() {
  const stores = await listStores();
  if (stores.length === 0) redirect("/onboarding");

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Toko kamu</h1>
        <form action={signOutAction}>
          <SubmitButton variant="ghost" size="sm" pendingText="Keluar…">
            Keluar
          </SubmitButton>
        </form>
      </div>
      <ul className="space-y-2">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              href={`/s/${store.id}/dashboard`}
              className="block rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <p className="font-medium">{store.name}</p>
              <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/onboarding" className={buttonVariants({ className: "w-full" })}>
        Tambah toko
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Write the store-shell e2e test**

Create `tests/e2e/store-shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test("dashboard shows the store name and settings", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Kedai Pagi", "12,5");
  await expect(page.getByRole("heading", { name: "Kedai Pagi" })).toBeVisible();
  await expect(page.getByText("12,5%")).toBeVisible();
  await expect(page.getByText("26 hari")).toBeVisible();
});

test("switches between stores via the store list", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Pertama");
  await createStoreViaOnboarding(page, "Toko Kedua");
  await page.getByRole("link", { name: "Ganti toko" }).click();
  await expect(page).toHaveURL(/\/toko$/);
  await page.getByRole("link", { name: /Toko Pertama/ }).click();
  await expect(page.getByRole("heading", { name: "Toko Pertama" })).toBeVisible();
});

test("store menu navigates to settings", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Menu");
  await page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Pengaturan" }).click();
  await expect(page).toHaveURL(/\/pengaturan$/);
});

test("malformed and unknown store ids show the 404 page", async ({ page }) => {
  await devLogin(page);
  await page.goto("/s/bukan-uuid/dashboard");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await page.goto("/s/00000000-0000-0000-0000-000000000000/dashboard");
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
});

test("another user's store shows the 404 page", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await devLogin(owner);
  await createStoreViaOnboarding(owner, "Toko Rahasia");
  const storeUrl = new URL(owner.url()).pathname;
  await ownerContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await devLogin(other);
  await other.goto(storeUrl);
  await expect(other.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  await expect(other.getByText("Toko Rahasia")).toHaveCount(0);
  await otherContext.close();
});

test("double-clicking 'Buat toko' creates only one store", async ({ page }) => {
  await devLogin(page);
  await page.goto("/onboarding");
  await page.getByLabel("Nama toko").fill("Toko Sekali");
  await page.getByLabel("Jenis usaha").selectOption("minuman");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Buat toko" }).dblclick();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard$/);
  await page.goto("/toko");
  await expect(page.getByRole("link", { name: /Toko Sekali/ })).toHaveCount(1);
});

test("signing out returns to the landing page and protects the app", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Keluar");
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/toko");
  await expect(page).toHaveURL(/\/login\?next=%2Ftoko$/);
});
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run test:e2e -- tests/e2e/store-shell.spec.ts`
Expected: PASS. (`store menu navigates to settings` asserts only the URL; `/pengaturan` renders the 404 until Task 8.)

- [ ] **Step 7: Verify and commit**

Run: `npm run typecheck && npm run lint && npm run test:e2e`
Expected: pass.

```bash
git add -A
git commit -m "feat(store): add store shell with navigation, dashboard, and store list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Store settings — edit and delete

**Files:**
- Create: `app/s/[storeId]/pengaturan/page.tsx`, `app/s/[storeId]/pengaturan/settings-form.tsx`, `app/s/[storeId]/pengaturan/delete-store-form.tsx`, `app/s/[storeId]/pengaturan/actions.ts`
- Test: `tests/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `storeInputSchema`, `toStoreColumns`, `confirmationMatches`, `DUPLICATE_STORE_NAME_MESSAGE` (Task 6); `StoreFields` (Task 6); `getStore` (Task 6); `requireUser` (Task 4); `isUuid` (Task 4); `FormState`, `SubmitButton`, `FieldError` (Task 5).
- Produces: `updateStoreAction(storeId: string, prev: FormState, formData: FormData): Promise<FormState>`, `deleteStoreAction(storeId: string, prev: FormState, formData: FormData): Promise<FormState>`.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/settings.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test.beforeEach(async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Lama");
  await page.goto(page.url().replace(/dashboard$/, "pengaturan"));
});

test("renames the store and updates the margin", async ({ page }) => {
  await page.getByLabel("Nama toko").fill("Toko Baru");
  await page.getByLabel("Target margin (%)").fill("35,5");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Perubahan tersimpan.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ganti toko" })).toHaveText("Toko Baru");
  await page.getByRole("navigation", { name: "Menu toko" }).getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByText("35,5%")).toBeVisible();
});

test("shows field errors without saving", async ({ page }) => {
  await page.getByLabel("Hari buka per bulan").fill("40");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.getByText("Maksimal 31 hari")).toBeVisible();
});

test("refuses to delete when the confirmation does not match", async ({ page }) => {
  await page.getByLabel("Ketik nama toko untuk konfirmasi").fill("toko lama");
  await page.getByRole("button", { name: "Hapus toko" }).click();
  await expect(page.getByText("Nama toko tidak cocok.")).toBeVisible();
});

test("deletes the store and returns to onboarding when none are left", async ({ page }) => {
  await page.getByLabel("Ketik nama toko untuk konfirmasi").fill("Toko Lama");
  await page.getByRole("button", { name: "Hapus toko" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
});
```

Run: `npm run test:e2e -- tests/e2e/settings.spec.ts`
Expected: FAIL — settings page renders the 404.

- [ ] **Step 2: Implement actions**

Create `app/s/[storeId]/pengaturan/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import type { FormState } from "@/lib/forms";
import { isUuid } from "@/lib/uuid";
import {
  confirmationMatches,
  DUPLICATE_STORE_NAME_MESSAGE,
  storeInputSchema,
  toStoreColumns,
} from "@/lib/validation/store";

export async function updateStoreAction(
  storeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(storeId)) return { message: "Toko tidak ditemukan." };

  const parsed = storeInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("stores")
    .update(toStoreColumns(parsed.data))
    .eq("id", storeId)
    .select("id");

  if (error?.code === "23505") {
    return { fieldErrors: { name: [DUPLICATE_STORE_NAME_MESSAGE] } };
  }
  if (error || !data?.length) {
    return { message: "Gagal menyimpan. Coba lagi." };
  }

  revalidatePath(`/s/${storeId}`, "layout");
  return { ok: true, message: "Perubahan tersimpan." };
}

export async function deleteStoreAction(
  storeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(storeId)) return { message: "Toko tidak ditemukan." };

  const { supabase } = await requireUser();
  const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).maybeSingle();
  if (!store) return { message: "Toko tidak ditemukan." };

  const confirmation = String(formData.get("confirmName") ?? "");
  if (!confirmationMatches(confirmation, store.name)) {
    return { fieldErrors: { confirmName: ["Nama toko tidak cocok."] } };
  }

  const { error } = await supabase.from("stores").delete().eq("id", storeId);
  if (error) return { message: "Gagal menghapus toko. Coba lagi." };

  revalidatePath("/", "layout");
  redirect("/mulai");
}
```

- [ ] **Step 3: Implement forms and page**

Create `app/s/[storeId]/pengaturan/settings-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { StoreFields, type StoreFieldDefaults } from "@/components/store/store-fields";
import { updateStoreAction } from "./actions";

export function SettingsForm({ storeId, defaults }: { storeId: string; defaults: StoreFieldDefaults }) {
  const [state, formAction] = useActionState(updateStoreAction.bind(null, storeId), undefined);

  return (
    <form action={formAction} className="space-y-6">
      <StoreFields section="identity" defaults={defaults} errors={state?.fieldErrors} />
      <StoreFields section="operations" defaults={defaults} errors={state?.fieldErrors} />
      {state?.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}
        >
          {state.message}
        </p>
      )}
      <SubmitButton className="w-full sm:w-auto" pendingText="Menyimpan…">
        Simpan perubahan
      </SubmitButton>
    </form>
  );
}
```

Create `app/s/[storeId]/pengaturan/delete-store-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { FieldError } from "@/components/forms/field-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteStoreAction } from "./actions";

export function DeleteStoreForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [state, formAction] = useActionState(deleteStoreAction.bind(null, storeId), undefined);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Semua bahan, produk, biaya, inventaris, dan analisis di toko ini akan terhapus permanen.
        Ketik <span className="font-medium text-foreground">{storeName}</span> untuk melanjutkan.
      </p>
      <div className="space-y-1">
        <Label htmlFor="confirmName">Ketik nama toko untuk konfirmasi</Label>
        <Input id="confirmName" name="confirmName" autoComplete="off" required />
        <FieldError errors={state?.fieldErrors?.confirmName} />
      </div>
      {state?.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <SubmitButton variant="destructive" pendingText="Menghapus…">
        Hapus toko
      </SubmitButton>
    </form>
  );
}
```

Create `app/s/[storeId]/pengaturan/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/data/stores";
import { DeleteStoreForm } from "./delete-store-form";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Pengaturan toko</h1>
      <Card>
        <CardHeader>
          <CardTitle>Data toko</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm
            storeId={store.id}
            defaults={{
              name: store.name,
              businessType: store.business_type,
              targetMarket: store.target_market,
              operatingDaysPerMonth: store.operating_days_per_month,
              targetMarginPct: store.target_margin_pct,
            }}
          />
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Hapus toko</CardTitle>
          <CardDescription>Tindakan ini tidak bisa dibatalkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteStoreForm storeId={store.id} storeName={store.name} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:e2e -- tests/e2e/settings.spec.ts tests/e2e/store-shell.spec.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass.

```bash
git add -A
git commit -m "feat(store): add store settings with edit and confirmed delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Landing page, setup docs, full verification

**Files:**
- Modify: `app/page.tsx` (replace scaffold content)
- Create: `.env.example`, `README.md` (replace scaffold content)
- Modify: `.gitignore` (allow `.env.example`)
- Test: `tests/e2e/landing.spec.ts`

**Interfaces:**
- Consumes: server `createClient` (Task 4); `buttonVariants` (Task 1); `devLogin`, `createStoreViaOnboarding` (Tasks 5–6).
- Produces: public landing at `/`; documented setup for local dev and production.

- [ ] **Step 1: Write the failing landing e2e test**

Create `tests/e2e/landing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createStoreViaOnboarding, devLogin } from "./helpers";

test("signed-out visitors see the pitch and a login button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("untung-rugi");
  await page.getByRole("link", { name: "Mulai gratis dengan Google" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("signed-in users get a link into the app", async ({ page }) => {
  await devLogin(page);
  await createStoreViaOnboarding(page, "Toko Landing");
  await page.goto("/");
  await page.getByRole("link", { name: "Buka aplikasi" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}\/dashboard$/);
});

test("landing has no horizontal scroll on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
```

Run: `npm run test:e2e -- tests/e2e/landing.spec.ts`
Expected: FAIL — scaffold page has no such heading/link.

- [ ] **Step 2: Implement the landing page**

Replace `app/page.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  { title: "HPP otomatis", body: "Masukkan bahan dan takaran, biaya per porsi langsung terhitung." },
  { title: "Harga jual pas", body: "Saran harga sesuai target margin, termasuk potongan GoFood & marketplace." },
  { title: "Laba & balik modal", body: "Lihat laba bulanan, target jual per hari, dan kapan modal kembali." },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium text-primary">BusinessNote</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Tahu untung-rugi usahamu sejak hari pertama.
        </h1>
        <p className="text-lg text-muted-foreground">
          Hitung HPP dari bahan, biaya operasional, dan penyusutan alat. Dapatkan harga jual yang
          pas dan lihat kapan modalmu kembali — tanpa perlu paham akuntansi.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="rounded-lg border p-4">
            <p className="font-medium">{feature.title}</p>
            <p className="text-sm text-muted-foreground">{feature.body}</p>
          </li>
        ))}
      </ul>
      <Link
        href={loggedIn ? "/mulai" : "/login"}
        className={buttonVariants({ size: "lg", className: "w-full sm:w-auto sm:self-start" })}
      >
        {loggedIn ? "Buka aplikasi" : "Mulai gratis dengan Google"}
      </Link>
    </main>
  );
}
```

Run: `npm run test:e2e -- tests/e2e/landing.spec.ts`
Expected: PASS.

- [ ] **Step 3: Add env example and setup docs**

Create `.env.example`:

```bash
# Local values: run `npm run db:start && npm run env:local` to fill .env.local automatically.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# Server only. Never prefix with NEXT_PUBLIC_.
SUPABASE_SECRET_KEY=
# Local development only. Never set this on Vercel.
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true
```

Add this line to the end of `.gitignore` so the example is committed while real env files stay ignored:

```
!.env.example
```

Replace `README.md`:

````markdown
# BusinessNote

Web app untuk pemula usaha: hitung HPP, harga jual, biaya operasional, laba, BEP, dan balik modal.

Spec: `docs/superpowers/specs/2026-10-16-businessnote-design.md`

## Development lokal

Butuh: Node.js 24+, Docker Desktop (berjalan).

```bash
npm install
npm run db:start      # Supabase lokal di Docker (pertama kali agak lama)
npm run env:local     # tulis URL & key Supabase lokal ke .env.local
npm run db:reset      # terapkan semua migrasi
npm run dev           # http://localhost:3000
```

Login lokal memakai form **Masuk (dev)** (email + password bebas, akun dibuat otomatis).
Supabase Studio: http://127.0.0.1:54323

## Test

```bash
npm test              # unit
npm run test:rls      # RLS, butuh Supabase lokal berjalan
npm run test:e2e      # Playwright, butuh Supabase lokal berjalan
```

## Setelah mengubah skema

```bash
npx supabase migration new <nama>   # tulis SQL di file baru
npm run db:reset && npm run db:types
```

## Setup production (dilakukan sekali, manual)

1. **Supabase**: buat project baru. Catat Project URL, publishable key, dan secret key
   (Project Settings → API Keys).
2. **Migrasi**: `npx supabase link --project-ref <ref>` lalu `npx supabase db push`.
3. **Google OAuth**:
   - Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
   - Supabase → Authentication → Sign In / Providers → Google: isi Client ID & Secret, aktifkan.
   - Supabase → Authentication → Sign In / Providers → **Email: nonaktifkan** (production hanya Google).
   - Supabase → Authentication → URL Configuration: Site URL = URL Vercel production;
     Redirect URLs tambahkan `https://<domain-vercel>/**` (dan URL preview bila perlu).
4. **Vercel**: import repo, set env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server only)
   - **Jangan** set `NEXT_PUBLIC_ENABLE_DEV_LOGIN`.
5. Mengubah plan user menjadi Pro (sementara, manual):
   `update public.profiles set plan = 'pro' where id = '<user-id>';` di SQL editor Supabase.
````

- [ ] **Step 4: Full verification**

Run each and confirm it passes:

```bash
npm test
npm run test:rls
npm run test:e2e
npm run typecheck
npm run lint
npm run build
git status --short   # .env.local must NOT appear; .env.example must appear
```

Expected: everything green; `git status` shows `.env.example`, `README.md`, `app/page.tsx`, `.gitignore`, `tests/e2e/landing.spec.ts` and no `.env.local`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add landing page, env example, and setup docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
