-- Records a sale and deducts ingredient stock (recipe + container) in one
-- transaction, so concurrent sales or a dropped connection mid-write can't
-- corrupt stock counts. Stock is allowed to go negative (a signal to
-- restock/reconcile) rather than blocking the sale.
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
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    if not found then
      continue;
    end if;

    v_qty := (v_item->>'qty')::numeric;

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
  end loop;

  return v_sale_id;
end;
$$;

grant execute on function record_sale(
  text, jsonb, numeric, numeric, numeric, numeric, text, text, int, uuid
) to authenticated;
