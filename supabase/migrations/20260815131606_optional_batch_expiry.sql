-- Not every tracked container has a meaningful expiry date. Daily-delivery
-- items (brownies, cookies, medialunas) are counted in pieces and gone the
-- same day, so forcing a date meant inventing a fake one — which then shows
-- up as a real expiry alert later. Allow expiry_date to be null instead:
-- null means "no expiry tracked", never alerts, and sorts last under FEFO so
-- genuinely dated stock is always consumed first.
alter table ingredient_batches alter column expiry_date drop not null;

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
    order by expiry_date asc nulls last, received_at asc, id asc
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

revoke execute on function deduct_ingredient_stock(uuid, uuid, numeric) from public;
