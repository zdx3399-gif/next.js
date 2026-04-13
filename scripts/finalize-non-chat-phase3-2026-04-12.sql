-- Non-chat normalization phase 3 (finalization)
-- Date: 2026-04-12
-- Scope: non-chat only
-- Goal:
-- 1) Complete integrity hardening for normalized non-chat tables
-- 2) Keep runtime non-breaking
-- 3) Prepare optional hard-cutover steps (manual)

begin;

-- -----------------------------------------------------------------------------
-- A. Data integrity hardening
-- -----------------------------------------------------------------------------

-- Deduplicate announcement_reads before adding unique index.
with ranked_reads as (
  select
    id,
    row_number() over (
      partition by announcement_id, user_id
      order by read_at desc nulls last, id desc
    ) as rn
  from public.announcement_reads
)
delete from public.announcement_reads ar
using ranked_reads rr
where ar.id = rr.id
  and rr.rn > 1;

create unique index if not exists ux_announcement_reads_announcement_user
  on public.announcement_reads(announcement_id, user_id);

-- Deduplicate vote_records before adding unique index.
with ranked_votes as (
  select
    id,
    row_number() over (
      partition by vote_id, user_id
      order by voted_at desc nulls last, id desc
    ) as rn
  from public.vote_records
)
delete from public.vote_records vr
using ranked_votes rv
where vr.id = rv.id
  and rv.rn > 1;

create unique index if not exists uq_vote_records_vote_user
  on public.vote_records(vote_id, user_id);

-- -----------------------------------------------------------------------------
-- B. Emergency canonical consistency (system source)
-- -----------------------------------------------------------------------------

create unique index if not exists ux_emergency_incidents_source_record_id_system
  on public.emergency_incidents(source_record_id)
  where source = 'system' and source_record_id is not null;

-- Backfill system legacy rows if any drift still exists.
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
  select 1
  from public.emergency_incidents ei
  where ei.source = 'system'
    and ei.source_record_id = e.id
);

-- Compatibility read model for legacy emergency reporting.
create or replace view public.v_emergencies_from_incidents as
select
  ei.source_record_id as legacy_emergency_id,
  ei.id as incident_id,
  ei.event_type as type,
  ei.location,
  ei.description as note,
  ei.status,
  ei.reporter_profile_id as reported_by_id,
  ei.reviewed_by,
  ei.reviewed_at,
  ei.created_at,
  ei.updated_at
from public.emergency_incidents ei
where ei.source = 'system';

-- -----------------------------------------------------------------------------
-- C. Vote normalized read model refresh
-- -----------------------------------------------------------------------------

create or replace view public.v_votes_with_options as
select
  v.*,
  coalesce(
    jsonb_agg(vo.option_label order by vo.display_order)
      filter (where vo.id is not null),
    '[]'::jsonb
  ) as normalized_options
from public.votes v
left join public.vote_options vo
  on vo.vote_id = v.id
group by v.id;

commit;

-- -----------------------------------------------------------------------------
-- Optional hard-cutover checklist (MANUAL, DO NOT AUTO-RUN)
-- -----------------------------------------------------------------------------
-- 1) Confirm application no longer depends on public.votes.options for writes.
-- 2) Confirm all emergency reads use emergency_incidents or v_emergencies_from_incidents.
-- 3) If both are true, schedule maintenance window and then execute manually:
--    drop trigger if exists trg_sync_vote_options_from_votes on public.votes;
--    drop function if exists public.sync_vote_options_from_votes();
--    -- Optionally archive then remove legacy columns/tables in a separate change set.
--    -- alter table public.votes drop column options;
--    -- drop table public.emergencies;
