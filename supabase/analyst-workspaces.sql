-- Optional private analyst backup. Run as the project owner in Supabase SQL Editor.
-- This script owns only public.analyst_workspaces and its named trigger/policies.
-- Re-running it preserves backups. No service key belongs in a browser build.
begin;

create table if not exists public.analyst_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  revision bigint not null default 1
);

-- Fail safely if an unrelated/incompatible table already uses this name.
-- Explicit COALESCE is essential: a CHECK otherwise accepts missing JSON fields.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.analyst_workspaces'::regclass and conname = 'analyst_workspace_payload_valid') then
    alter table public.analyst_workspaces add constraint analyst_workspace_payload_valid check (
      coalesce(
        jsonb_typeof(payload) = 'object'
        and payload ->> 'schema' = 'lucifer-analyst'
        and payload -> 'version' = '1'::jsonb
        and jsonb_typeof(payload -> 'reports') = 'array'
        and case when jsonb_typeof(payload -> 'reports') = 'array'
          then jsonb_array_length(payload -> 'reports') <= 500 else false end
        and octet_length(payload::text) <= 5242880,
        false
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.analyst_workspaces'::regclass and conname = 'analyst_workspace_revision_valid') then
    alter table public.analyst_workspaces add constraint analyst_workspace_revision_valid check (revision between 1 and 9007199254740991);
  end if;
end
$$;

-- Server-generated metadata makes compare-and-replace dependable across devices.
create or replace function public.set_analyst_workspace_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    NEW.revision := 1;
  else
    NEW.revision := OLD.revision + 1;
  end if;
  NEW.updated_at := clock_timestamp();
  return NEW;
end;
$$;

revoke all on function public.set_analyst_workspace_revision() from public, anon, authenticated;
drop trigger if exists analyst_workspace_revision on public.analyst_workspaces;
create trigger analyst_workspace_revision
  before insert or update on public.analyst_workspaces
  for each row execute function public.set_analyst_workspace_revision();

alter table public.analyst_workspaces enable row level security;
alter table public.analyst_workspaces force row level security;
revoke all on table public.analyst_workspaces from public, anon, authenticated;
grant select, insert, update, delete on table public.analyst_workspaces to authenticated;

drop policy if exists analyst_workspace_select_owner on public.analyst_workspaces;
create policy analyst_workspace_select_owner on public.analyst_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists analyst_workspace_insert_owner on public.analyst_workspaces;
create policy analyst_workspace_insert_owner on public.analyst_workspaces
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists analyst_workspace_update_owner on public.analyst_workspaces;
create policy analyst_workspace_update_owner on public.analyst_workspaces
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists analyst_workspace_delete_owner on public.analyst_workspaces;
create policy analyst_workspace_delete_owner on public.analyst_workspaces
  for delete to authenticated using ((select auth.uid()) = user_id);

-- A restrictive boundary also prevents any older permissive policy from widening
-- authenticated access if this dedicated table was configured before this script.
drop policy if exists analyst_workspace_owner_boundary on public.analyst_workspaces;
create policy analyst_workspace_owner_boundary on public.analyst_workspaces
  as restrictive for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.analyst_workspaces is 'One optional personal analyst JSON backup per signed-in owner; no team sharing or automatic synchronization.';
commit;
