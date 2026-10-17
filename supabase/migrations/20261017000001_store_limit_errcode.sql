-- Rename the store-limit SQLSTATE from 'BN001' to 'UT001' (app renamed to Untungin).
-- Body otherwise identical to 20261016000003_store_limit.sql; keep limits in sync with lib/config/plans.ts.
create or replace function public.enforce_store_limit()
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
    raise exception 'store limit reached' using errcode = 'UT001', hint = 'store_limit';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_store_limit() from public, anon, authenticated;
