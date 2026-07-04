-- Gelato flavor tracking: scoop/weight-based menu items (ball_count > 0 or
-- weight_grams > 0) don't have a fixed flavor in their recipe — the flavor is
-- chosen per sale. Sale line items can now carry a `flavors` array
-- ([{ "ingredient_id": "...", "grams": 85 }]) alongside the existing
-- menu_items.recipe-based deduction. grams_per_ball drives scoop-count math
-- client-side; weight-based items (400g/750g/1kg tubs) split the item's
-- weight_grams evenly across however many flavors were chosen.
insert into settings (key, value)
values ('grams_per_ball', '85'::jsonb)
on conflict (key) do update set value = excluded.value;

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

create or replace function void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
as $$
declare
  v_admin_id uuid;
  v_is_admin boolean;
  v_sale sales%rowtype;
  v_item jsonb;
  v_menu_item menu_items%rowtype;
  v_recipe_entry jsonb;
  v_flavor_entry jsonb;
  v_qty numeric;
begin
  select id, is_admin into v_admin_id, v_is_admin
  from staff
  where email = auth.jwt() ->> 'email';

  if v_admin_id is null or not v_is_admin then
    raise exception 'Only an admin can void a sale';
  end if;

  select * into v_sale from sales where id = p_sale_id;
  if not found then
    raise exception 'Sale not found';
  end if;
  if v_sale.voided_at is not null then
    raise exception 'Sale already voided';
  end if;

  update sales
  set voided_at = now(), void_reason = p_reason, voided_by = v_admin_id
  where id = p_sale_id;

  for v_item in select * from jsonb_array_elements(v_sale.items)
  loop
    v_qty := (v_item->>'qty')::numeric;

    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    if found then
      if v_menu_item.container_id is not null then
        update ingredients
        set stock = stock + v_qty, updated_at = now()
        where id = v_menu_item.container_id;
      end if;

      for v_recipe_entry in select * from jsonb_array_elements(coalesce(v_menu_item.recipe, '[]'::jsonb))
      loop
        update ingredients
        set stock = stock + (v_qty * (v_recipe_entry->>'qty')::numeric), updated_at = now()
        where id = (v_recipe_entry->>'ingredient_id')::uuid;
      end loop;
    end if;

    for v_flavor_entry in select * from jsonb_array_elements(coalesce(v_item->'flavors', '[]'::jsonb))
    loop
      update ingredients
      set stock = stock + (v_qty * (v_flavor_entry->>'grams')::numeric), updated_at = now()
      where id = (v_flavor_entry->>'ingredient_id')::uuid;
    end loop;
  end loop;
end;
$$;

grant execute on function void_sale(uuid, text) to authenticated;
