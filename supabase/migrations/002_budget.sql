-- Budget app: settings (categories, budgets, merchant rules) and transactions.
-- Paste into Supabase → SQL Editor → Run, after 001_plans.sql.
-- Access follows the plan: anyone who can see the plan (owner or shared_with) can see and edit its budget.

create table if not exists public.budget_settings (
  plan_id    uuid primary key references public.plans (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  date        date not null,
  description text not null,
  amount      numeric(12, 2) not null,          -- negative = money out
  account     text not null default '',
  category_id text,
  source      text,                             -- you | rule | auto | ai
  hash        text not null,                    -- de-duplication key
  created_at  timestamptz not null default now(),
  unique (plan_id, hash)
);

create index if not exists transactions_plan_date_idx on public.transactions (plan_id, date desc);

alter table public.budget_settings enable row level security;
alter table public.transactions enable row level security;

-- The plans table's own RLS limits this subquery to plans the user can see.
drop policy if exists "budget_settings_all" on public.budget_settings;
create policy "budget_settings_all" on public.budget_settings for all to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id))
  with check (exists (select 1 from public.plans p where p.id = plan_id));

drop policy if exists "transactions_all" on public.transactions;
create policy "transactions_all" on public.transactions for all to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id))
  with check (exists (select 1 from public.plans p where p.id = plan_id));
