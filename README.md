# BusinessNote

Web app for first-time sellers: calculate COGS (HPP), selling price, operating costs, profit, break-even point, and payback period.

Spec: `docs/superpowers/specs/2026-10-16-businessnote-design.md`

## Local development

Requires: Node.js 24+, Docker Desktop (running).

```bash
npm install
npm run db:start      # local Supabase in Docker (first start takes a while)
npm run env:local     # write local Supabase URL & keys to .env.local
npm run db:reset      # apply all migrations
npm run dev           # http://localhost:3000
```

Local sign-in uses the **Masuk (dev)** form (any email + password; the account is created automatically).
Supabase Studio: http://127.0.0.1:54323

## Tests

```bash
npm test              # unit
npm run test:rls      # RLS; needs local Supabase running
npm run test:e2e      # Playwright; needs local Supabase running
```

## After changing the schema

```bash
npx supabase migration new <name>   # write SQL in the new file
npm run db:reset && npm run db:types
```

## Production setup (one-time, manual)

1. **Supabase**: create a new project. Note the Project URL, publishable key, and secret key
   (Project Settings → API Keys).
2. **Migrations**: `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
3. **Google OAuth**:
   - Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`.
   - OAuth consent screen: fill in the app name, support email, and authorized domain, then publish it ("In production"); otherwise non-test Google accounts get `access_denied`.
   - Supabase → Authentication → Sign In / Providers → Google: enter the Client ID & Secret and enable it.
   - Supabase → Authentication → Sign In / Providers → **Email: disable it** (production uses Google only).
   - Supabase → Authentication → URL Configuration: Site URL = the Vercel production URL;
     add `https://<vercel-domain>/**` to Redirect URLs (and preview URLs if needed).
4. **Vercel**: import the repo and set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server only)
   - **Never** set `NEXT_PUBLIC_ENABLE_DEV_LOGIN`.
5. Upgrading a user to Pro (temporary, manual): run
   `update public.profiles set plan = 'pro' where id = '<user-id>';` in the Supabase SQL editor.

## Translations

The UI is available in Indonesian (`id`, default) and English (`en`); every page lives under `/id/...` or `/en/...`.

- Messages: `messages/id.json` and `messages/en.json`. Both files must have the same keys (`tests/unit/messages.test.ts` enforces this).
- Server Components: `const t = await getTranslations("Namespace")`; Client Components: `const t = useTranslations("Namespace")`.
- Links and redirects: import `Link`, `redirect`, `usePathname`, `useRouter` from `@/i18n/navigation` and pass unprefixed paths.
- Intentional exceptions: `app/[locale]/login/actions.ts` and `app/auth/callback/route.ts` redirect to already-prefixed same-origin paths with `next/navigation` / `NextResponse.redirect`, because the locale-aware `redirect` would double-prefix them.
- Zod schemas return message keys under `Validation`; Server Actions translate them with `getValidationTranslator()` + `translateFieldErrors()`.
