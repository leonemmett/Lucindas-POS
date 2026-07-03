-- Admin flag on staff, used to gate voiding a sale.
alter table staff add column is_admin boolean not null default false;

-- Void metadata on sales. Voided sales are excluded from revenue reporting
-- but kept (not deleted) for audit trail.
alter table sales add column voided_at timestamptz;
alter table sales add column void_reason text;
alter table sales add column voided_by uuid references staff(id);

-- Voids a sale and restores the stock that record_sale() deducted. Enforces
-- admin-only server-side (in addition to the client-side "manager override"
-- flow) by resolving the calling user's staff row from their JWT email and
-- checking is_admin — so this can't be bypassed even if the client changed.
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
    select * into v_menu_item from menu_items where id = (v_item->>'menu_item_id')::uuid;
    if not found then
      continue;
    end if;

    v_qty := (v_item->>'qty')::numeric;

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
  end loop;
end;
$$;

grant execute on function void_sale(uuid, text) to authenticated;
