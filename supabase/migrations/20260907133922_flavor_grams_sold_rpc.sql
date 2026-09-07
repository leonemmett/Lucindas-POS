-- Safe aggregate for reconciling a physical gelato stocktake against sales
-- that happened after the count was taken (e.g. a morning count, then
-- afternoon sales still deducting stock in real time). Same pattern as
-- get_daily_sales_totals()/get_item_popularity(): a SECURITY DEFINER
-- function exposing a narrow aggregate without opening up admin-only sales.
create or replace function get_flavor_grams_sold(p_start timestamptz, p_end timestamptz)
returns table(ingredient_id uuid, grams numeric)
language sql
security definer
set search_path = public
as $$
  select
    (flavor->>'ingredient_id')::uuid as ingredient_id,
    sum((flavor->>'grams')::numeric * (item->>'qty')::numeric) as grams
  from sales s,
       jsonb_array_elements(s.items) as item,
       jsonb_array_elements(item->'flavors') as flavor
  where s.ts >= p_start
    and s.ts < p_end
    and s.voided_at is null
  group by ingredient_id;
$$;

grant execute on function get_flavor_grams_sold(timestamptz, timestamptz) to authenticated;
