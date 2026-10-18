# Terms & conditions and recorded consent: design

## Intent

Untungin gives first-time F&B sellers estimates: HPP, suggested prices, profit, payback, a loan summary for the bank, and an AI analysis from Google Gemini. Two things worry the owner:

1. **Wrong numbers.** A seller who loses money, prices too low, or is refused a loan may blame Untungin. The estimates are only as good as what the seller types in, and they are not financial, tax or credit advice.
2. **Data sent to Gemini.** "Analisis usahaku" sends a summary of the store's figures to Google. The privacy page already explains this in detail, but nobody actually agrees to it.

So: a terms & conditions page, agreement to the terms and the privacy policy at sign-in, a separate one-time agreement before the first AI analysis, and a record of each agreement as proof (Indonesia's UU Pelindungan Data Pribadi expects consent the operator can show).

## Goals
- A public terms page, `/syarat`, in Indonesian (default) and English, linked next to the privacy policy on the landing page, the login page and the privacy page.
- **Sign-in (owner's decision):** a line of text under the Google button: signing in means agreeing to the Syarat & Ketentuan and the Kebijakan Privasi, both linked. No checkbox.
- **AI (owner's decision):** the first time a seller taps "Analisis usahaku", a dialog says what is sent to Gemini and asks them to agree ("Setuju & analisis" / "Batal"). After that it never asks again, unless the AI terms version changes.
- **Recorded consent:** each agreement is stored with the user, what they agreed to (terms or AI), the version, and the time.
- **Re-asking (owner's decision):** when the terms version or the AI terms version changes, users agree again.

## Non-goals
- No checkbox at sign-in.
- No legal review in this change. The copy is a careful first draft; the owner should have a lawyer read it before charging money or launching widely. The page must not claim to have been reviewed.
- No paid plans, payment terms or refunds (`profiles.plan` exists, but everything is free today).
- No cookie banner: the privacy page already says there are no ad or tracking cookies.
- No email notifications about changed terms.

## Anti-goals (would make this a failure even if it works)
- A seller can reach the AI analysis, or have data sent to Gemini, without having agreed to the current AI terms. This must hold on the server, not just in the dialog.
- Signed-in users get stuck: a loop between the agreement screen and the app, or no way out except agreeing (they must be able to sign out, read both documents, and delete their account).
- The terms promise something the app doesn't do (for example backups or uptime), or contradict the privacy page.
- Long legal walls of text a first-time seller won't read. Plain Indonesian, short sections, a short summary at the top.

## Constraints
- English for code, comments and docs; UI copy in `messages/id.json` and `messages/en.json` with matching keys.
- Supabase conventions in this repo: RLS on every table; `anon` gets nothing; `authenticated` gets only the privileges it needs; no `truncate`, `trigger` or `references`; functions are `security invoker` with `search_path = ''` unless there is a reason not to.
- Never run `db:reset` locally; apply with `npx supabase migration up --local`. Production already has 12 migrations applied; this adds new ones only.
- The server reads the session with `getClaims()`, never `getSession()`. User-supplied redirects go through `safeNextPath`.
- E2E: never click "Analisis usahaku" against the real Gemini API; the existing analysis tests already avoid that, and the dialog tests must too.

## What the owner decided
- Sign-in agreement: a line under the Google button, no checkbox.
- AI agreement: once, in a dialog before the first analysis.
- Both are recorded, and both are asked again when their version changes.

## My calls (the owner can overrule)
1. **One version for terms + privacy together** (`TERMS_VERSION`), and a separate `AI_TERMS_VERSION`. Versions are dates, e.g. `"2026-10-18"`, kept in one code file next to the copy. Changing the privacy policy materially means bumping `TERMS_VERSION`.
2. **Storage:** a new append-only table `consents` (`id`, `user_id` → `auth.users` on delete cascade, `kind` in `terms` | `ai`, `version`, `accepted_at` default now()). The user can insert and read their own rows only; no update or delete. Rows go when the account is deleted. Append-only means the history of agreements stays intact as proof.
3. **Recording at sign-in:** the OAuth callback (`app/auth/callback/route.ts`), after a successful code exchange, records a `terms` consent at the current version **only when the user has no `terms` row at all** (their first sign-in). A version bump is never accepted silently by signing in again: it always goes through the agreement screen (4), so the proof shows an explicit "Setuju".
4. **Users who haven't agreed to the current version** see an agreement screen at `/[locale]/syarat/setuju` before any signed-in page (`/mulai`, `/onboarding`, `/toko`, `/s/...`). That covers everyone who signed in before this ships and everyone after a version bump.
   - **The screen:** it links both documents and has "Setuju & lanjut", "Keluar" (sign out), and the existing delete-account control (`components/account/delete-account-form.tsx`), since settings are behind the gate.
   - **After agreeing:** it returns to where they were going (`next`, via `safeNextPath`), for page navigations (GET); anything else lands on the default after-login page.
   - **Public pages** (landing, `/privasi`, `/syarat`, login) never redirect there.
   - **Where the gate runs:** in the signed-in pages' server code (a shared helper; the per-request consent lookup is cached), not in the proxy.
   - **Server actions:** these and the CSV export aren't separately gated, because a user who hasn't agreed can't reach the pages that call them. AI is the exception (5).
   - **Which version counts:** "agreed to the current version" means a row whose `version` equals the code constant, not the newest date.
   - **Who writes the version:** consent rows are written only by server code, which stamps the version from the constant. RLS still limits users to inserting their own rows; a user forging a row only affects their own record.
5. **AI enforcement on the server:** `analyzeStoreAction` refuses to call Gemini without a current `ai` consent, returning a state the form shows as the dialog. Agreeing records the consent and then runs the analysis in the same tap. The cached-result path ("the data hasn't changed") sends nothing, but still requires consent, for simplicity.
6. **Privacy page updates:** a new data item for the agreement records (what, which version, when), and the "last updated" date moves to the ship date.
7. **SEO:** `/syarat` goes in `PUBLIC_PATHS` (sitemap, canonical, hreflang). `robots.txt` disallows `/*/syarat/setuju`.

## Terms content

Short sections, plain language, Indonesian first with an English translation of the same text. "Terakhir diperbarui" date at the top, then a 3–4 sentence summary, then:

1. **About Untungin and who runs it.** Operated by Rycco Atika (`me@ryccoatika.com`), the same identity the privacy page uses.
2. **Who may use it.** People running or planning a business, who can enter into an agreement under Indonesian law (adults, or with a guardian's consent).
3. **Your account.** Sign-in is with Google; the user keeps their Google account secure; one person per account.
4. **Your data.** The seller owns what they enter. Untungin uses it only to run the service, as the privacy policy describes. Deleting a store or the account deletes the data permanently (no restore).
5. **Estimates, not advice** (the key section for "wrong numbers"):
   - Every figure (HPP, suggested prices, margins, profit, break-even, payback, loan summary and instalment check, monthly report) is an estimate calculated from what the seller entered.
   - It is not financial, tax, legal or credit advice, and not an audited financial statement.
   - The seller checks the numbers and is responsible for decisions made with them, including prices, purchases and loan applications.
   - The loan summary is the seller's own summary; banks decide on their own criteria.
6. **AI analysis:**
   - It is optional, and runs only when the seller taps the button and has agreed in the dialog.
   - It sends a summary of the store's figures to Google Gemini; list the data the same way the privacy page does.
   - AI output can be wrong or incomplete and is a suggestion, not advice.
   - There is a daily usage limit.
   - On a free Gemini API tier, Google may use the data to improve its products and humans may review it (this matches the privacy page).
7. **Fair use.** No breaking, overloading or probing the service, no other people's data without permission, nothing unlawful.
8. **The service as it is.**
   - Free for now.
   - Provided "as is", without a promise of being error-free or always available.
   - Features may change.
   - The seller should keep their own copies of figures that matter (the CSV export exists).
9. **Limits of liability.** To the extent Indonesian law allows, Untungin isn't liable for losses from decisions made using the estimates or AI output, from data the seller entered incorrectly, or from outages. Nothing limits liability that the law doesn't allow to be limited.
10. **Ending.** The seller can stop and delete their account at any time; the operator may suspend accounts that break these terms, or stop the service with reasonable notice where possible.
11. **Changes.** When the terms change, the seller is asked to agree again on their next visit; they can delete their account instead.
12. **Law.** Indonesian law; Indonesian text prevails over the English translation.
13. **Contact.** The email above.

## The AI dialog
- **Title:** something like "Sebelum analisis AI".
- **Body:**
  - a short list of what is sent: store name and type, target market, operating days, target margin, products, materials, channels, prices, estimated sales, competitor prices, costs, and totals such as revenue, profit and break-even;
  - that Google Gemini processes it;
  - the free-tier sentence;
  - that results can be wrong.
- **Links:** the terms (AI section) and the privacy policy.
- **Buttons:** "Setuju & analisis" and "Batal".
- **Accessibility:** an accessible modal (focus trapped, Escape cancels), usable at 360 px.

## Left to the builder
- Exact copy wording within the outline above, in both languages.
- Component structure, how the gate is wired (layouts, a helper used by `requireUser`, or the proxy), and caching of the consent lookup.
- How the e2e sign-in helper (which signs in with a password and never goes through the OAuth callback) gets a consent row so existing tests are not all redirected to the agreement screen. Tests for the gate must remove it deliberately.
- Visual design of the terms page (follow `/privasi`).

## How we'll know it works
- The login page shows the agreement line with working links in both languages.
- A Google sign-in records a `terms` row at the current version; signing in again doesn't add a duplicate.
- A user without a current `terms` row is sent to the agreement screen from any signed-in page, can sign out from it, and lands back on their page after agreeing.
- Without a current `ai` row, the analysis action never calls Gemini (checked on the server). The dialog appears once and the consent is recorded; after a version bump it appears again.
- RLS: users can't read or insert other users' consent rows, and can't update or delete their own; `anon` has no access.
- `/syarat` and `/en/syarat` render, appear in the sitemap, and have link-preview tags.
