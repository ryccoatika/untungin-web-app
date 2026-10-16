-- Saved UI language per user (null = not chosen yet) ----------------------
alter table public.profiles
  add column locale text check (locale in ('id', 'en'));

revoke update on public.profiles from authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

-- create_store: the app passes the default channel name in the user's locale --
drop function public.create_store(text, text, integer, numeric, text);

create function public.create_store(
  p_name text,
  p_business_type text,
  p_operating_days integer,
  p_target_margin numeric,
  p_target_market text default null,
  p_default_channel_name text default 'Offline – Tunai'
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
  values (v_store_id, coalesce(nullif(trim(p_default_channel_name), ''), 'Offline – Tunai'), 0, 0, 0);

  return v_store_id;
end;
$$;

revoke execute on function public.create_store(text, text, integer, numeric, text, text) from public, anon;
grant execute on function public.create_store(text, text, integer, numeric, text, text) to authenticated;
