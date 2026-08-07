-- Monthly operating costs (rent, utilities, admin, payroll, ...) that don't
-- tie to any menu item or ingredient, so they can't flow through the
-- existing cost/margin machinery. Append-only per category: updating an
-- amount inserts a new row rather than mutating the old one, so a report
-- for a past date range still uses whatever amount was actually in effect
-- then, even after the current amount is later revised.
create table fixed_costs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric not null,
  effective_from date not null default current_date,
  created_at timestamptz default now()
);

create index fixed_costs_category_effective_idx on fixed_costs (category, effective_from desc);

alter table fixed_costs enable row level security;

-- Same wide-open policy as ingredients/settings — operational data gated at
-- the UI layer (Reports is already admin-only), not a security boundary.
create policy "authenticated_full_access" on fixed_costs
  for all to authenticated using (true) with check (true);
