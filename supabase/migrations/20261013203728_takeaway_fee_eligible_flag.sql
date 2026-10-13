-- The take-away fee (see CheckoutModal's TAKEAWAY_FEE) applies automatically
-- to the Sandwiches/Salads categories, but some items outside those
-- categories (e.g. filled croissants, still filed under Bakery) also need
-- it. Same pattern as is_favourite: an automatic category rule plus a
-- manual per-item flag, rather than forcing those items into a category
-- that wouldn't otherwise fit them.
alter table menu_items add column takeaway_fee_eligible boolean not null default false;

update menu_items set takeaway_fee_eligible = true
where name in (
  'Cheese, Tomato & Rocket Croissant',
  'Nutella Croissant',
  'Coppa, Cheese & Rocket Croissant',
  'Egg Croissant'
);
