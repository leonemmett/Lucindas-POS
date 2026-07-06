-- The blanket "authenticated_full_access" policy on staff let ANY
-- authenticated session — including the public "Counter" walk-up account
-- introduced for the login-free POS — write is_admin=true on its own row
-- (or any row), immediately unlocking every admin-gated RLS policy
-- (sales viewing/voiding, etc.). Found via security review.
--
-- Staff can still read their own row (needed by useCurrentStaff to check
-- is_admin/active) or, if already admin, everyone's; only admins can
-- create, edit, or delete staff rows.
drop policy "authenticated_full_access" on staff;

create policy "read_own_or_admin_reads_all" on staff
  for select to authenticated
  using (
    email = auth.jwt() ->> 'email'
    or exists (select 1 from staff s2 where s2.email = auth.jwt() ->> 'email' and s2.is_admin)
  );

create policy "admin_insert_staff" on staff
  for insert to authenticated
  with check (exists (select 1 from staff where staff.email = auth.jwt() ->> 'email' and staff.is_admin));

create policy "admin_update_staff" on staff
  for update to authenticated
  using (exists (select 1 from staff where staff.email = auth.jwt() ->> 'email' and staff.is_admin))
  with check (exists (select 1 from staff where staff.email = auth.jwt() ->> 'email' and staff.is_admin));

create policy "admin_delete_staff" on staff
  for delete to authenticated
  using (exists (select 1 from staff where staff.email = auth.jwt() ->> 'email' and staff.is_admin));
