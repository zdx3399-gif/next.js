-- Schema normalization migration (2026-04-10)
-- Goal: reduce redundancy, improve 3NF consistency, and align auth/profile relations for Supabase.
-- Safe to run multiple times where possible.

begin;

-- 1) Ensure maintenance snapshot column exists for dispatch history (replaces scattered worker/vendor fields)
alter table if exists public.maintenance
  add column if not exists assignment_snapshot jsonb;

-- 2) Migrate emergency contact data from profiles -> emergency_contacts
--    (only if legacy columns still exist)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'emergency_contact_name'
  ) then
    insert into public.emergency_contacts (
      resident_profile_id,
      contact_name,
      contact_phone,
      contact_line_user_id,
      verify_status,
      consented_at
    )
    select
      p.id,
      coalesce(nullif(trim(p.emergency_contact_name), ''), '緊急聯絡人'),
      coalesce(nullif(trim(p.emergency_contact_phone), ''), ''),
      nullif(trim(p.emergency_contact_line_user_id), ''),
      'pending',
      now()
    from public.profiles p
    where (nullif(trim(p.emergency_contact_name), '') is not null
        or nullif(trim(p.emergency_contact_phone), '') is not null
        or nullif(trim(p.emergency_contact_line_user_id), '') is not null)
      and not exists (
        select 1
        from public.emergency_contacts ec
        where ec.resident_profile_id = p.id
      );
  end if;
end $$;

-- 3) Migrate maintenance dispatch fields into assignment_snapshot + logs backup
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'maintenance' and column_name = 'vendor_name'
  ) then
    update public.maintenance m
    set assignment_snapshot = coalesce(m.assignment_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'vendor_name', m.vendor_name,
        'worker_name', m.worker_name,
        'worker_phone', m.worker_phone,
        'handler_name', m.handler_name,
        'reported_by_name', m.reported_by_name,
        'migrated_at', now()
      )
    where m.vendor_name is not null
       or m.worker_name is not null
       or m.worker_phone is not null
       or m.handler_name is not null
       or m.reported_by_name is not null;
  end if;
end $$;

-- 4) Remove redundant columns (3NF)
alter table if exists public.profiles
  drop column if exists emergency_contact_name,
  drop column if exists emergency_contact_phone,
  drop column if exists emergency_contact_line_user_id;

alter table if exists public.maintenance
  drop column if exists reported_by_name,
  drop column if exists vendor_name,
  drop column if exists worker_name,
  drop column if exists worker_phone,
  drop column if exists handler_name;

alter table if exists public.facility_bookings
  drop column if exists user_name,
  drop column if exists user_room;

alter table if exists public.packages
  drop column if exists recipient_name,
  drop column if exists recipient_room;

-- 5) Ensure profiles.id references auth.users(id) with ON DELETE CASCADE
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_name = 'profiles_id_auth_users_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade;
  end if;
exception
  when others then
    raise notice 'Skip profiles->auth.users FK creation: %', sqlerrm;
end $$;

-- 6) Keep household_members role aligned with profiles.role (single source of truth)
create or replace function public.sync_household_member_role_from_profile()
returns trigger
language plpgsql
as $$
begin
  if new.profile_id is not null then
    select p.role into new.role
    from public.profiles p
    where p.id = new.profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_household_role_from_profile on public.household_members;
create trigger trg_sync_household_role_from_profile
before insert or update of profile_id on public.household_members
for each row
execute function public.sync_household_member_role_from_profile();

