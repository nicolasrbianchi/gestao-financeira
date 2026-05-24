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

-- Contas/Canais (para selects e gestão). Em modo DB, preferimos esta tabela ao invés de deduzir de transações.
create table if not exists accounts (
  id bigserial primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_accounts_name_lower on accounts (lower(name));
create index if not exists idx_accounts_active on accounts (is_active);

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
  add column if not exists approved_transaction_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_import_inbox_transaction'
  ) then
    alter table import_inbox
      add constraint fk_import_inbox_transaction
      foreign key (approved_transaction_id) references transactions(id);
  end if;
end $$;

create index if not exists idx_import_inbox_status on import_inbox(status);

-- Pluggy connections (single-user, mas suporta múltiplos itens)
create table if not exists pluggy_items (
  id bigserial primary key,
  item_id uuid not null,
  client_user_id text not null default '',
  enabled boolean not null default true,
  -- Evita inundar a inbox no primeiro sync: por padrão, só importa transações com date >= ignore_before.
  ignore_before timestamptz not null default now(),
  last_webhook_at timestamptz,
  last_sync_at timestamptz,
  -- Última vez que pedimos um Update do Item via API (PATCH /items/{id}).
  last_update_at timestamptz,
  -- Alguns itens (ex: MeuPluggy) não suportam update via API. Quando false, pulamos PATCH /items.
  can_update boolean not null default true,
  -- Cursor para o fetch manual do app (evita re-buscar o que já foi ingerido).
  last_fetch_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id)
);

alter table pluggy_items
  add column if not exists last_fetch_at timestamptz;

alter table pluggy_items
  add column if not exists last_update_at timestamptz;

alter table pluggy_items
  add column if not exists can_update boolean not null default true;

create index if not exists idx_pluggy_items_enabled on pluggy_items(enabled);

-- Web Push subscriptions (PWA)
create table if not exists push_subscriptions (
  id bigserial primary key,
  endpoint text not null,
  subscription jsonb not null default '{}'::jsonb,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists idx_push_subscriptions_updated_at on push_subscriptions(updated_at desc);
