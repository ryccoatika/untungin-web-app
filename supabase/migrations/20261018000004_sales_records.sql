-- Sales and purchase records ("Catat"): actual daily sales per product and channel, and purchases.
-- Lines keep snapshots (names, price, net price, HPP) so history survives later edits and deletions.

-- Sales days ------------------------------------------------------------------
create table public.sales_days (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  date date not null,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, date),
  unique (id, store_id)
);

-- Sales lines -----------------------------------------------------------------
create table public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  day_id uuid not null,
  product_id uuid,
  channel_id uuid,
  product_name text not null check (length(trim(product_name)) between 1 and 80),
  channel_name text not null check (length(trim(channel_name)) between 1 and 80),
  qty integer not null check (qty > 0 and qty <= 9999),
  unit_price integer not null check (unit_price >= 0),
  net_unit numeric not null,
  hpp_unit numeric not null check (hpp_unit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_id, product_id, channel_id),
  foreign key (day_id, store_id) references public.sales_days (id, store_id) on delete cascade,
  foreign key (product_id, store_id) references public.products (id, store_id) on delete set null (product_id),
  foreign key (channel_id, store_id) references public.sales_channels (id, store_id) on delete set null (channel_id)
);
create index sales_lines_store_id_idx on public.sales_lines (store_id);
create index sales_lines_day_id_idx on public.sales_lines (day_id);

-- Purchases -------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  material_id uuid,
  material_name text not null check (length(trim(material_name)) between 1 and 80),
  date date not null,
  qty numeric not null check (qty > 0),
  unit text not null check (unit in ('g', 'ons', 'kg', 'ml', 'l', 'pcs', 'lusin')),
  total_paid integer not null check (total_paid >= 0),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (material_id, store_id) references public.materials (id, store_id) on delete set null (material_id)
);
create index purchases_store_date_idx on public.purchases (store_id, date);
create index purchases_material_date_idx on public.purchases (material_id, date);

-- RLS + grants ------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['sales_days', 'sales_lines', 'purchases'] loop
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
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- save_sales_day: upsert lines of one day atomically ---------------------------
-- qty = 0 removes the pair; lines not mentioned stay; snapshots change only when qty changes.
create function public.save_sales_day(p_store_id uuid, p_date date, p_lines jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_day_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_date > v_today or p_date < v_today - 92 then
    raise exception 'date out of range' using errcode = 'UT002', hint = 'date_out_of_range';
  end if;

  insert into public.sales_days (store_id, date, closed)
  values (p_store_id, p_date, false)
  on conflict (store_id, date) do update set closed = false, updated_at = now()
  returning id into v_day_id;

  delete from public.sales_lines l
  using jsonb_to_recordset(p_lines) as x(product_id uuid, channel_id uuid, qty integer)
  where x.qty = 0
    and l.day_id = v_day_id
    and l.product_id = x.product_id
    and l.channel_id = x.channel_id;

  insert into public.sales_lines as l
    (store_id, day_id, product_id, channel_id, product_name, channel_name, qty, unit_price, net_unit, hpp_unit)
  select p_store_id, v_day_id, x.product_id, x.channel_id, x.product_name, x.channel_name,
         x.qty, x.unit_price, x.net_unit, x.hpp_unit
  from jsonb_to_recordset(p_lines) as x(
    product_id uuid, channel_id uuid, product_name text, channel_name text,
    qty integer, unit_price integer, net_unit numeric, hpp_unit numeric
  )
  where x.qty > 0
  on conflict (day_id, product_id, channel_id) do update set
    product_name = case when l.qty <> excluded.qty then excluded.product_name else l.product_name end,
    channel_name = case when l.qty <> excluded.qty then excluded.channel_name else l.channel_name end,
    unit_price = case when l.qty <> excluded.qty then excluded.unit_price else l.unit_price end,
    net_unit = case when l.qty <> excluded.qty then excluded.net_unit else l.net_unit end,
    hpp_unit = case when l.qty <> excluded.qty then excluded.hpp_unit else l.hpp_unit end,
    updated_at = case when l.qty <> excluded.qty then now() else l.updated_at end,
    qty = excluded.qty;

  if not exists (select 1 from public.sales_lines where day_id = v_day_id) then
    delete from public.sales_days where id = v_day_id;
  end if;
end;
$$;

-- close_sales_day: "nothing sold" ------------------------------------------------
create function public.close_sales_day(p_store_id uuid, p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_day_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_date > v_today or p_date < v_today - 92 then
    raise exception 'date out of range' using errcode = 'UT002', hint = 'date_out_of_range';
  end if;

  insert into public.sales_days (store_id, date, closed)
  values (p_store_id, p_date, true)
  on conflict (store_id, date) do update set closed = true, updated_at = now()
  returning id into v_day_id;

  delete from public.sales_lines where day_id = v_day_id;
end;
$$;

-- delete_sales_line ---------------------------------------------------------------
create function public.delete_sales_line(p_line_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  delete from public.sales_lines where id = p_line_id returning day_id into v_day_id;
  if v_day_id is null then
    return;
  end if;

  if not exists (select 1 from public.sales_lines where day_id = v_day_id) then
    delete from public.sales_days where id = v_day_id and not closed;
  end if;
end;
$$;

-- save_purchase: insert or update, and move the material price when this is the latest ---
create function public.save_purchase(
  p_store_id uuid,
  p_purchase_id uuid,
  p_material_id uuid,
  p_date date,
  p_qty numeric,
  p_unit text,
  p_total_paid integer,
  p_new_price integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_name text;
  v_id uuid;
  v_saved_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_date > v_today or p_date < v_today - 92 then
    raise exception 'date out of range' using errcode = 'UT002', hint = 'date_out_of_range';
  end if;

  select name into v_name from public.materials where id = p_material_id and store_id = p_store_id;
  if v_name is null then
    raise exception 'material not found' using errcode = 'P0002';
  end if;

  if p_purchase_id is null then
    insert into public.purchases (store_id, material_id, material_name, date, qty, unit, total_paid, saved_at)
    values (p_store_id, p_material_id, v_name, p_date, p_qty, p_unit, p_total_paid, v_saved_at)
    returning id into v_id;
  else
    update public.purchases
    set material_id = p_material_id, material_name = v_name, date = p_date, qty = p_qty,
        unit = p_unit, total_paid = p_total_paid, saved_at = v_saved_at
    where id = p_purchase_id and store_id = p_store_id
    returning id into v_id;
    if v_id is null then
      raise exception 'purchase not found' using errcode = 'P0002';
    end if;
  end if;

  if exists (
    select 1 from public.purchases
    where material_id = p_material_id and id <> v_id and (date, saved_at) > (p_date, v_saved_at)
  ) then
    return false;
  end if;

  update public.materials set purchase_price = p_new_price
  where id = p_material_id and store_id = p_store_id;
  return true;
end;
$$;

revoke execute on function public.save_sales_day(uuid, date, jsonb) from public, anon;
revoke execute on function public.close_sales_day(uuid, date) from public, anon;
revoke execute on function public.delete_sales_line(uuid) from public, anon;
revoke execute on function public.save_purchase(uuid, uuid, uuid, date, numeric, text, integer, integer) from public, anon;
grant execute on function public.save_sales_day(uuid, date, jsonb) to authenticated;
grant execute on function public.close_sales_day(uuid, date) to authenticated;
grant execute on function public.delete_sales_line(uuid) to authenticated;
grant execute on function public.save_purchase(uuid, uuid, uuid, date, numeric, text, integer, integer) to authenticated;