-- 7) Merge emergency_sessions + emergency_reports_line into emergency_incidents (canonical table)
create table if not exists public.emergency_incidents (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('line_report', 'line_session', 'system')),
  reporter_line_user_id text,
  reporter_profile_id uuid references public.profiles(id),
  event_type text,
  location text,
  description text,
  image_url text,
  status text not null default 'pending' check (status in ('draft', 'pending', 'submitted', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  source_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_emergency_incidents_reporter_profile_id on public.emergency_incidents(reporter_profile_id);
create index if not exists idx_emergency_incidents_status on public.emergency_incidents(status);
create index if not exists idx_emergency_incidents_created_at on public.emergency_incidents(created_at desc);

-- migrate from emergency_reports_line (if table exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'emergency_reports_line'
  ) then
    insert into public.emergency_incidents (
      source,
      reporter_line_user_id,
      reporter_profile_id,
      event_type,
      location,
      description,
      image_url,
      status,
      reviewed_by,
      reviewed_at,
      source_record_id,
      created_at,
      updated_at
    )
    select
      'line_report',
      erl.reporter_line_user_id,
      erl.reporter_profile_id,
      erl.event_type,
      erl.location,
      erl.description,
      erl.image_url,
      erl.status,
      erl.reviewed_by,
      erl.reviewed_at,
      erl.id,
      erl.created_at,
      erl.updated_at
    from public.emergency_reports_line erl
    where not exists (
      select 1 from public.emergency_incidents ei
      where ei.source = 'line_report' and ei.source_record_id = erl.id
    );
  end if;
end $$;

-- migrate from emergency_sessions (if table exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'emergency_sessions'
  ) then
    insert into public.emergency_incidents (
      source,
      reporter_line_user_id,
      event_type,
      location,
      description,
      image_url,
      status,
      source_record_id,
      created_at,
      updated_at
    )
    select
      'line_session',
      es.line_user_id,
      es.event_type,
      es.location,
      es.description,
      es.image_url,
      case
        when es.status = 'submitted' then 'submitted'
        when es.status in ('event_type', 'location', 'description', 'confirm') then 'draft'
        else 'pending'
      end,
      es.id,
      es.created_at,
      es.updated_at
    from public.emergency_sessions es
    where not exists (
      select 1 from public.emergency_incidents ei
      where ei.source = 'line_session' and ei.source_record_id = es.id
    );
  end if;
end $$;

-- 8) Replace legacy emergency tables with compatibility views backed by emergency_incidents
drop view if exists public.v_emergency_reports_line;
drop view if exists public.v_emergency_sessions;

do $$
declare
  rel_kind char;
begin
  select c.relkind into rel_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'emergency_reports_line'
  limit 1;

  if rel_kind in ('r', 'p') then
    execute 'drop table public.emergency_reports_line';
  elsif rel_kind in ('v', 'm') then
    execute 'drop view public.emergency_reports_line';
  end if;

  rel_kind := null;

  select c.relkind into rel_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'emergency_sessions'
  limit 1;

  if rel_kind in ('r', 'p') then
    execute 'drop table public.emergency_sessions';
  elsif rel_kind in ('v', 'm') then
    execute 'drop view public.emergency_sessions';
  end if;
end $$;

create or replace view public.emergency_reports_line as
select
  ei.id,
  ei.reporter_line_user_id,
  ei.reporter_profile_id,
  ei.event_type,
  ei.location,
  ei.description,
  case
    when ei.status in ('pending', 'submitted') then 'pending'
    when ei.status = 'approved' then 'approved'
    when ei.status = 'rejected' then 'rejected'
    else 'pending'
  end as status,
  ei.reviewed_by,
  ei.reviewed_at,
  ei.created_at,
  ei.updated_at,
  ei.image_url
from public.emergency_incidents ei
where ei.source = 'line_report';

create or replace view public.emergency_sessions as
select
  ei.id,
  ei.reporter_line_user_id as line_user_id,
  ei.event_type,
  ei.location,
  ei.description,
  case
    when ei.status = 'draft' then 'description'
    when ei.status = 'submitted' then 'submitted'
    else 'pending'
  end as status,
  ei.created_at,
  ei.updated_at,
  ei.image_url
from public.emergency_incidents ei
where ei.source = 'line_session';

create or replace view public.v_emergency_reports_line as
select * from public.emergency_reports_line;

create or replace view public.v_emergency_sessions as
select * from public.emergency_sessions;

-- 9) Drop tables with no in-repo runtime usage evidence.
-- Keep chat_log/chat_history/knowledge for now because current app code still depends on them.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'emergency_contact_bind_tokens'
  ) then
    drop table public.emergency_contact_bind_tokens;
  end if;
exception
  when others then
    raise notice 'Skip dropping emergency_contact_bind_tokens: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'unbind_requests'
  ) then
    drop table public.unbind_requests;
  end if;
exception
  when others then
    raise notice 'Skip dropping unbind_requests: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'system_config'
  ) then
    drop table public.system_config;
  end if;
exception
  when others then
    raise notice 'Skip dropping system_config: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'messages'
  ) then
    drop table public.messages;
  end if;
exception
  when others then
    raise notice 'Skip dropping messages: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'residents'
  ) then
    drop table public.residents;
  end if;
exception
  when others then
    raise notice 'Skip dropping residents: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'repairs'
  ) then
    drop table public.repairs;
  end if;
exception
  when others then
    raise notice 'Skip dropping repairs: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'maintenance_dispatches'
  ) then
    drop table public.maintenance_dispatches;
  end if;
exception
  when others then
    raise notice 'Skip dropping maintenance_dispatches: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'line_users_legacy'
  ) then
    drop table public.line_users_legacy;
  end if;
exception
  when others then
    raise notice 'Skip dropping line_users_legacy: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'line_bindings'
  ) then
    drop table public.line_bindings;
  end if;
exception
  when others then
    raise notice 'Skip dropping line_bindings: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'expenses'
  ) then
    drop table public.expenses;
  end if;
exception
  when others then
    raise notice 'Skip dropping expenses: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'intent_stats'
  ) then
    drop table public.intent_stats;
  end if;
exception
  when others then
    raise notice 'Skip dropping intent_stats: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'iot_action_logs'
  ) then
    drop table public.iot_action_logs;
  end if;
exception
  when others then
    raise notice 'Skip dropping iot_action_logs: %', sqlerrm;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'line_users'
  ) then
    drop view public.line_users;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'line_users'
  ) then
    drop table public.line_users;
  end if;
exception
  when others then
    raise notice 'Skip dropping line_users: %', sqlerrm;
end $$;

commit;
