insert into tables (name, sort_order)
values ('Table 8', 8)
on conflict (name) do nothing;
