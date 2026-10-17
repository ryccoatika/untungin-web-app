-- AI usage ledger (spec §6.1 step 2): one row per analysis that reached Gemini, counted per user per
-- Asia/Jakarta day. Kept apart from ai_analyses so deleting a store does not give the quota back.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated using (user_id = auth.uid());

-- Takes one unit of quota atomically. p_since is the start of the user's day (lib/ai/quota.ts);
-- p_limit comes from lib/config/plans.ts. Returns the new usage id, or null when the quota is used up
-- or the user does not exist. Only the server calls it, with the secret key.
create function public.claim_ai_usage(p_user_id uuid, p_since timestamptz, p_limit integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_id uuid;
begin
  -- Lock the profile row so concurrent claims for one user serialize.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    return null;
  end if;

  select count(*) into v_count
  from public.ai_usage
  where user_id = p_user_id and created_at >= p_since;
  if v_count >= p_limit then
    return null;
  end if;

  insert into public.ai_usage (user_id) values (p_user_id) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.claim_ai_usage(uuid, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_ai_usage(uuid, timestamptz, integer) to service_role;
