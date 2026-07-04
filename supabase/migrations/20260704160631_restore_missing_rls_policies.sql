-- Every table except `sales` was found to have zero RLS policies (RLS
-- enabled, but nothing granting access), silently blocking every real user
-- while the SQL Editor kept working fine (it runs as the superuser, bypassing
-- RLS entirely) — which is why this went unnoticed until live end-to-end
-- testing. `sales` is untouched here; its narrower admin-gated policies from
-- 20260703145951_restrict_sales_to_admin.sql are already correct.
--
-- Recreates the original fully-open-to-authenticated policy on the other
-- seven tables, matching what 20260703034600_rls.sql originally set up.
create policy "authenticated_full_access" on staff for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on tables for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on ingredients for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on menu_items for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on open_tickets for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on cashups for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on settings for all to authenticated using (true) with check (true);
