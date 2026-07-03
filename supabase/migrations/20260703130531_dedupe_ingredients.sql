-- The ingredients seed (20260703123822_seed_ingredients.sql) was run 3x while
-- troubleshooting an unrelated SQL Editor error, producing exact triplicate
-- rows (573 rows = 191 x 3, confirmed via is_flavour/is_container counts).
-- Keep one row per distinct (name, unit, stock, low_threshold, cost_per_unit,
-- is_flavour, is_container) tuple, deleting the rest.
delete from ingredients a
using ingredients b
where a.id > b.id
  and a.name = b.name
  and a.unit = b.unit
  and a.stock = b.stock
  and a.low_threshold = b.low_threshold
  and a.cost_per_unit = b.cost_per_unit
  and a.is_flavour = b.is_flavour
  and a.is_container = b.is_container;
