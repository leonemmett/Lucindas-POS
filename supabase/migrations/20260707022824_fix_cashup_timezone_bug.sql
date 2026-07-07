-- get_daily_sales_totals(p_date date) computed its day boundary as
-- p_date::timestamptz .. (p_date+1)::timestamptz, which is interpreted in the
-- *database session's* timezone (UTC on Supabase), not the shop's local
-- timezone. For a shop several hours behind UTC, that silently shifted which
-- sales counted toward which day's cashup by that many hours (e.g. evening
-- sales bleeding into the next day's cashup). Reports (useSalesInRange /
-- localDateRangeToISO) already avoids this by computing the local-day
-- boundary in the browser and passing explicit UTC instants — do the same
-- here instead of a bare date.
drop function if exists get_daily_sales_totals(date);

create or replace function get_daily_sales_totals(p_start timestamptz, p_end timestamptz)
returns table(payment text, total numeric)
language sql
security definer
set search_path = public
as $$
  select payment, sum(total) as total
  from sales
  where ts >= p_start
    and ts < p_end
    and voided_at is null
  group by payment;
$$;

grant execute on function get_daily_sales_totals(timestamptz, timestamptz) to authenticated;
