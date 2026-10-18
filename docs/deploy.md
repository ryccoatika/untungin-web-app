# Production deploy checklist

Run in order. Every value marked *secret* goes only into Vercel's or Supabase's settings, never into code, chat, `.env.example` or a `NEXT_PUBLIC_*` variable.

The first deploy is a **private beta** for moderated seller tests (`docs/seller-test/untungin-seller-test.html`): the site is live and public, but you only send the link to testers for now. Section 7 covers that.

## 0. Before you start
- [ ] `master` is green locally: `npm test`, `npm run test:rls`, `npm run typecheck`, `npm run lint`, `npm run build`, and the e2e suite on the production build.
- [ ] You have access to: a Google Cloud project, a Supabase account, a Vercel account linked to the GitHub repo, Google AI Studio, and the DNS for `ryccoatika.com`.

## 1. Google Cloud (OAuth client)
1. Credentials → OAuth client (Web): authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback` (keep `http://127.0.0.1:54321/auth/v1/callback` for local development). `<ref>` is the production Supabase project ref; create the Supabase project first (section 2, step 1) if you do not have it yet. Note the client id and *secret*.
2. OAuth consent screen:
   - App name Untungin; support and developer contact email `me@ryccoatika.com`.
   - Authorized domains: `ryccoatika.com` and `<ref>.supabase.co`.
   - Privacy policy URL `https://untungin.ryccoatika.com/privasi`.
   - Scopes: only the defaults (`openid`, `email`, `profile`). These need no Google verification.
   - Publishing status: **In production**. Do not leave it on Testing: Testing only allows listed test users and expires sessions after 7 days.

## 2. Supabase (production project)
1. Create the project (region: Singapore, closest to Indonesia). Save the database password in your password manager.
2. Link and push the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`. It applies them in filename order. Confirm all 13 files in `supabase/migrations/` (`20261016000001_core.sql` through `20261018000006_consents.sql`) are listed as applied: `npx supabase migration list`.
   - Never run `db reset` against this project: it wipes all data.
3. Auth → Providers: enable **Google** (client id + *secret* from section 1); **disable Email**. The e2e sign-in helper relies on Email locally; production must not offer it.
4. Auth → URL configuration: Site URL `https://untungin.ryccoatika.com`; Redirect URLs `https://untungin.ryccoatika.com/**` (add `https://<project>-*.vercel.app/**` only if you use preview deployments).
5. Check the grants (SQL editor):
   ```sql
   select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
   group by 1, 2 order by 1, 2;

   select column_name
   from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
   order by 1;

   select column_name
   from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'consents'
     and grantee in ('anon', 'authenticated') and privilege_type = 'INSERT'
   order by 1;

   select routine_name, grantee
   from information_schema.role_routine_grants
   where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
   order by 1, 2;
   ```
   Expect exactly:
   - Tables, `anon`: no rows.
   - Tables, `authenticated`: `DELETE,INSERT,SELECT,UPDATE` on `assets`, `materials`, `operating_expenses`, `product_channel_prices`, `product_materials`, `products`, `purchases`, `sales_channels`, `sales_days`, `sales_lines`, `stores`; `SELECT` only on `ai_analyses`, `ai_usage`, `consents`, `profiles`.
   - `profiles` column `UPDATE`: `full_name` and `locale`.
- `consents` column `INSERT`: `kind`, `user_id` and `version` only (not `accepted_at`: the database sets it). The table query lists `SELECT` only, because the insert is a column grant.
   - Functions, `authenticated` only: `close_sales_day`, `create_store`, `delete_sales_day`, `delete_sales_line`, `is_store_owner`, `save_purchase`, `save_sales_day`. `handle_new_user` also lists `PUBLIC` and `anon`; that is expected, since a trigger function cannot be called directly.
6. Advisors → Security Advisor: no errors. (Warnings about the Email provider being off or leaked-password protection don't apply to Google-only sign-in.)
7. Note the project URL, the publishable key and the *secret* key (Settings → API Keys).

## 3. Gemini
1. Create an API key in Google AI Studio (aistudio.google.com/apikey); it enables the Gemini API for its project.
2. Use a paid (billing-enabled) key: a paid key keeps prompts out of Google's model training. On the free tier Google may use the data sent to improve its products and people may review it; the privacy page discloses that case.
3. Set a monthly budget alert on the billing account, so a bug or abuse can't run up the bill unnoticed.

## 4. Vercel
1. Import the GitHub repo; framework Next.js; production branch `master`.
2. Settings → Functions → Function Region: `sin1` (Singapore), next to the database.
3. Environment variables (Production only):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (*secret*, server only)
   - `GEMINI_API_KEY` (*secret*, server only); optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`)
   - **Never** set `NEXT_PUBLIC_ENABLE_DEV_LOGIN`, in any environment. Check the list afterwards: only the variables above.
4. Domain: add `untungin.ryccoatika.com` and the DNS record Vercel shows.
5. Redirect `www.` and the `*.vercel.app` production alias to `https://untungin.ryccoatika.com` (Domains → Redirect to), so Google sign-in always returns to an allowed URL.
6. Deploy, then check the build log for the route list and no warnings about missing environment variables.

## 5. Smoke test after deploy
Use your own Google account, not a tester's.

1. `/` loads with the 3D hero (or the static drawing on reduced motion); `/privasi` loads signed out. Toggle English and back.
2. Sign in with Google → onboarding → "Coba dengan data contoh" → the dashboard shows profit and the "Bulan ini sebenarnya" card.
3. **Catat:** record today's sales on one channel, save, reload: the counts stay. Change a count and tap Belanja: it asks before leaving.
4. **Belanja:** record a purchase for one material; its price on Bahan changes.
5. **Laporan:** the five lines add up, the calendar shows today as recorded, and the sample days show as recorded, closed or missing.
6. **Ringkasan pinjaman:** "Cetak / Simpan PDF" fits on one A4 page; the CSV downloads and opens.
7. `/s/<id>/analisis` → "Analisis usahaku" returns a result; pressing again says the data hasn't changed. This is the only step that costs Gemini credit.
8. On a phone: open the site, install it to the home screen, open it from there.
9. Settings → delete the sample store; then delete a throwaway account and confirm you're signed out.
10. Supabase → Auth logs show only Google sign-ins.

## 6. Keep it running
- **Free Supabase projects pause after a week without activity.** During the beta, either sign in at least once a week or move to the Pro plan. Pro also adds daily backups.
- **Backups before later migrations:** before each `npx supabase db push` after this first one, run `npx supabase db dump --data-only -f backup-<date>.sql` and keep the file out of the repo. Migrations only go forward; there are no down migrations.
- **Rolling back the app:** Vercel → Deployments → the last good deployment → Instant Rollback. That does not undo a migration, so keep migrations additive (new tables and columns) where you can.
- **Vercel Hobby** is for non-commercial use. A free private beta fits; move to Pro before charging anyone.

## 7. Private beta for seller tests
- [ ] The site is public and search engines may index it; that is intended. "Private" only means you don't promote it yet: send the link to testers directly. Store pages need sign-in, so search engines only see the landing and privacy pages.
- [ ] Each tester signs in with their own Google account. Nothing to set up per tester: the store limit and RLS apply as for any user.
- [ ] Run each session with `docs/seller-test/untungin-seller-test.html`. Testers type real business numbers, so don't take screenshots of their screens without asking.
- [ ] After the beta: delete the test accounts you made yourself (Settings → delete account), and leave the testers' accounts unless they ask you to delete them.
