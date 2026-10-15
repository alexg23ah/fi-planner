-- Free-text notes on transactions.
-- Paste into Supabase → SQL Editor → Run, after 003_splits.sql.
alter table public.transactions add column if not exists note text not null default '';
