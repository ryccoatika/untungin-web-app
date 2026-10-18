# Terms & Conditions and Recorded Consent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/syarat` terms page, agreement to terms + privacy at sign-in (a line under the Google button, recorded), a one-time AI consent dialog enforced on the server, and an agreement screen whenever the version changes.

**Architecture:** An append-only `consents` table (own rows only, `accepted_at` set by the database). Versions are code constants in `lib/legal/versions.ts`. The OAuth callback records the first `terms` consent; a server helper gates signed-in pages and sends users who haven't agreed to the current version to `/[locale]/syarat/setuju`. The AI action refuses to run without a current `ai` consent; the analyze form shows a dialog that records it first.

**Tech Stack:** Next.js 16.4 App Router (Server Actions, `useActionState`), React 19, next-intl 4, Supabase (Postgres 17, RLS), shadcn on Base UI (`@base-ui/react`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-terms-consent-design.md`. The spec is binding; its "Terms content" and "The AI dialog" sections are the required copy outline.

## Global Constraints
- English for code, comments, docs. UI copy only in `messages/id.json` and `messages/en.json`; key sets must match (`tests/unit/messages.test.ts`). Indonesian is the default locale.
- Supabase: RLS on; `anon` gets nothing; `authenticated` gets only what it needs; revoke `truncate, trigger, references`. Apply locally with `npx supabase migration up --local`; **never** `db:reset`. Regenerate types with `npm run db:types`.
- Session on the server via `getClaims()` only (`requireUser` already does this). Every user-supplied redirect goes through `safeNextPath`.
- E2E: **never let "Analisis usahaku" reach the server action with consent**; `.env.local` has a real `GEMINI_API_KEY`. Task 4 says how.
- E2E runs against the production build: `npm run build`, then `npx playwright test` (the config starts `next start -p 3100`). Stop only the server PID you started.
- Versions: `TERMS_VERSION = "2026-10-18"`, `AI_TERMS_VERSION = "2026-10-18"`. "Agreed" means a row of that kind whose `version` equals the constant.
- The terms page must not claim legal review. The operator identity is the same as `/privasi`: Rycco Atika, `me@ryccoatika.com`.

## Review Focus
1. **Deep link while not agreed.** A signed-in user without current consent opens `/id/s/<id>/catat` from WhatsApp → one redirect to the agreement screen, no loop. The agreement screen, `/syarat`, `/privasi` and login are never gated. Pinned in Task 3's e2e.
2. **AI action without consent.** A stale tab or a crafted POST submits the analyze form without consent → the action returns `needsConsent` before any quota claim or Gemini call. Pinned in Task 4's e2e (submit bypassing the dialog).
3. **A hostile `next`.** `/id/syarat/setuju?next=//evil.example` → after agreeing, lands on `/id/mulai`. Pinned in Task 3's e2e.
4. **Recording fails at sign-in.** A failed consent insert in the OAuth callback must not break sign-in; the gate shows the agreement screen instead. The callback logs and continues (Task 3, code review).
5. **English.** A user on `/en/...` is sent to `/en/syarat/setuju` and returns to `/en/...`; `/en/syarat` says the Indonesian text prevails. Pinned in Task 3's e2e (en variant) and Task 2's e2e.

---

### Task 1: `consents` table, versions and consent helpers

**Files:**
- Create: `supabase/migrations/20261018000006_consents.sql`
- Create: `lib/legal/versions.ts`, `lib/legal/consent.ts`, `lib/data/consents.ts`
- Modify: `lib/supabase/database.types.ts` (regenerated), `docs/deploy.md` (grants expectations)
- Test: `tests/rls/consents.test.ts`, `tests/unit/consent.test.ts`

**Interfaces:**
- Produces:
  - `lib/legal/versions.ts`: `TERMS_VERSION: "2026-10-18"`, `AI_TERMS_VERSION: "2026-10-18"`, `type ConsentKind = "terms" | "ai"`, `currentVersion(kind: ConsentKind): string`.
  - `lib/legal/consent.ts` (pure):
    - `hasAgreed(rows: { kind: string; version: string }[], kind: ConsentKind): boolean`, true when some row has that kind and `version === currentVersion(kind)`;
    - `isFirstSignIn(rows: { kind: string }[]): boolean`, true when there is no `terms` row at all. The callback records only then (spec decision 3).
  - `lib/data/consents.ts` (`server-only`):
    - `loadConsents = cache(async (): Promise<{ kind: string; version: string }[]>)` reads the signed-in user's rows with the user client; RLS returns only their own;
    - `recordConsent(supabase: SupabaseClient<Database>, userId: string, kind: ConsentKind): Promise<void>` inserts `{ user_id, kind, version: currentVersion(kind) }` and throws on error.

- [ ] **Step 1: Write the RLS tests** in `tests/rls/consents.test.ts` (pattern: `tests/rls/records.test.ts`, helpers `admin`, `anonClient`, `createTestUser`):
  - owner inserts `{ user_id: owner.id, kind: "terms", version: "2026-10-18" }` and reads it back; `accepted_at` is set and within a minute of now;
  - inserting with `accepted_at: "2020-01-01T00:00:00Z"` fails (column not granted: error code `42501`);
  - owner cannot insert a row with `user_id: other.id` (RLS error);
  - `other` selecting owner's rows gets `[]`;
  - owner `update` and `delete` on own row: error or 0 rows affected, and the row is unchanged (verify with `admin`);
  - `kind: "cookies"` and `version: "v2"` are rejected (check constraints, code `23514`);
  - `anonClient` select returns an error or `[]`, and insert fails;
  - deleting the user with `admin.auth.admin.deleteUser(owner.id)` removes their rows (verify with `admin`).
- [ ] **Step 2: Run** `npm run test:rls -- tests/rls/consents.test.ts` → FAIL (relation `consents` does not exist).
- [ ] **Step 3: Write the migration** with the following parts:
  - **Table:** `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users (id) on delete cascade`, `kind text not null check (kind in ('terms','ai'))`, `version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$')`, `accepted_at timestamptz not null default now()`. Add an index on `(user_id, kind)`.
  - **RLS:** enable it. Policies `consents_select` `for select to authenticated using (user_id = (select auth.uid()))` and `consents_insert` `for insert to authenticated with check (user_id = (select auth.uid()))`. No update or delete policies.
  - **Grants:** `revoke all on public.consents from anon, authenticated`, then `grant select on public.consents to authenticated` and `grant insert (user_id, kind, version) on public.consents to authenticated`. The column grant is how the database, not the client, sets `accepted_at`.
  - **Comment:** the table is append-only proof of consent.
- [ ] **Step 4: Apply and regenerate:** `npx supabase migration up --local`, then `npm run db:types`.
- [ ] **Step 5: Run** `npm run test:rls` → all pass, including the existing suites.
- [ ] **Step 6: Write `tests/unit/consent.test.ts`** for `hasAgreed`:
  - `[]` gives false;
  - a `terms` row at `TERMS_VERSION` gives true for `terms` and false for `ai`;
  - a `terms` row at `"2026-01-01"` gives false;
  - an older row plus a current row gives true;
  - `isFirstSignIn([])` is true; a `terms` row at an old version makes it false (a version bump is not accepted by signing in); an `ai` row alone leaves it true.
- [ ] **Step 7: Implement** `versions.ts`, `consent.ts` and `consents.ts`, then run `npm test` → pass.
- [ ] **Step 8: Update `docs/deploy.md` step 2.5:**
  - in the table grants, add `authenticated`: `INSERT,SELECT` on `consents`;
  - add a line saying the `consents` column privilege query should show `INSERT` on `user_id`, `kind`, `version` only.
  - Check the exact output against your local DB with the step 2.5 queries before writing it.
- [ ] **Step 9: Commit:** `feat(legal): append-only consents table with own-row access and version helpers`

### Task 2: The terms page, links, the sign-in line and the privacy update

**Files:**
- Create: `app/[locale]/syarat/page.tsx`
- Modify:
  - `messages/id.json`, `messages/en.json` (new `Terms` namespace; `Auth.agreement`; `Privacy.dataConsent`; `Privacy.updated`);
  - `app/[locale]/login/page.tsx`;
  - `app/[locale]/page.tsx` (footer);
  - `app/[locale]/privasi/page.tsx` (link to terms, new data item);
  - `lib/seo.ts` (`PUBLIC_PATHS` gets `"/syarat"`);
  - `app/robots.ts` (disallow `"/*/syarat/setuju"`).
- Test: `tests/e2e/terms.spec.ts`, `tests/e2e/seo.spec.ts` (extend)

**Interfaces:**
- Consumes: `publicPageMetadata(locale, path, title, description)` from `lib/seo.ts`.
- Produces:
  - route `/[locale]/syarat`, with the AI section anchored as `id="ai"`, so `/syarat#ai` works for Task 4;
  - message keys `Terms.link` (the link label, e.g. "Syarat & Ketentuan") and `Auth.agreement` (rich text with `<terms>` and `<privacy>` tags).

- [ ] **Step 1: Write `tests/e2e/terms.spec.ts`** (signed out):
  - `/id/syarat`: h1 "Syarat & Ketentuan"; the "Terakhir diperbarui" line; section headings for the 13 sections in the spec order; the estimates section contains "bukan nasihat keuangan"; the AI section has `id="ai"` and mentions "Google Gemini"; the law section says the Indonesian text prevails; a link to `/id/privasi`; the operator email as a `mailto:` link.
  - `/en/syarat`: h1 "Terms & Conditions" and the prevailing-language sentence in English.
  - `/id/login`: the text "Dengan masuk, kamu menyetujui", with links named "Syarat & Ketentuan" (href `/id/syarat`) and "Kebijakan Privasi" (href `/id/privasi`).
  - The landing footer and `/id/privasi` both link to `/id/syarat`.
  - `/id/privasi` lists the agreement-records data item, and its "Terakhir diperbarui" shows the new date.
  - No horizontal scroll at 360 px on `/id/syarat` (pattern: `landing.spec.ts`).
- [ ] **Step 2: Extend `tests/e2e/seo.spec.ts`:**
  - add `["/id/syarat", "Syarat & Ketentuan · Untungin"]` and `["/en/syarat", "Terms & Conditions · Untungin"]` to the tag loop;
  - add both to the expected sitemap list;
  - `robots.txt` contains `Disallow: /*/syarat/setuju`.
- [ ] **Step 3: Write the copy.**
  - Use the `Terms` namespace in both files. Follow the spec's 13 sections in order, plus `title`, `updated` ("Terakhir diperbarui: 18 Oktober 2026" / "Last updated: 18 October 2026"), `summary` and `link`.
  - Structure is your call; lists may use `t.raw` arrays.
  - Plain language and short sentences. The Indonesian text is the original; English is a faithful translation.
  - The AI section lists the same data as `Privacy.thirdGemini` and repeats its free-tier sentence.
  - `Auth.agreement`: id "Dengan masuk, kamu menyetujui <terms>Syarat & Ketentuan</terms> dan <privacy>Kebijakan Privasi</privacy> Untungin." / en "By signing in, you agree to Untungin's <terms>Terms & Conditions</terms> and <privacy>Privacy Policy</privacy>."
  - `Privacy.dataConsent`: what is stored when you agree: which document (terms or AI), its version and the time.
  - `Privacy.updated`: the same date as the terms.
- [ ] **Step 4: Build the page and links.**
  - `syarat/page.tsx` follows `privasi/page.tsx`: same header, layout and `OPERATOR`. Move `OPERATOR` to `lib/legal/operator.ts` and import it in both pages.
  - `generateMetadata` returns `{ title: t("title"), ...publicPageMetadata(locale, "/syarat", `${t("title")} · ${SITE_NAME}`, t("summary")) }`.
  - The login page renders `Auth.agreement` under `GoogleSignInButton`, in small muted text, and keeps the existing privacy link below.
- [ ] **Step 5: Run checks.** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npx playwright test tests/e2e/terms.spec.ts tests/e2e/seo.spec.ts tests/e2e/landing.spec.ts` → pass.
- [ ] **Step 6: Commit:** `feat(legal): terms & conditions page, sign-in agreement line, links and privacy update`

### Task 3: Record at sign-in, the agreement screen and the gate

**Files:**
- Create: `lib/legal/gate.ts`, `app/[locale]/syarat/setuju/page.tsx`, `app/[locale]/syarat/setuju/actions.ts`
- Modify:
  - `app/auth/callback/route.ts`;
  - `app/[locale]/mulai/page.tsx`, `app/[locale]/onboarding/page.tsx`, `app/[locale]/toko/page.tsx`, `app/[locale]/s/[storeId]/layout.tsx`;
  - `messages/*.json` (`Terms.agree` namespace);
  - `tests/e2e/helpers.ts`.
- Test: `tests/e2e/consent-gate.spec.ts`

**Interfaces:**
- Consumes: `hasAgreed`, `loadConsents`, `recordConsent`, `TERMS_VERSION`; `requireUser`; `safeNextPath`, `DEFAULT_AFTER_LOGIN`; `withLocale`; `signOutAction`; `DeleteAccountForm({ email })`.
- Produces:
  - `requireCurrentTerms(next: string): Promise<void>` in `lib/legal/gate.ts` (`server-only`). If there is no session it returns (the proxy and `requireUser` handle that). If `!hasAgreed(await loadConsents(), "terms")`, it redirects to `/syarat/setuju?next=<encoded next>` in the current locale.
  - `acceptTermsAction(next: string): Promise<void>`.
  - e2e `signIn(page, email?, next?, { agreed = true } = {})`, which inserts a current `terms` row with the admin client unless `agreed: false`.

- [ ] **Step 1: Update `tests/e2e/helpers.ts`.**
  - `signIn` gets the user id: from `createUser`'s result, or `userIdByEmail` when the email already exists.
  - Unless `agreed: false`, it inserts `{ user_id, kind: "terms", version: TERMS_VERSION }` with `adminClient()` before setting cookies.
  - Import `TERMS_VERSION` from `../../lib/legal/versions`.
- [ ] **Step 2: Write `tests/e2e/consent-gate.spec.ts`:**
  - `signIn(page, undefined, "/mulai", { agreed: false })` → URL `/id/syarat/setuju?next=%2Fid%2Fmulai`. It shows links to `/id/syarat` and `/id/privasi`, the buttons "Setuju & lanjut" and "Keluar", and the delete-account form.
  - **Deep link:** an agreed user with a sample store has its consent rows deleted with the admin client. `page.goto(storeUrl(page, "catat"))` lands on `/id/syarat/setuju?next=%2Fid%2Fs%2F<id>%2Fdashboard` after a single redirect; record the responses and expect one 307 to the agreement screen. After "Setuju & lanjut" → `/id/s/<id>/dashboard`, and exactly one `terms` row at `TERMS_VERSION` exists (admin check).
  - **Public pages stay open:** while not agreed, `/id/syarat`, `/id/privasi` and `/id` load without redirect.
  - **Hostile next:** `/id/syarat/setuju?next=//evil.example` → after agreeing, the URL is `/id/mulai` or where it leads (`/id/onboarding`).
  - **Sign out:** "Keluar" lands on `/id`; the store page then redirects to login.
  - **Already agreed:** visiting `/id/syarat/setuju` redirects to `/id/mulai`.
  - **English:** with `agreed: false` and `/en/mulai`, the user lands on `/en/syarat/setuju?next=%2Fen%2Fmulai`, and after agreeing on an `/en/...` page.
  - **Old version:** a row with version `"2026-01-01"` only → still gated.
- [ ] **Step 3: Run** the spec after `npm run build` → FAIL.
- [ ] **Step 4: Implement the gate.**
  - **Where it's called, with which `next`:**
    - `mulai` page: `"/mulai"`;
    - `onboarding`: `"/onboarding"`;
    - `toko`: `"/toko"`;
    - the store layout: `` `/s/${storeId}/dashboard` `` (a layout can't see the subpage; the store's dashboard is the ruling).
  - **Order:** call it after `requireUser` where a page has one, and before any store query.
- [ ] **Step 5: Build the agreement screen.**
  - **The page:** `requireUser()`, so signed-out visitors go to login. If already agreed, redirect to `safeNextPath(next) ?? DEFAULT_AFTER_LOGIN`. Otherwise render:
    - a heading and a short explanation (id: "Sebelum lanjut, setujui Syarat & Ketentuan dan Kebijakan Privasi Untungin." Wording is your call; write an `en` too);
    - links to both documents;
    - a form calling `acceptTermsAction(next)` with a `SubmitButton` "Setuju & lanjut";
    - a sign-out form (`signOutAction`, "Keluar");
    - under a "Hapus akun" heading, `DeleteAccountForm` with the user's email.
  - **The action:** `requireUser()`, `recordConsent(supabase, userId, "terms")`, then `redirect` to `withLocale(safeNextPath(next) ?? DEFAULT_AFTER_LOGIN, locale)`. If saving fails, return a message shown under the button; don't redirect.
- [ ] **Step 6: Record in the OAuth callback.** After a successful `exchangeCodeForSession`, read the user's consent rows. If `isFirstSignIn(rows)`, call `recordConsent(supabase, data.user.id, "terms")`. Wrap the whole thing in try/catch, log only the error message, and continue the redirect: a failure must not block sign-in.
- [ ] **Step 7: Run checks.** `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, `npm run build`, then the **full** `npx playwright test`. Every existing spec must still pass through the updated `signIn`.
- [ ] **Step 8: Commit:** `feat(legal): record agreement at first sign-in; agreement screen when the terms version changes`

### Task 4: AI consent dialog, enforced on the server

**Files:**
- Create: `components/ui/dialog.tsx` (via `npx shadcn@latest add dialog`; it uses `@base-ui/react`, which is already a dependency)
- Modify:
  - `app/[locale]/s/[storeId]/analisis/actions.ts`, `analyze-form.tsx`, `page.tsx`;
  - `messages/*.json` (`Analysis.consent.*`, `Analysis.result.needsConsent`).
- Test: `tests/e2e/ai-consent.spec.ts`

**Interfaces:**
- Consumes: `hasAgreed`, `loadConsents`, `recordConsent`; existing `analyzeStoreAction`, `AnalyzeState`.
- Produces:
  - `AnalyzeState.status` gains `"needsConsent"`;
  - `acceptAiTermsAction(): Promise<{ ok: boolean; message?: string }>`;
  - `AnalyzeForm({ storeId, disabled, aiAgreed })`.

- [ ] **Step 1: Write `tests/e2e/ai-consent.spec.ts`.** Never let an analyze POST reach the server with consent: abort with `page.route`.
  - **Dialog, Batal path:** a sample store with the AI page open and no `ai` consent. Click "Analisis usahaku" → a dialog (`role="dialog"`) titled "Sebelum analisis AI". It lists what is sent (contains "harga pesaing"), links to `/id/syarat#ai` and `/id/privasi`, and has the buttons "Setuju & analisis" and "Batal". "Batal" and Escape both close it, and no `ai` row exists (admin check).
  - **Agree path:** register `page.route("**/*", ...)`. It aborts any POST whose `next-action` header is set, **except the first one**, and counts them. Click "Analisis usahaku" → "Setuju & analisis". Then:
    - exactly one `ai` row at `AI_TERMS_VERSION` exists (that's the first POST, the consent action);
    - a second action POST was attempted and aborted (the analysis);
    - after a reload, clicking "Analisis usahaku" opens no dialog, and its POST is aborted too.
  - **Server enforcement:** with no `ai` consent, submit the form directly, bypassing the dialog:
    ```ts
    page.locator("form").filter({ has: page.getByRole("button", { name: "Analisis usahaku" }) }).evaluate((f) => (f as HTMLFormElement).requestSubmit())
    ```
    Do not abort this one: the server must refuse before Gemini. Expect the alert text for `needsConsent`, no new `ai_usage` row, and no new `ai_analyses` row (admin checks).
  - **Version bump:** an `ai` row with version `"2026-01-01"` only → the dialog appears.
  - 360 px: the dialog fits without horizontal scroll.
- [ ] **Step 2: Run** after `npm run build` → FAIL.
- [ ] **Step 3: Change the server.**
  - **`analyzeStoreAction(storeId, prev, formData?)`:** right after `requireUser()` and the uuid check, `if (!hasAgreed(await loadConsents(), "ai")) return { status: "needsConsent", message: t("needsConsent") }`. This comes before any store load, quota claim or Gemini call.
  - **`acceptAiTermsAction()`:** `requireUser()`, then `recordConsent(supabase, userId, "ai")`; it returns `{ ok: false, message }` on error.
- [ ] **Step 4: Change the client.**
  - **The form:** `AnalyzeForm` takes `aiAgreed`, computed on the page with `hasAgreed(await loadConsents(), "ai")`. When it's false, the submit button opens the dialog instead of submitting. "Setuju & analisis" awaits `acceptAiTermsAction()`; on `ok`, it closes the dialog and submits the form (`form.requestSubmit()`); on failure, the message shows in the dialog.
  - **When the server says `needsConsent`:** the form opens the dialog.
  - **The dialog:** copy follows the spec's "The AI dialog". Focus is trapped, Escape cancels (Base UI does both), and it works at 360 px.
- [ ] **Step 5: Run checks.** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then the full `npx playwright test` → pass, with `analysis.spec.ts` unchanged.
- [ ] **Step 6: Commit:** `feat(ai): one-time consent dialog before the first analysis, enforced in the server action`
