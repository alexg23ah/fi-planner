-- Split transactions with other people.
-- Paste into Supabase → SQL Editor → Run, after 002_budget.sql.
-- split = {"people":[{"name":"Emily","status":"owed|requested|paid","at":"2026-10-15"}]}
alter table public.transactions add column if not exists split jsonb;
create index if not exists transactions_split_idx on public.transactions (plan_id) where split is not null;
