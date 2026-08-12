-- A dated physical inventory count, so recurring stocktakes (every 1-2
-- weeks) build up a permanent history of system-vs-counted variance per
-- flavour, rather than each correction just overwriting the last one with
-- no record of how far off things were. Applying a stocktake overwrites the
-- ingredient's actual containers (ingredient_batches) to match what was
-- physically counted; these two tables are the audit trail of that action,
-- not the live inventory itself.
create table stocktakes (
  id uuid primary key default gen_random_uuid(),
  taken_at date not null,
  note text,
  created_at timestamptz default now()
);

create table stocktake_lines (
  id uuid primary key default gen_random_uuid(),
  stocktake_id uuid not null references stocktakes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id),
  ingredient_name text not null, -- snapshot, survives a later ingredient rename
  system_stock_before numeric not null,
  counted_stock numeric not null,
  difference numeric not null, -- counted_stock - system_stock_before
  created_at timestamptz default now()
);

create index stocktake_lines_stocktake_id_idx on stocktake_lines (stocktake_id);
create index stocktake_lines_ingredient_id_idx on stocktake_lines (ingredient_id);

alter table stocktakes enable row level security;
alter table stocktake_lines enable row level security;

-- Same wide-open policy as ingredients/fixed_costs — operational data gated
-- at the UI layer (admin-only screens), not a security boundary.
create policy "authenticated_full_access" on stocktakes
  for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on stocktake_lines
  for all to authenticated using (true) with check (true);
