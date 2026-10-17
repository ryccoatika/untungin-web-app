# Production deploy checklist

Run in order. Every value marked *secret* goes only into Vercel's environment settings, never into code, chat or `NEXT_PUBLIC_*`.

## 1. Supabase (production project)
1. Create the project (region: Singapore, closest to Indonesia).
2. Link and push the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Confirm every file in `supabase/migrations/` is listed as applied.
3. Check the AI tables and grants (SQL editor):
   `select grantee, privilege_type from information_schema.role_table_grants where table_name in ('ai_usage','ai_analyses','stores') and grantee in ('anon','authenticated') order by 1,2;`
   Expect: no `anon` rows; `authenticated` without TRUNCATE/TRIGGER/REFERENCES.
4. Auth → Providers: enable **Google** (client id + *secret* from step 2 below); **disable Email**.
5. Auth → URL configuration: Site URL `https://untungin.ryccoatika.com`; Redirect URLs `https://untungin.ryccoatika.com/**` (add `https://<project>-*.vercel.app/**` only if you use preview deployments).
6. Note the project URL, the publishable key and the *secret* key.

## 2. Google Cloud (OAuth client)
1. Credentials → OAuth client (Web): authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback` (keep `http://127.0.0.1:54321/auth/v1/callback` for local development).
2. OAuth consent screen: app name Untungin, support email me@ryccoatika.com, privacy policy URL `https://untungin.ryccoatika.com/privasi`.

## 3. Gemini
1. Create an API key in Google AI Studio (aistudio.google.com/apikey) — it enables the Gemini API for its project.
2. Decide the tier: on the free tier Google may use prompts to improve its products; a paid-tier key avoids that (the privacy page says Google processes the data under the Gemini API terms).

## 4. Vercel
1. Import the GitHub repo; framework Next.js.
2. Environment variables (Production):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (*secret*, server only)
   - `GEMINI_API_KEY` (*secret*, server only); optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`)
   - never set `NEXT_PUBLIC_ENABLE_DEV_LOGIN`
3. Domain: add `untungin.ryccoatika.com` and the DNS record Vercel shows.

## 5. Smoke test after deploy
1. `/` loads with the 3D hero (or the static drawing on reduced motion); `/privasi` loads signed out.
2. Sign in with Google → onboarding → "Coba dengan data contoh" → dashboard shows profit.
3. `/s/<id>/analisis` → "Analisis usahaku" returns a result; pressing again says the data hasn't changed.
4. Settings → delete the sample store; then delete a throwaway account and confirm you're signed out.
5. Supabase Auth logs show no email sign-ins (Email provider off).
