-- FI Planner: plans table with row-level security.
-- Paste into Supabase → SQL Editor → Run.

create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default 'Household plan',
  data        jsonb not null,
  shared_with text[] not null default '{}',   -- lower-case emails that can view and edit
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists plans_owner_idx on public.plans (owner_id);
create index if not exists plans_shared_idx on public.plans using gin (shared_with);

alter table public.plans enable row level security;

-- Owner or anyone listed in shared_with can read.
drop policy if exists "plans_select" on public.plans;
create policy "plans_select" on public.plans for select to authenticated
  using (owner_id = auth.uid() or lower(auth.jwt() ->> 'email') = any (shared_with));

-- Only the signed-in user can create a plan they own.
drop policy if exists "plans_insert" on public.plans;
create policy "plans_insert" on public.plans for insert to authenticated
  with check (owner_id = auth.uid());

-- Owner or shared members can edit.
drop policy if exists "plans_update" on public.plans;
create policy "plans_update" on public.plans for update to authenticated
  using (owner_id = auth.uid() or lower(auth.jwt() ->> 'email') = any (shared_with))
  with check (owner_id = auth.uid() or lower(auth.jwt() ->> 'email') = any (shared_with));

-- Only the owner can delete.
drop policy if exists "plans_delete" on public.plans;
create policy "plans_delete" on public.plans for delete to authenticated
  using (owner_id = auth.uid());

-- Shared members must not be able to change ownership or the share list.
create or replace function public.plans_guard()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if old.owner_id <> auth.uid() then
    new.owner_id := old.owner_id;
    new.shared_with := old.shared_with;
  end if;
  new.shared_with := array(select distinct lower(trim(e)) from unnest(new.shared_with) e where trim(e) <> '');
  return new;
end $$;

drop trigger if exists plans_guard on public.plans;
create trigger plans_guard before update on public.plans
  for each row execute function public.plans_guard();
