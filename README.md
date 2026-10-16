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
   - OAuth consent screen: isi nama aplikasi, email dukungan, dan authorized domain, lalu publikasikan ("In production"); kalau tidak, akun Google non-test mendapat error `access_denied`.
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
