-- record_sale ran as SECURITY INVOKER, so its internal
-- `insert into sales (...) returning id into v_sale_id` required the
-- calling user to also satisfy the sales SELECT policy (admin-only,
-- 20260703145951_restrict_sales_to_admin.sql) — RETURNING enforces the
-- SELECT policy on the row just inserted, not just the INSERT policy.
-- This silently broke every non-admin checkout (including the public
-- Counter account) with "new row violates row-level security policy for
-- table sales", while admin checkouts worked fine since admins already
-- satisfy that SELECT policy. Found via a live checkout failure.
--
-- Fix: SECURITY DEFINER bypasses RLS for record_sale's own internal
-- writes, same pattern as get_daily_sales_totals/get_item_popularity —
-- it still only ever returns the new sale's id to the caller, no broader
-- access to sales rows.
create or replace function record_sale(
  p_table_name text,
  p_items jsonb,
  p_subtotal numeric,
  p_discount_percent numeric,
  p_discount_amount numeric,
  p_total numeric,
  p_payment text,
  p_note text,
  p_customers int,
  p_staff_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_menu_item menu_items%rowtype;
  v_recipe_entry jsonb;
  v_flavor_entry jsonb;
  v_qty numeric;
begin
  insert into sales (
    table_name, items, subtotal, discount_percent, discount_amount,
    total, payment, note, customers, staff_id
  )
  values (
    p_table_name, p_items, p_subtotal, p_discount_percent, p_discount_amount,
    p_total, p_payment, p_note, p_customers, p_staff_id
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::numeric;

    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    if found then
      if v_menu_item.container_id is not null then
        update ingredients
        set stock = stock - v_qty, updated_at = now()
        where id = v_menu_item.container_id;
      end if;

      for v_recipe_entry in select * from jsonb_array_elements(coalesce(v_menu_item.recipe, '[]'::jsonb))
      loop
        update ingredients
        set stock = stock - (v_qty * (v_recipe_entry->>'qty')::numeric), updated_at = now()
        where id = (v_recipe_entry->>'ingredient_id')::uuid;
      end loop;
    end if;

    for v_flavor_entry in select * from jsonb_array_elements(coalesce(v_item->'flavors', '[]'::jsonb))
    loop
      update ingredients
      set stock = stock - (v_qty * (v_flavor_entry->>'grams')::numeric), updated_at = now()
      where id = (v_flavor_entry->>'ingredient_id')::uuid;
    end loop;
  end loop;

  return v_sale_id;
end;
$$;

grant execute on function record_sale(
  text, jsonb, numeric, numeric, numeric, numeric, text, text, int, uuid
) to authenticated;
