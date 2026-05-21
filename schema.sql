-- Nicco Finance DB (Supabase/Postgres)

create extension if not exists pgcrypto;

-- Lookup tables (gerenciáveis pelo app)
create table if not exists categories (
  id bigserial primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists subcategories (
  id bigserial primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists transactions (
  id bigserial primary key,
  date date not null,
  name text not null,
  type text not null,
  reserve text not null default '',
  account text not null,
  category_id bigint,
  subcategory_id bigint,
  payment_method text not null default '',
  amount numeric(14,2) not null,
  status text not null default '',
  installment text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Para bases já existentes: garante colunas novas.
alter table transactions add column if not exists category_id bigint;
alter table transactions add column if not exists subcategory_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_transactions_category'
  ) then
    alter table transactions
      add constraint fk_transactions_category
      foreign key (category_id) references categories(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_transactions_subcategory'
  ) then
    alter table transactions
      add constraint fk_transactions_subcategory
      foreign key (subcategory_id) references subcategories(id);
  end if;
end $$;

create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_account_date on transactions(account, date desc);
create index if not exists idx_transactions_type on transactions(type);
create index if not exists idx_transactions_category_id on transactions(category_id);
create index if not exists idx_transactions_subcategory_id on transactions(subcategory_id);

create table if not exists monthly_goals (
  month text primary key, -- yyyy-mm
  value numeric(14,2) not null default 0
);

-- Inbox de importação (Open Finance / Pluggy / etc.)
create table if not exists import_inbox (
  id bigserial primary key,
  provider text not null default 'pluggy',
  external_id text not null,
  occurred_at timestamptz,
  description text not null default '',
  account_hint text not null default '',
  amount numeric(14,2) not null default 0,
  currency text not null default 'BRL',
  raw jsonb not null default '{}'::jsonb,
  status text not null default 'pending', -- pending|approved|rejected
  approved_transaction_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

alter table import_inbox
  add constraint if not exists fk_import_inbox_transaction
  foreign key (approved_transaction_id) references transactions(id);

create index if not exists idx_import_inbox_status on import_inbox(status);
