-- Least privilege for the API roles. RLS already limits rows; these grants remove what RLS does
-- not govern (TRUNCATE, TRIGGER, REFERENCES) and all table access for anon, which never reads app
-- data (the landing and login pages only talk to Supabase Auth).
-- New tables get Supabase's broad default grants: repeat this pattern in every migration that adds one.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'stores', 'sales_channels', 'materials', 'products', 'product_materials',
    'product_channel_prices', 'operating_expenses', 'assets', 'ai_analyses', 'ai_usage'
  ] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
  end loop;
end;
$$;

-- The server writes AI results and usage with the secret key (Phase 5); make that explicit
-- instead of relying on Supabase's default grants.
grant select, insert, update, delete on public.ai_analyses, public.ai_usage to service_role;
