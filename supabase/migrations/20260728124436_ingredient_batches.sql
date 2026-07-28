-- Gelato containers: a single flavour ingredient can have several physical
-- containers in stock at once, each with its own remaining weight and its
-- own expiry date (e.g. Vanilla might be 3 tubs bought on different days).
-- This table is a per-container ledger; ingredients.stock becomes a derived
-- aggregate for any ingredient that ever gets a batch row (see the trigger
-- below), kept in sync automatically so every existing read site
-- (IngredientManager, LowStockDashboard, isLowStock, CSV export) keeps
-- working unmodified. Ingredients with zero batch rows are untouched and
-- keep today's manually-edited stock field.
create table ingredient_batches (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  weight_grams numeric not null,  -- deliberately no check(>=0): FEFO overflow
                                   -- (see the next migration) must be able to
                                   -- push the newest batch negative, matching
                                   -- record_sale's existing "stock allowed to
                                   -- go negative" convention.
  expiry_date date not null,
  received_at timestamptz not null default now(),
  emptied_at timestamptz,          -- soft "this container is done" marker;
                                    -- excluded from the stock sum below.
  note text,
  created_at timestamptz default now()
);

-- Ledger of exactly which batch(es) a sale drew from and how much, so
-- void_sale can restore precisely instead of guessing. batch_id has no
-- cascade delete: once any sale has drawn from a batch, that batch can never
-- be hard-deleted (delete attempts fail with 23503, same friendly-message
-- pattern IngredientEditor already uses for the container_id FK).
create table sale_batch_deductions (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id),
  batch_id uuid not null references ingredient_batches(id),
  ingredient_id uuid not null references ingredients(id),
  amount numeric not null, -- always the positive amount drawn from this
                            -- batch, even when it pushed weight_grams negative
  created_at timestamptz default now()
);

create index ingredient_batches_ingredient_id_idx on ingredient_batches (ingredient_id);
create index ingredient_batches_expiry_date_idx on ingredient_batches (expiry_date);
create index sale_batch_deductions_sale_id_idx on sale_batch_deductions (sale_id);

create or replace function sync_ingredient_stock_from_batches()
returns trigger
language plpgsql
as $$
declare
  v_ingredient_id uuid := coalesce(new.ingredient_id, old.ingredient_id);
begin
  update ingredients
  set stock = coalesce(
        (select sum(weight_grams) from ingredient_batches
         where ingredient_id = v_ingredient_id and emptied_at is null), 0),
      updated_at = now()
  where id = v_ingredient_id;
  return null;
end;
$$;

create trigger trg_sync_ingredient_stock
after insert or update or delete on ingredient_batches
for each row execute function sync_ingredient_stock_from_batches();

alter table ingredient_batches enable row level security;
alter table sale_batch_deductions enable row level security;

-- Same wide-open policy as ingredients itself — operational stock detail,
-- gated at the UI layer (admin-only screens), not a security boundary.
create policy "authenticated_full_access" on ingredient_batches
  for all to authenticated using (true) with check (true);

-- Admin-only select, mirroring the sales table. Deliberately NO
-- insert/update/delete policy — rows are only ever written by
-- deduct_ingredient_stock (next migration), itself only reachable through
-- record_sale's security definer context, which bypasses RLS entirely.
-- This is not the silent-lockout bug fixed in 20260704160631 (RLS enabled
-- with zero policies blocking legitimate access) — there is no legitimate
-- direct write path to this table to protect.
create policy "admin_select_batch_deductions" on sale_batch_deductions
  for select to authenticated
  using (exists (
    select 1 from staff
    where staff.email = auth.jwt() ->> 'email' and staff.is_admin
  ));

insert into settings (key, value) values ('expiry_alert_window_days', '5'::jsonb)
on conflict (key) do update set value = excluded.value;
