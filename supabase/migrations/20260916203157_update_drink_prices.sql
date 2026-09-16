-- Price update: Coca-Cola, Coca-Cola Light, Sprite, Sprite Zero, Bui Water.
-- All other items in the requested list were already at the target price.

update menu_items set price = 50 where name = 'Coca-Cola';
update menu_items set price = 50 where name = 'Coca-Cola Light';
update menu_items set price = 50 where name = 'Sprite';
update menu_items set price = 50 where name = 'Sprite Zero';
update menu_items set price = 60 where name = 'Bui Water';
