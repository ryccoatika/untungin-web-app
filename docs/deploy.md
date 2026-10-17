# Production deploy checklist

Run in order. Every value marked *secret* goes only into Vercel's environment settings, never into code, chat or `NEXT_PUBLIC_*`.

## 1. Google Cloud (OAuth client)
1. Credentials → OAuth client (Web): authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback` (keep `http://127.0.0.1:54321/auth/v1/callback` for local development). `<ref>` is the production Supabase project ref; create the Supabase project first (section 2, step 1) if you do not have it yet. Note the client id and *secret*.
2. OAuth consent screen:
   - App name Untungin; support and developer contact email `me@ryccoatika.com`.
   - Authorized domains: `ryccoatika.com` and `<ref>.supabase.co`.
   - Privacy policy URL `https://untungin.ryccoatika.com/privasi`.
   - Publishing status: **In production**. Do not leave it on Testing: Testing only allows listed test users and expires sessions after 7 days.

## 2. Supabase (production project)
1. Create the project (region: Singapore, closest to Indonesia).
2. Link and push the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Confirm every file in `supabase/migrations/` is listed as applied.
3. Auth → Providers: enable **Google** (client id + *secret* from section 1); **disable Email**.
4. Auth → URL configuration: Site URL `https://untungin.ryccoatika.com`; Redirect URLs `https://untungin.ryccoatika.com/**` (add `https://<project>-*.vercel.app/**` only if you use preview deployments).
5. Check the grants (SQL editor):
   ```sql
   select table_name, grantee, string_agg(privilege_type, ',' order by privilege_type) as privileges
   from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
   group by 1, 2 order by 1, 2;
   select table_name, grantee, column_name, privilege_type
   from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
   order by 3;
   ```
   Expect exactly:
   - `anon`: no rows on any app table.
   - `authenticated`: `DELETE,INSERT,SELECT,UPDATE` on `stores`, `sales_channels`, `materials`, `products`, `product_materials`, `product_channel_prices`, `operating_expenses`, `assets`.
   - `authenticated`: `SELECT` only on `profiles`, `ai_analyses`, `ai_usage`, plus column `UPDATE` on `profiles.full_name` and `profiles.locale` (second query).
6. Note the project URL, the publishable key and the *secret* key.

## 3. Gemini
1. Create an API key in Google AI Studio (aistudio.google.com/apikey) — it enables the Gemini API for its project.
2. Use a paid (billing-enabled) key: a paid key keeps prompts out of Google's model training. On the free tier Google may use the data sent to improve its products and people may review it; the privacy page discloses that case.

## 4. Vercel
1. Import the GitHub repo; framework Next.js.
2. Settings → Functions → Function Region: `sin1` (Singapore), next to the database.
3. Environment variables (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (*secret*, server only)
   - `GEMINI_API_KEY` (*secret*, server only); optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`)
4. Domain: add `untungin.ryccoatika.com` and the DNS record Vercel shows.
5. Redirect `www.` and the `*.vercel.app` production alias to `https://untungin.ryccoatika.com` (Domains → Redirect to), so Google sign-in always returns to an allowed URL.

## 5. Smoke test after deploy
1. `/` loads with the 3D hero (or the static drawing on reduced motion); `/privasi` loads signed out.
2. Sign in with Google → onboarding → "Coba dengan data contoh" → dashboard shows profit.
3. `/s/<id>/analisis` → "Analisis usahaku" returns a result; pressing again says the data hasn't changed.
4. Settings → delete the sample store; then delete a throwaway account and confirm you're signed out.
5. Supabase Auth logs show no email sign-ins (Email provider off).
