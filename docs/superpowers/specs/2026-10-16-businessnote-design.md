# BusinessNote — Design Spec (v1)

Tanggal: 2026-10-16
Status: Draft, menunggu review

## 1. Tujuan

Web app untuk orang yang **baru mulai berjualan** (F&B dan produk olahan seperti sabun, lilin, kerajinan) agar bisa menghitung HPP, biaya operasional, harga jual, laba, BEP, dan balik modal **tanpa pengetahuan akuntansi**.

Kriteria sukses v1:
- Pengguna baru bisa login dengan Google, membuat toko, dan melihat estimasi laba bulanan setelah mengisi minimal 1 bahan + 1 produk + harga.
- Semua angka berasal dari rumus deterministik yang teruji (`lib/calc`), bukan dari AI.
- Pengguna mendapat peringatan untuk kesalahan pemula yang umum: produk rugi, margin di bawah target, gaji pemilik belum dihitung, komisi platform belum dihitung, harga jauh dari kompetitor.
- App nyaman dipakai di HP Android kelas menengah ke bawah.

### Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Mode laba | v1 = **proyeksi** (estimasi penjualan). Pencatatan aktual = tahap 2 (di luar spec ini). |
| Jenis usaha | F&B + produk olahan. Label UI umum: "Produk" & "Komposisi". Jasa & reseller di luar v1. |
| User–toko | 1 user bisa punya banyak toko. Semua data ber-`store_id`. Multi-anggota di luar v1. |
| Model bisnis | Freemium disiapkan (kolom `plan`, batas per plan), payment gateway di luar v1. |
| Arsitektur kalkulasi | Modul TypeScript murni `lib/calc`, dipakai di server dan browser. |
| AI | Google Gemini, model default **Gemini 3.5 Flash-Lite** (ID persis diverifikasi saat implementasi), lewat env var. |
| Visual | Three.js (vanilla, memakai skill `cloudai-x/threejs-skills`) untuk landing, chart 3D dashboard (dengan toggle 2D), momen tertentu, empty state. Halaman form tetap 2D. |

## 2. Stack

- Next.js (App Router, versi stabil terbaru saat implementasi), TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth (Google OAuth), RLS; `@supabase/ssr`; migrasi SQL via Supabase CLI di `supabase/migrations`
- zod (validasi input & output AI)
- `@google/genai` (Gemini SDK)
- three (vanilla Three.js)
- Vitest (unit/integration), Playwright (e2e)
- Deploy: Vercel

UI berbahasa Indonesia, mata uang Rupiah tanpa desimal, mobile-first.

## 3. Model Data

