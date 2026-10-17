-- The app must not rely on Supabase's default grants (they can change per project or version).
-- State exactly what the signed-in role may do; RLS still limits the rows.
grant select, insert, update, delete on
  public.stores, public.sales_channels, public.materials, public.products, public.product_materials,
  public.product_channel_prices, public.operating_expenses, public.assets
  to authenticated;

-- Read-only for the user; the server writes these with the secret key.
grant select on public.profiles, public.ai_analyses, public.ai_usage to authenticated;

-- The only profile columns a user may change (re-stated).
grant update (full_name, locale) on public.profiles to authenticated;
