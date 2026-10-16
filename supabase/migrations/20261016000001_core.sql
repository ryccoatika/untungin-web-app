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