Semua tabel memiliki `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, dan (kecuali `profiles`/`stores`) `store_id uuid not null references stores(id) on delete cascade`. Uang disimpan sebagai `integer` (Rupiah). Kuantitas sebagai `numeric`.

### 3.1 Akun & toko

**`profiles`**
- `id uuid pk references auth.users(id) on delete cascade`
- `full_name text`
- `plan text not null default 'free' check (plan in ('free','pro'))`
- Dibuat otomatis oleh trigger `on auth.users insert`.

**`stores`**
- `owner_id uuid not null references profiles(id) on delete cascade`
- `name text not null`
- `business_type text not null` — `check in ('makanan','minuman','kue_roti','katering','produk_olahan','lainnya')`
- `target_margin_pct numeric not null default 40` — `check (target_margin_pct >= 0 and target_margin_pct < 100)`
- `operating_days_per_month integer not null default 26` — `check between 1 and 31`
- `target_market text null` — `check in ('menengah_bawah','menengah','menengah_atas')`; hanya dipakai sebagai konteks AI.
- Unique index `(owner_id, lower(name))`: satu user tidak boleh punya dua toko bernama sama (juga mencegah toko ganda akibat klik dua kali).

### 3.2 Bahan

**`materials`**
- `name text not null`
- `category text not null` — `check in ('bahan','kemasan')`
- `purchase_qty numeric not null check (> 0)`
- `purchase_unit text not null` — salah satu unit di §4.1
- `purchase_price integer not null check (>= 0)`
- `waste_pct numeric not null default 0 check (>= 0 and < 100)`

### 3.3 Produk & komposisi

**`products`**
- `name text not null`
- `category text null`
- `yield_qty numeric not null default 1 check (> 0)` — satu resep/batch menghasilkan berapa unit/porsi
- `target_margin_pct numeric null check (>= 0 and < 100)` — menimpa target toko jika diisi
- `is_active boolean not null default true`

**`product_materials`**
- `product_id uuid not null` — FK komposit `(product_id, store_id) → products(id, store_id)` `on delete cascade`
- `material_id uuid not null` — FK komposit `(material_id, store_id) → materials(id, store_id)` dengan `on delete no action` (menghapus bahan yang dipakai ditolak; menghapus toko tetap bisa karena dicek di akhir statement)
- `qty numeric not null check (> 0)`
- `unit text not null` — harus satu dimensi dengan `materials.purchase_unit`
- `basis text not null default 'batch'` — `check in ('batch','unit')`. `batch` = takaran untuk satu resep (dibagi `yield_qty`); `unit` = takaran per porsi/unit (misalnya 1 cup, 1 kantong). Default UI: `batch` untuk kategori bahan, `unit` untuk kategori kemasan.
- `channel_id uuid null references sales_channels(id) on delete cascade` — `null` = dipakai di semua kanal; terisi = hanya untuk kanal itu (misalnya bubble wrap hanya untuk online).

### 3.4 Kanal penjualan & harga

**`sales_channels`**
- `name text not null`
- `commission_pct numeric not null default 0 check (>= 0 and < 100)`
- `fixed_fee integer not null default 0 check (>= 0)` — biaya tetap per transaksi/unit
- `sort_order integer not null default 0`
- Saat toko dibuat, kanal **"Offline – Tunai"** (0%, 0) dibuat otomatis.

Template kanal (file `lib/config/channel-templates.ts`, bukan tabel): Offline – QRIS, GoFood, GrabFood, ShopeeFood, Shopee, Tokopedia, TikTok Shop. Nilai komisi default di template diverifikasi saat implementasi dan ditandai di UI sebagai "perkiraan, cek di dashboard merchant kamu". Pengguna selalu bisa mengedit.

**`product_channel_prices`**
- `product_id uuid not null references products(id) on delete cascade`
- `channel_id uuid not null references sales_channels(id) on delete cascade`
- `price integer not null check (>= 0)`
- `est_monthly_sales integer not null default 0 check (>= 0)`
- `competitor_price integer null check (>= 0)`
- `unique (product_id, channel_id)`

### 3.5 Biaya operasional

**`operating_expenses`**
- `name text not null`
- `category text not null` — `check in ('sewa','listrik_air','internet_pulsa','gaji_karyawan','gaji_pemilik','transportasi','pemasaran','lainnya')`
- `amount integer not null check (>= 0)`
- `frequency text not null` — `check in ('harian','mingguan','bulanan','tahunan')`

Biaya pemasaran sekali bayar (misalnya endorse) dimasukkan dengan frekuensi `tahunan` atau dibagi manual oleh pengguna; UI menjelaskan ini.

### 3.6 Inventaris / aset

**`assets`**
- `name text not null`
- `category text not null` — `check in ('peralatan','furnitur','elektronik','kendaraan','renovasi','perizinan','lainnya')`
- `qty integer not null default 1 check (>= 1)`
- `unit_price integer not null check (>= 0)`
- `useful_life_months integer not null check (>= 1)`

Total nilai aset dipakai sebagai **modal awal** untuk perhitungan balik modal.

### 3.7 AI

**`ai_analyses`**
- `user_id uuid not null references profiles(id) on delete cascade`
- `model text not null`
- `snapshot_hash text not null`
- `input_snapshot jsonb not null`
- `output jsonb not null`
- Index: `(user_id, created_at)`, `(store_id, created_at desc)`

### 3.8 Keamanan (RLS)

- RLS aktif di semua tabel.
- Fungsi `public.is_store_owner(sid uuid) returns boolean` (`security definer`, `stable`): `exists (select 1 from stores where id = sid and owner_id = auth.uid())`.
- `profiles`: select/update hanya `id = auth.uid()`. Role `authenticated` hanya diberi `grant update (full_name)`, sehingga kolom `plan` tidak bisa diubah pengguna.
- `stores`: semua operasi hanya `owner_id = auth.uid()`; insert dibatasi jumlah toko per plan (dicek di Server Action sebagai pesan ramah, dan ditegakkan di database oleh trigger `stores_enforce_limit` yang mencerminkan `lib/config/plans.ts`, SQLSTATE `BN001`; RLS tetap menjamin kepemilikan).
- Tabel ber-`store_id`: semua operasi `is_store_owner(store_id)`.
- `product_materials` dan `product_channel_prices` juga memiliki `store_id` (didenormalisasi) agar policy sederhana; **FK komposit** `(x_id, store_id) → tabel(id, store_id)` memastikan produk, bahan, dan kanal yang dirujuk berasal dari toko yang sama.
- `ai_analyses`: tidak ada policy insert/update/delete untuk pengguna; insert dilakukan Server Action memakai client secret key (`SUPABASE_SECRET_KEY`) (setelah memverifikasi sesi + kepemilikan toko). Select: `is_store_owner(store_id)`.
- Jalur ke multi-anggota nanti: tambah `store_members`, ubah isi `is_store_owner`.

### 3.9 Batas per plan

`lib/config/plans.ts`:

| Plan | Maks toko | Analisis AI per hari |
|---|---|---|
| free | 2 | 3 |
| pro | 10 | 20 |

Plan diubah manual lewat database di v1.

Batas toko juga ditegakkan oleh trigger database (`supabase/migrations/20261016000003_store_limit.sql`); angkanya harus selalu sama dengan `lib/config/plans.ts`.

## 4. Kalkulasi (`lib/calc`)

Catatan validasi (Fase 2): `localeNumber` menganggap "." sebagai desimal bila tidak ada koma. Input Rupiah butuh parser integer terpisah yang membuang titik ribuan ("15.000" → 15000).

Fungsi murni, tanpa akses database/network. Input = objek data toko lengkap (`StoreData`); output = objek hasil (`StoreMetrics`). Dipakai di Server Components (dashboard) dan Client Components (halaman produk live, simulasi).

### 4.1 Satuan

| Dimensi | Satuan dasar | Unit yang didukung |
|---|---|---|
| massa | g | g, ons (=100 g), kg (=1000 g) |
| volume | ml | ml, l (=1000 ml) |
| jumlah | pcs | pcs, lusin (=12 pcs) |

`toBase(qty, unit)` dan `sameDimension(unitA, unitB)`. Satuan rumah tangga (sdm, sdt, gelas) tidak didukung di v1.

### 4.2 Rumus

Notasi: `m` = bahan, `p` = produk, `c` = kanal, `D` = `operating_days_per_month`.

1. **Biaya bahan per satuan dasar**
   `unitCost(m) = purchase_price / (toBase(purchase_qty, purchase_unit) × (1 − waste_pct/100))`

2. **HPP bahan per unit produk per kanal**
   Baris komposisi yang berlaku untuk kanal `c`: `channel_id is null or channel_id = c`.
   `hppBahan(p, c) = Σ_batchRows(toBase(qty, unit) × unitCost(m)) / yield_qty + Σ_unitRows(toBase(qty, unit) × unitCost(m))`
   Baris dengan satuan beda dimensi dari bahannya = error validasi (ditolak saat simpan; jika tetap ada di data, `lib/calc` melempar error terstruktur, bukan menghitung diam-diam).

3. **Biaya tetap bulanan**
   Normalisasi biaya: `harian × D`, `mingguan × 52/12`, `bulanan × 1`, `tahunan / 12`.
   `penyusutanBulanan = Σ (qty × unit_price / useful_life_months)`
   `biayaTetap = Σ biaya ternormalisasi + penyusutanBulanan`

4. **HPP penuh per unit**
   `totalUnit = Σ_{p,c} est_monthly_sales` (hanya produk aktif)
   `overheadPerUnit = biayaTetap / totalUnit` (jika `totalUnit = 0` → `null`, UI menampilkan "—" + petunjuk mengisi estimasi penjualan)
   `hppPenuh(p, c) = hppBahan(p, c) + overheadPerUnit`

5. **Pendapatan bersih & kontribusi per unit**
   `net(p, c) = price × (1 − commission_pct/100) − fixed_fee`
   `kontribusi(p, c) = net(p, c) − hppBahan(p, c)`

6. **Laba bulanan**
   - `omzetKotor = Σ price × est`
   - `omzetBersih = Σ net × est`
   - `biayaBahan = Σ hppBahan × est`
   - `labaKotor = omzetBersih − biayaBahan`
   - `labaBersih = labaKotor − biayaTetap`
   - `marginBersihPct = labaBersih / omzetKotor × 100` (jika omzet 0 → `null`)

7. **BEP**
   - `kontribusiRataRata = Σ(kontribusi × est) / Σ est`
   - Jika `Σ est = 0` → BEP `null` ("isi estimasi penjualan").
   - Jika `kontribusiRataRata ≤ 0` → BEP `null` + peringatan "Setiap penjualan rugi".
   - `bepUnitBulanan = ceil(biayaTetap / kontribusiRataRata)`; `bepUnitHarian = ceil(bepUnitBulanan / D)`

8. **Balik modal**
   `totalModal = Σ qty × unit_price` (aset)
   `bulanBalikModal = totalModal / labaBersih` jika `labaBersih > 0`, selain itu `null`.

9. **Rekomendasi harga per produk per kanal**
   `margin = (products.target_margin_pct ?? stores.target_margin_pct) / 100`
   `k = commission_pct / 100`
   Jika `k + margin ≥ 1` → `null` + pesan "Komisi + target margin ≥ 100%, tidak ada harga yang memenuhi".
   Jika `hppPenuh` `null` → pakai `hppBahan` dan tandai "belum termasuk biaya operasional".
   `hargaRekomendasi = ceilTo500((hppPenuh + fixed_fee) / (1 − k − margin))`
   Margin di sini = persentase laba terhadap harga jual (bukan markup). UI menjelaskan bedanya.

### 4.3 Status & peringatan (deterministik)

Per `(p, c)`:
- **merah**: `kontribusi < 0`
- **kuning**: margin aktual `(net − hppPenuh) / price < target` (atau `hppBahan` jika `hppPenuh` null)
- **hijau**: margin aktual ≥ target

Peringatan toko (`StoreMetrics.warnings`):
- `NO_OWNER_SALARY`: tidak ada biaya kategori `gaji_pemilik` → "Laba terlihat lebih besar karena gajimu sendiri belum dihitung."
- `LOSS_PRODUCTS`: ada produk merah
- `BELOW_TARGET`: ada produk kuning
- `NEGATIVE_CONTRIBUTION`: kontribusi rata-rata ≤ 0
- `NO_SALES_ESTIMATE`: `Σ est = 0`
- `COMPETITOR_GAP`: `|price − competitor_price| / competitor_price > 0.25`
- `NET_LOSS`: `labaBersih < 0`

### 4.4 Simulasi what-if

`applyOverrides(data: StoreData, o: Overrides): StoreData` lalu dihitung ulang dengan fungsi yang sama.

```ts
type Overrides = {
  materialPricePct?: Record<string /* materialId | 'all' */, number>; // +50 = naik 50%
  salesMultiplier?: number;                                          // 1.2 = naik 20%
  prices?: Record<`${string}:${string}` /* productId:channelId */, number>;
};
```

Tidak disimpan ke database. Halaman simulasi menampilkan metrik "Sekarang" dan "Simulasi" berdampingan beserta selisihnya. Overrides bisa diisi dari query string (dipakai tombol "Coba di simulasi" dari AI).

## 5. Alur & Halaman

### 5.1 Auth & onboarding
1. `/` landing: hero 3D, penjelasan singkat, tombol "Masuk dengan Google".
2. `/login` → Supabase Google OAuth → `/auth/callback` (tukar code jadi sesi).
3. Belum punya toko → `/onboarding`, wizard 2 langkah:
   - nama toko, jenis usaha, target pasar (opsional)
   - hari buka per bulan, target margin (default + penjelasan margin vs markup)
   - Toko dibuat + kanal "Offline – Tunai".
   - Alternatif: tombol **"Coba dengan data contoh"** membuat toko demo (kedai kopi) lengkap dengan bahan, kemasan, produk, kanal (termasuk GoFood + kemasan khusus online), biaya (termasuk gaji pemilik), aset, dan harga kompetitor. Implementasi: satu fungsi seed di server.
4. Masuk dashboard.

### 5.2 Halaman toko (`/s/[storeId]/...`)

| Route | Isi |
|---|---|
| `dashboard` | Kartu: laba bersih, omzet, BEP/hari, balik modal. Peringatan. Chart produk (3D, toggle 2D). Tabel produk dengan status warna. **Checklist setup** selama belum lengkap: Bahan → Produk → Biaya operasional → **Gaji kamu sendiri** → Inventaris → Kanal online (opsional). |
| `bahan` | Daftar + form bahan; biaya per satuan dasar tampil live. |
| `produk` | Daftar produk + status. |
| `produk/[id]` | Editor komposisi (bahan, takaran, satuan, basis batch/unit, kanal), HPP live per kanal, harga + estimasi penjualan + harga kompetitor per kanal, perbandingan harga kamu vs rekomendasi vs kompetitor, tombol "Pakai harga rekomendasi". |
| `biaya` | Biaya operasional per kategori, total bulanan. |
| `inventaris` | Aset, penyusutan bulanan, total modal. |
| `kanal` | Kanal penjualan + tambah dari template. |
| `simulasi` | Slider/input overrides, perbandingan Sekarang vs Simulasi. |
| `analisis` | Tombol "Analisis usahaku", hasil terbaru, riwayat, sisa kuota, catatan privasi. |
| `pengaturan` | Edit data toko, hapus toko (konfirmasi ketik nama toko). |

Lainnya: `/toko` (daftar toko, pindah, tambah baru), `/privasi` (kebijakan privasi).

Navigasi: bottom nav di HP (Dashboard, Produk, Bahan, Lainnya), sidebar di desktop, pemilih toko di header.

### 5.3 Mutasi & error
- Semua mutasi lewat Server Actions; input divalidasi zod; error dikembalikan per field dalam bahasa Indonesia.
- Menghapus bahan yang dipakai produk ditolak (FK `restrict`) dengan pesan "Dipakai di: <daftar produk>".
- Proxy (`proxy.ts`, Next.js 16): route `/s/*`, `/onboarding`, `/toko`, `/mulai` butuh sesi; server memakai `auth.getClaims()`, bukan `getSession()`. `storeId` yang bukan milik user → 404 (RLS mengembalikan kosong).
- Empty state di setiap daftar: penjelasan + contoh + tombol aksi.

## 6. Fitur AI

### 6.1 Alur
1. User menekan "Analisis usahaku".
2. Server Action: cek sesi + kepemilikan toko; hitung analisis user hari ini (00:00–24:00 Asia/Jakarta) dari `ai_analyses`; tolak jika ≥ batas plan. Catatan: menghitung dari `ai_analyses` ikut ter-reset saat toko dihapus (cascade). Fase 5 harus menghitung pemakaian secara independen dari penghapusan toko (mis. ledger pemakaian per `user_id`, atau `store_id` nullable dengan `on delete set null`).
3. `buildSnapshot(storeData, metrics)` → JSON ringkas: info toko (termasuk `target_market`), per produk per kanal (hppBahan, hppPenuh, harga, kompetitor, net, kontribusi, margin, status, est), total (omzet, laba, biaya tetap per kategori, penyusutan), BEP, balik modal, `warnings`.
4. `snapshot_hash = sha256(canonicalJSON(snapshot))`. Jika sama dengan analisis terakhir toko ini → kembalikan hasil lama, tidak memanggil AI, tidak memotong kuota.
5. `lib/ai/analyze.ts` memanggil Gemini dengan structured output (response JSON schema), timeout 30 detik.
6. Validasi output dengan zod. Gagal/timeout/invalid → error "Analisis gagal, coba lagi", tidak disimpan, kuota tidak terpotong.
7. Simpan ke `ai_analyses`, tampilkan.

### 6.2 Skema output

```ts
{
  summary: string;                       // 2–4 kalimat
  highlights: string[];                  // hal yang sudah baik
  issues: {
    title: string;
    explanation: string;
    related_product_ids: string[];
    priority: 'tinggi' | 'sedang' | 'rendah';
  }[];
  recommendations: {
    action: string;
    reason: string;
    simulation?:
      | { type: 'change_price'; product_id: string; channel_id: string; new_price: number }
      | { type: 'change_material_price'; material_id: string; pct: number }
      | { type: 'change_sales_volume'; multiplier: number };
  }[];
}
```

ID yang dirujuk divalidasi terhadap snapshot; rekomendasi dengan ID tidak dikenal kehilangan `simulation`-nya (teks tetap ditampilkan). `simulation` dipetakan ke `Overrides` (§4.4) dan dibuka lewat tombol **"Coba di simulasi"**.

### 6.3 Aturan prompt
- Hanya mengutip angka yang ada di snapshot; dilarang membuat angka baru. Dampak angka dihitung `lib/calc` lewat simulasi.
- Bahasa Indonesia sederhana, tanpa jargon akuntansi.
- Wajib menyinggung peringatan di `warnings`, terutama `NO_OWNER_SALARY` dan `LOSS_PRODUCTS`.
- Memakai `competitor_price` dan `target_market` sebagai konteks saran harga.

### 6.4 Konfigurasi & privasi
- Env: `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Semua akses Gemini hanya di server (`lib/ai`, `server-only`).
- Halaman analisis dan `/privasi` menyatakan data toko dikirim ke Google Gemini untuk dianalisis.

## 7. Visual 3D

- Library: `three` vanilla, dibungkus Client Component yang membuat/menghapus renderer di `useEffect`; dimuat dengan `next/dynamic` `{ ssr: false }`.
- Lokasi:
  - Landing: hero 3D interaktif.
  - Dashboard: chart produk 3D (batang laba/kontribusi per produk) dengan **label angka**; toggle 3D/2D; pilihan disimpan di `localStorage` (try/catch).
  - Momen: animasi saat onboarding selesai dan saat laba bersih pertama kali > 0.
  - Empty state: ilustrasi 3D ringan.
- Fallback ke 2D/statis jika: `prefers-reduced-motion: reduce`, WebGL tidak tersedia, atau perangkat lemah (`navigator.hardwareConcurrency ≤ 4` atau `deviceMemory ≤ 4` bila tersedia).
- Renderer: `pixelRatio` dibatasi ≤ 2; render loop berhenti saat canvas tidak terlihat (IntersectionObserver) atau tab tersembunyi; geometri/material di-dispose saat unmount.
- Halaman form (bahan, produk, biaya, inventaris, kanal) tidak memuat Three.js.

## 8. Struktur Kode

```
app/
  (marketing)/page.tsx            landing
  privasi/page.tsx
  login/page.tsx
  auth/callback/route.ts
  onboarding/page.tsx
  toko/page.tsx
  s/[storeId]/
    layout.tsx                    nav + pemilih toko + load StoreData
    dashboard/ bahan/ produk/ produk/[id]/ biaya/ inventaris/ kanal/ simulasi/ analisis/ pengaturan/
lib/
  calc/        units.ts materials.ts products.ts expenses.ts assets.ts metrics.ts pricing.ts warnings.ts overrides.ts index.ts
  ai/          analyze.ts schema.ts snapshot.ts prompt.ts
  supabase/    server.ts client.ts middleware.ts
  data/        load-store-data.ts (query Supabase → StoreData)
  validation/  zod schema per entitas
  config/      plans.ts channel-templates.ts
  seed/        demo-store.ts
components/
  ui/          (shadcn)
  three/       HeroScene.tsx ProfitChart3D.tsx Celebration.tsx useWebGLSupport.ts
  ...
supabase/
  migrations/
tests/
  unit/ rls/ e2e/
proxy.ts                         (Next.js 16: pengganti middleware.ts)
```

## 9. Testing

- **`lib/calc`** (paling kritis): unit test table-driven dengan contoh yang dihitung manual, mencakup: konversi satuan; bahan dengan susut; komposisi batch vs unit; kemasan khusus kanal; normalisasi frekuensi; penyusutan; overhead dengan `totalUnit = 0`; laba; BEP (normal, `Σ est = 0`, kontribusi ≤ 0); balik modal (laba ≤ 0); rekomendasi harga (normal, override margin produk, `k + margin ≥ 1`, pembulatan Rp500); setiap kode peringatan; overrides.
- **RLS**: integration test ke Supabase lokal — user A tidak bisa select/insert/update/delete data toko user B di setiap tabel; user tidak bisa mengubah `plan`.
- **Validasi**: test schema zod untuk tiap entitas (termasuk dimensi satuan tidak cocok).
- **AI**: Gemini di-mock; test `buildSnapshot`, hash stabil, cache hit, kuota (termasuk batas hari WIB), output valid, output rusak, ID tidak dikenal.
- **E2E (Playwright)**: onboarding → tambah bahan → tambah produk + harga → dashboard menampilkan laba. Login e2e/dev memakai email/password lewat form "Masuk (dev)" yang hanya tampil jika `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true` (lokal saja).

## 10. Tahapan Implementasi

Setiap tahap bisa di-deploy. Satu implementation plan per tahap.

1. **Fondasi**: scaffold Next.js, Tailwind, shadcn; skema database + RLS + trigger profil; login Google; middleware; onboarding (tanpa data contoh); `/toko`; layout + navigasi.
2. **Inti HPP**: `lib/calc` (TDD); halaman bahan, produk + komposisi, biaya operasional, inventaris; dashboard 2D (kartu, peringatan, tabel, checklist).
3. **Kanal & harga**: kanal + template; harga/estimasi/kompetitor per kanal; kemasan khusus kanal; rekomendasi harga.
4. **Simulasi what-if**.
5. **Analisis AI**: `lib/ai`, kuota, cache, riwayat, "Coba di simulasi".
6. **Visual 3D**: pasang threejs-skills; hero landing; chart 3D + toggle; animasi momen; empty state 3D; fallback.
7. **Finishing**: data contoh, halaman privasi, polish, deploy production.

## 11. Setup Manual (dilakukan pemilik project)

- Buat project Supabase (production) dan catat URL + anon key + service role key.
- Buat OAuth Client di Google Cloud Console; redirect URI ke callback Supabase; aktifkan provider Google di Supabase Auth; tambahkan URL Vercel ke Redirect URLs Supabase.
- Buat API key Gemini di Google AI Studio.
- Set env di Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (server only), `GEMINI_API_KEY`, `GEMINI_MODEL`. Jangan pernah set `NEXT_PUBLIC_ENABLE_DEV_LOGIN` di Vercel.
- Di Supabase production: nonaktifkan provider Email (hanya Google).
- Dev lokal: Docker + Supabase CLI (`supabase start`).

## 12. Di Luar Lingkup v1

- Pencatatan penjualan & pembelian aktual (tahap 2)
- Multi-anggota toko & peran
- Payment gateway / langganan Pro
- Usaha jasa & reseller sebagai tipe produk khusus
- Satuan rumah tangga (sdm, sdt, gelas)
- Export PDF/Excel
- App mobile native
