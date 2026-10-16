-- Store limit enforced in the database -------------------------------------
-- Limits mirror lib/config/plans.ts (free = 2 stores, pro = 10). Keep both in sync.
-- Raises SQLSTATE 'BN001' (custom) when the owner already has the maximum.
create function public.enforce_store_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  -- Lock the owner's profile row so concurrent inserts for one owner serialize.
  select plan into v_plan from public.profiles where id = new.owner_id for update;
  v_limit := case v_plan when 'pro' then 10 else 2 end;

  select count(*) into v_count from public.stores where owner_id = new.owner_id;
  if v_count >= v_limit then
    raise exception 'store limit reached' using errcode = 'BN001', hint = 'store_limit';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_store_limit() from public, anon, authenticated;

create trigger stores_enforce_limit
  before insert on public.stores
  for each row execute function public.enforce_store_limit();

-- Trim-aware unique store name per owner.
drop index public.stores_owner_name_key;
create unique index stores_owner_name_key on public.stores (owner_id, lower(trim(name)));
