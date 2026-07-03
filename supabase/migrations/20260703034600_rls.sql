-- Lock down all tables to authenticated (logged-in) staff only.
-- No anonymous read/write; refine into per-role policies once staff roles exist.

alter table staff enable row level security;
alter table tables enable row level security;
alter table ingredients enable row level security;
alter table menu_items enable row level security;
alter table sales enable row level security;
alter table open_tickets enable row level security;
alter table cashups enable row level security;
alter table settings enable row level security;

create policy "authenticated_full_access" on staff for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on tables for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on ingredients for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on menu_items for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on sales for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on open_tickets for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on cashups for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on settings for all to authenticated using (true) with check (true);
