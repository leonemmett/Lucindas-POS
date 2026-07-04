-- The menu_items seed (20260704154038_seed_menu_items.sql) ran twice while
-- troubleshooting a copy/paste issue, producing exact duplicate rows
-- (220 = 110 x 2, confirmed via with_recipe/with_container counts both being
-- exactly double the expected values). Keep one row per distinct
-- (name, category, price, ball_count, weight_grams, container_id, recipe)
-- tuple, deleting the rest.
delete from menu_items a
using menu_items b
where a.id > b.id
  and a.name = b.name
  and a.category = b.category
  and a.price = b.price
  and a.ball_count = b.ball_count
  and a.weight_grams = b.weight_grams
  and a.container_id is not distinct from b.container_id
  and a.recipe = b.recipe;
