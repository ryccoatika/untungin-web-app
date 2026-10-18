-- delete_sales_day: remove a day's record (a mistaken day, or a "closed" mark) -------------
create function public.delete_sales_day(p_store_id uuid, p_date date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_date > v_today or p_date < v_today - 92 then
    raise exception 'date out of range' using errcode = 'UT002', hint = 'date_out_of_range';
  end if;

  -- RLS limits this to the caller's own stores; the lines go with the day (on delete cascade).
  delete from public.sales_days where store_id = p_store_id and date = p_date;
end;
$$;

revoke execute on function public.delete_sales_day(uuid, date) from public, anon;
grant execute on function public.delete_sales_day(uuid, date) to authenticated;
