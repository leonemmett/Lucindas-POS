-- Rewrites record_sale/void_sale to deduct/restore gelato stock from
-- individual containers (ingredient_batches) in first-expiring-first-out
-- order, instead of always hitting a single aggregate ingredients.stock
-- number. Ingredients with no batch rows are completely unaffected — they
-- keep the old direct stock update, unchanged.
--
-- deduct_ingredient_stock/restore_ingredient_stock are helpers, not part of
-- the public API: no grant to authenticated (default PUBLIC execute is
-- explicitly revoked below), only ever called from record_sale/void_sale's
-- security definer context.
create or replace function deduct_ingredient_stock(
  p_sale_id uuid,
  p_ingredient_id uuid,
  p_amount numeric
) returns void
language plpgsql
as $$
declare
  v_has_batches boolean;
  v_remaining numeric := p_amount;
  v_batch record;
  v_take numeric;
  v_fallback_batch_id uuid;
begin
  select exists(
    select 1 from ingredient_batches where ingredient_id = p_ingredient_id
  ) into v_has_batches;

  if not v_has_batches then
    update ingredients
    set stock = stock - p_amount, updated_at = now()
    where id = p_ingredient_id;
    return;
  end if;

  for v_batch in
    select id, weight_grams from ingredient_batches
    where ingredient_id = p_ingredient_id and emptied_at is null
    order by expiry_date asc, received_at asc, id asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := greatest(least(v_remaining, v_batch.weight_grams), 0);
    if v_take > 0 then
      update ingredient_batches set weight_grams = weight_grams - v_take where id = v_batch.id;
      insert into sale_batch_deductions (sale_id, batch_id, ingredient_id, amount)
      values (p_sale_id, v_batch.id, p_ingredient_id, v_take);
      v_remaining := v_remaining - v_take;
    end if;
  end loop;

  if v_remaining > 0 then
    -- Active batches exhausted; the overflow lands on the most recently
    -- received batch (reactivating it if it had been marked emptied) and is
    -- allowed to push it negative there, preserving the existing "negative
    -- stock = restock signal" convention while keeping ingredients.stock
    -- exclusively trigger-derived (never written directly once any batch
    -- row exists for this ingredient).
    select id into v_fallback_batch_id
    from ingredient_batches
    where ingredient_id = p_ingredient_id
    order by received_at desc, id desc
    limit 1
    for update;

    update ingredient_batches
    set weight_grams = weight_grams - v_remaining, emptied_at = null
    where id = v_fallback_batch_id;

    insert into sale_batch_deductions (sale_id, batch_id, ingredient_id, amount)
    values (p_sale_id, v_fallback_batch_id, p_ingredient_id, v_remaining);
  end if;
end;
$$;

create or replace function restore_ingredient_stock(
  p_sale_id uuid,
  p_ingredient_id uuid,
  p_amount numeric
) returns void
language plpgsql
as $$
declare
  v_has_ledger boolean;
  v_row record;
begin
  select exists(
    select 1 from sale_batch_deductions
    where sale_id = p_sale_id and ingredient_id = p_ingredient_id
  ) into v_has_ledger;

  if not v_has_ledger then
    update ingredients
    set stock = stock + p_amount, updated_at = now()
    where id = p_ingredient_id;
    return;
  end if;

  for v_row in
    select batch_id, amount from sale_batch_deductions
    where sale_id = p_sale_id and ingredient_id = p_ingredient_id
  loop
    update ingredient_batches
    set weight_grams = weight_grams + v_row.amount
    where id = v_row.batch_id;
  end loop;
end;
$$;

revoke execute on function deduct_ingredient_stock(uuid, uuid, numeric) from public;
revoke execute on function restore_ingredient_stock(uuid, uuid, numeric) from public;

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
  v_deduction record;
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

  -- Aggregate every ingredient deduction across all line items (container +
  -- recipe + flavors) into one total per ingredient, then apply them in a
  -- fixed ingredient_id order. Processing in a global fixed order (rather
  -- than whatever order line items happen to arrive in) prevents a deadlock
  -- where two concurrent sales touch the same two ingredients in opposite
  -- order and each blocks on the other's row lock.
  for v_deduction in
    with items as (
      select
        (elem->>'menu_item_id')::uuid as menu_item_id,
        (elem->>'qty')::numeric as qty,
        coalesce(elem->'flavors', '[]'::jsonb) as flavors
      from jsonb_array_elements(p_items) as elem
    ),
    container_deductions as (
      select mi.container_id as ingredient_id, sum(i.qty) as amount
      from items i
      join menu_items mi on mi.id = i.menu_item_id
      where mi.container_id is not null
      group by mi.container_id
    ),
    recipe_deductions as (
      select (re->>'ingredient_id')::uuid as ingredient_id,
             sum(i.qty * (re->>'qty')::numeric) as amount
      from items i
      join menu_items mi on mi.id = i.menu_item_id
      cross join lateral jsonb_array_elements(coalesce(mi.recipe, '[]'::jsonb)) as re
      group by (re->>'ingredient_id')::uuid
    ),
    flavor_deductions as (
      select (fe->>'ingredient_id')::uuid as ingredient_id,
             sum(i.qty * (fe->>'grams')::numeric) as amount
      from items i
      cross join lateral jsonb_array_elements(i.flavors) as fe
      group by (fe->>'ingredient_id')::uuid
    )
    select ingredient_id, sum(amount) as amount
    from (
      select * from container_deductions
      union all
      select * from recipe_deductions
      union all
      select * from flavor_deductions
    ) all_deductions
    group by ingredient_id
    order by ingredient_id
  loop
    perform deduct_ingredient_stock(v_sale_id, v_deduction.ingredient_id, v_deduction.amount);
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
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_is_admin boolean;
  v_sale sales%rowtype;
  v_deduction record;
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

  for v_deduction in
    with items as (
      select
        (elem->>'menu_item_id')::uuid as menu_item_id,
        (elem->>'qty')::numeric as qty,
        coalesce(elem->'flavors', '[]'::jsonb) as flavors
      from jsonb_array_elements(v_sale.items) as elem
    ),
    container_deductions as (
      select mi.container_id as ingredient_id, sum(i.qty) as amount
      from items i
      join menu_items mi on mi.id = i.menu_item_id
      where mi.container_id is not null
      group by mi.container_id
    ),
    recipe_deductions as (
      select (re->>'ingredient_id')::uuid as ingredient_id,
             sum(i.qty * (re->>'qty')::numeric) as amount
      from items i
      join menu_items mi on mi.id = i.menu_item_id
      cross join lateral jsonb_array_elements(coalesce(mi.recipe, '[]'::jsonb)) as re
      group by (re->>'ingredient_id')::uuid
    ),
    flavor_deductions as (
      select (fe->>'ingredient_id')::uuid as ingredient_id,
             sum(i.qty * (fe->>'grams')::numeric) as amount
      from items i
      cross join lateral jsonb_array_elements(i.flavors) as fe
      group by (fe->>'ingredient_id')::uuid
    )
    select ingredient_id, sum(amount) as amount
    from (
      select * from container_deductions
      union all
      select * from recipe_deductions
      union all
      select * from flavor_deductions
    ) all_deductions
    group by ingredient_id
    order by ingredient_id
  loop
    perform restore_ingredient_stock(p_sale_id, v_deduction.ingredient_id, v_deduction.amount);
  end loop;
end;
$$;

grant execute on function void_sale(uuid, text) to authenticated;
