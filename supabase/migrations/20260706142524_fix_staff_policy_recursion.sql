-- 20260706142205 caused "infinite recursion detected in policy for
-- relation staff" — its policies checked admin status via a subquery on
-- staff from within staff's own RLS policy, which re-triggers the same
-- policy recursively and broke all staff access for everyone (the app got
-- stuck on the loading spinner, since useCurrentStaff could no longer
-- resolve). Fixed by moving the admin check into a SECURITY DEFINER
-- function, which bypasses RLS for its own internal lookup — the same
-- pattern already used by get_daily_sales_totals/get_item_popularity.
create or replace function is_current_user_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff where staff.email = auth.jwt() ->> 'email' and staff.is_admin
  );
$$;

grant execute on function is_current_user_admin() to authenticated;

drop policy "read_own_or_admin_reads_all" on staff;
drop policy "admin_insert_staff" on staff;
drop policy "admin_update_staff" on staff;
drop policy "admin_delete_staff" on staff;

create policy "read_own_or_admin_reads_all" on staff
  for select to authenticated
  using (email = auth.jwt() ->> 'email' or is_current_user_admin());

create policy "admin_insert_staff" on staff
  for insert to authenticated
  with check (is_current_user_admin());

create policy "admin_update_staff" on staff
  for update to authenticated
  using (is_current_user_admin())
  with check (is_current_user_admin());

create policy "admin_delete_staff" on staff
  for delete to authenticated
  using (is_current_user_admin());
