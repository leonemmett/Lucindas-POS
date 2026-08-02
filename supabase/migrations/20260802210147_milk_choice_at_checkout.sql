-- Milk-based drinks had "Whole Milk" hard-baked into their recipe, so stock
-- deduction never reflected which milk the customer actually got. This pulls
-- that fixed entry out into menu_items.milk_ml — when set, checkout must ask
-- which milk to use (like the existing gelato flavor picker), and the chosen
-- ingredient is deducted through the same generic sale-item `flavors` array
-- record_sale/void_sale already support. No RPC changes needed.
alter table menu_items add column milk_ml numeric not null default 0;
alter table ingredients add column is_milk boolean not null default false;

update ingredients set is_milk = true
where name in ('Whole Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'Lactose-Free Milk', 'Coconut Milk');

update menu_items mi
set milk_ml = (
      select (elem->>'qty')::numeric
      from jsonb_array_elements(mi.recipe) as elem
      where (elem->>'ingredient_id')::uuid = (select id from ingredients where name = 'Whole Milk')
    ),
    recipe = (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(mi.recipe) as elem
      where (elem->>'ingredient_id')::uuid != (select id from ingredients where name = 'Whole Milk')
    )
where exists (
  select 1 from jsonb_array_elements(mi.recipe) as elem
  where (elem->>'ingredient_id')::uuid = (select id from ingredients where name = 'Whole Milk')
);
