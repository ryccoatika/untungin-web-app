-- Recorded consent to the terms and the AI terms: one row per acceptance, per user and version.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'ai')),
  version text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now()
);
create index consents_user_kind_idx on public.consents (user_id, kind);

comment on table public.consents is
  'Append-only proof of consent: users can insert and read their own rows, never update or delete them.';

alter table public.consents enable row level security;
create policy consents_select on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- The column grant is how the database, not the client, sets accepted_at.
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
grant insert (user_id, kind, version) on public.consents to authenticated;
