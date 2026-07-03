create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  created_at timestamptz default now()
);
-- Passwords are handled by Supabase Auth, not stored here.

create table tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int default 0
);

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  stock numeric not null default 0,
  low_threshold numeric not null default 0,
  cost_per_unit numeric not null default 0,
  is_flavour boolean default false,
  is_container boolean default false,
  updated_at timestamptz default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text default 'Other',
  price numeric not null,
  ball_count int default 0,
  weight_grams int default 0,
  container_id uuid references ingredients(id),
  recipe jsonb default '[]',  -- [{ "ingredient_id": "...", "qty": 12 }]
  updated_at timestamptz default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz default now(),
  table_name text,
  items jsonb not null,       -- line items incl. flavours/container, as sold
  subtotal numeric not null,
  discount_percent numeric default 0,
  discount_amount numeric default 0,
  total numeric not null,
  payment text not null,      -- 'cash' | 'card1' | 'card2' | 'transfer'
  note text,
  customers int default 1,
  staff_id uuid references staff(id)
);

create table open_tickets (
  table_id uuid primary key references tables(id),
  items jsonb default '[]',
  payment text,
  note text,
  customers int default 1,
  discount_percent numeric default 0,
  updated_at timestamptz default now()
);

create table cashups (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  staff_name text,
  counts jsonb,                -- denomination counts
  card_tips numeric default 0,
  petty_cash numeric default 0,
  subtotal numeric,
  float_fixed_total numeric,
  total_cash_in_till numeric,
  system_cash numeric,
  cash_difference numeric,
  reader_counts jsonb,
  system_card1 numeric,
  system_card2 numeric,
  system_transfer numeric,
  grand_counted numeric,
  grand_system numeric,
  grand_difference numeric,
  created_at timestamptz default now(),
  unique (date)
);

create table settings (
  key text primary key,
  value jsonb not null
);
-- rows: 'card1_label', 'card2_label', 'grams_per_ball', 'float_composition'
