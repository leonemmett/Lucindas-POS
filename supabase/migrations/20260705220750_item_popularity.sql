-- Aggregate-only view of how much each menu item has sold, so the POS
-- Favourites tab can sort by popularity without giving every staff member
-- (or the public counter session) read access to raw sales rows, which stay
-- admin-only per 20260703145951_restrict_sales_to_admin.sql.
create or replace function get_item_popularity()
returns table(menu_item_id uuid, total_qty numeric)
language sql
security definer
set search_path = public
as $$
  select (item->>'menu_item_id')::uuid as menu_item_id, sum((item->>'qty')::numeric) as total_qty
  from sales, jsonb_array_elements(items) as item
  where voided_at is null
  group by menu_item_id;
$$;

grant execute on function get_item_popularity() to authenticated;
