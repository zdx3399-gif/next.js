-- Normalize emergency runtime tables to canonical emergency_incidents + iot_command_logs/iot_events
-- Date: 2026-04-12
-- NOTE: This script is idempotent and safe to re-run.

begin;

-- 1) Canonical emergency incidents table
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

-- 2) Migrate legacy emergencies -> emergency_incidents
-- Dedup strategy: source='system' + source_record_id=legacy emergencies.id

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'emergencies'
  ) then
    insert into public.emergency_incidents (
      source,
      reporter_profile_id,
      event_type,
      location,
      description,
      status,
      source_record_id,
      created_at,
      updated_at
    )
    select
      'system' as source,
      coalesce(e.reported_by_id, e.created_by) as reporter_profile_id,
      coalesce(e.type, '未分類') as event_type,
      nullif(e.iot_device_id, '') as location,
      coalesce(nullif(e.note, ''), '緊急事件通報') as description,
      case
        when e.iot_notification_status = 'acknowledged' then 'approved'
        when e.iot_notification_status = 'failed' then 'pending'
        else 'submitted'
      end as status,
      e.id as source_record_id,
      coalesce(e.created_at, e.time, now()) as created_at,
      coalesce(e.updated_at, e.time, now()) as updated_at
    from public.emergencies e
    where not exists (
      select 1 from public.emergency_incidents ei
      where ei.source = 'system' and ei.source_record_id = e.id
    );
  end if;
end $$;

-- 3) Ensure IoT command log table exists for canonical command traces
create table if not exists public.iot_command_logs (
  id uuid not null default gen_random_uuid(),
  command_type text not null check (command_type in ('V', 'P', 'E', 'C')),
  target_device_id text not null,
  related_type text check (related_type in ('visitor', 'package', 'emergency')),
  related_id uuid,
  command_payload jsonb,
  send_status text default 'pending' check (send_status in ('pending', 'sent', 'failed', 'timeout')),
  response_payload jsonb,
  response_time_ms integer,
  retry_count integer default 0,
  max_retries integer default 3,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid,
  constraint iot_command_logs_pkey primary key (id),
  constraint iot_command_logs_created_by_fkey foreign key (created_by) references public.profiles(id)
);

create index if not exists idx_iot_command_logs_command_type on public.iot_command_logs(command_type, send_status);
create index if not exists idx_iot_command_logs_related on public.iot_command_logs(related_type, related_id);

-- 4) Ensure IoT events table exists for webhook ingestion
create table if not exists public.iot_events (
  id uuid not null default gen_random_uuid(),
  device_id text not null,
  event_type text not null check (event_type in ('visitor', 'package', 'emergency', 'cancel', 'status', 'error')),
  event_data jsonb not null default '{}'::jsonb,
  message text,
  processed boolean default false,
  processed_at timestamptz,
  linked_record_type text check (linked_record_type in ('visitor', 'package', 'emergency')),
  linked_record_id uuid,
  created_at timestamptz default now(),
  constraint iot_events_pkey primary key (id)
);

create index if not exists idx_iot_events_device_id on public.iot_events(device_id, event_type);
create index if not exists idx_iot_events_processed on public.iot_events(processed, created_at);
create index if not exists idx_iot_events_linked on public.iot_events(linked_record_type, linked_record_id);

-- 5) Optional compatibility view for old reports expecting emergencies-like shape
create or replace view public.v_emergencies_compat as
select
  ei.id,
  ei.event_type as type,
  ei.description as note,
  ei.created_at as time,
  ei.created_at,
  ei.updated_at,
  ei.reporter_profile_id as reported_by_id,
  ei.reporter_profile_id as created_by,
  case
    when ei.status in ('approved', 'rejected') then 'sent'
    when ei.status = 'submitted' then 'pending'
    else 'pending'
  end as iot_notification_status,
  null::timestamptz as iot_notification_sent_at,
  false as iot_notification_sent,
  null::text as iot_event_ref_id,
  null::text as iot_device_id,
  false as iot_triggered,
  'high'::text as severity_level
from public.emergency_incidents ei;

commit;
