-- Restrict browsing/reading sales (and by extension, sales reporting and
-- margin-adjacent data) to admins only. Checkout still works for everyone —
-- record_sale() only needs INSERT — and cashup still works for everyone via
-- a narrow RPC that returns aggregate totals only, not raw sale rows.
drop policy "authenticated_full_access" on sales;

create policy "staff_insert_sales" on sales
  for insert to authenticated
  with check (true);

create policy "admin_select_sales" on sales
  for select to authenticated
  using (
    exists (
      select 1 from staff
      where staff.email = auth.jwt() ->> 'email' and staff.is_admin
    )
  );

create policy "admin_update_sales" on sales
  for update to authenticated
  using (
    exists (
      select 1 from staff
      where staff.email = auth.jwt() ->> 'email' and staff.is_admin
    )
  );

-- No delete policy — sales are never deleted, only voided (audit trail).

-- Cashup needs the day's totals by payment method for every staff member,
-- not just admins, but must not expose raw sale rows/items/notes. Runs as
-- SECURITY DEFINER to bypass the now admin-only SELECT policy above, and
-- deliberately returns only the aggregate. Excludes voided sales, which the
-- original direct-query version (useSalesTotalsForDate) did not.
create or replace function get_daily_sales_totals(p_date date)
returns table(payment text, total numeric)
language sql
security definer
set search_path = public
as $$
  select payment, sum(total) as total
  from sales
  where ts >= p_date::timestamptz
    and ts < (p_date + 1)::timestamptz
    and voided_at is null
  group by payment;
$$;

grant execute on function get_daily_sales_totals(date) to authenticated;
