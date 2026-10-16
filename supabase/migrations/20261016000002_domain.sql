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
