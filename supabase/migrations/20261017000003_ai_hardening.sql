-- Only the server (secret key) writes ai_usage and ai_analyses. Supabase's default grants give anon and
-- authenticated every privilege, including TRUNCATE, TRIGGER and REFERENCES, which RLS does not govern.
-- Reduce them to read-only for signed-in users (RLS still limits rows to the owner).
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
revoke all on public.ai_analyses from anon, authenticated;
grant select on public.ai_analyses to authenticated;

-- Same body as before, with a weaker profile lock (FK checks no longer block on it; claims still
-- serialize with each other) and a null limit treated as "no quota".
create or replace function public.claim_ai_usage(p_user_id uuid, p_since timestamptz, p_limit integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_id uuid;
begin
  perform 1 from public.profiles where id = p_user_id for no key update;
  if not found then
    return null;
  end if;

  select count(*) into v_count
  from public.ai_usage
  where user_id = p_user_id and created_at >= p_since;
  if p_limit is null or v_count >= p_limit then
    return null;
  end if;

  insert into public.ai_usage (user_id) values (p_user_id) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.claim_ai_usage(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_usage(uuid, timestamptz, integer) to service_role;
