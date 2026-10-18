-- Household recipe units (sdm, sdt, gelas). Purchases keep their units; only recipes gain these.
-- Weight materials need their spoon weight to convert: grams in one level tablespoon.
alter table public.materials
  add column grams_per_sdm numeric check (grams_per_sdm > 0 and grams_per_sdm <= 1000);

alter table public.product_materials drop constraint product_materials_unit_check;
alter table public.product_materials add constraint product_materials_unit_check
  check (unit in ('g', 'ons', 'kg', 'ml', 'l', 'pcs', 'lusin', 'sdm', 'sdt', 'gelas'));
