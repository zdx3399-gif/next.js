-- Non-chat normalization phase 4 (hard cutover)
-- Date: 2026-04-12
-- Scope: non-chat only
-- WARNING:
-- 1) This is a destructive cutover for legacy structures.
-- 2) Run only after application has been verified against phase 2/3.
-- 3) Take database backup/snapshot before execution.

begin;

-- -----------------------------------------------------------------------------
-- A. Pre-checks
-- -----------------------------------------------------------------------------

-- Ensure normalized vote table exists.
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'vote_options'
  ) then
    raise exception 'Precheck failed: public.vote_options does not exist';
  end if;
end
$$;

-- Ensure canonical emergency table exists.
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'emergency_incidents'
  ) then
    raise exception 'Precheck failed: public.emergency_incidents does not exist';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- B. Votes: move remaining metadata out of votes.options
-- -----------------------------------------------------------------------------

alter table public.votes
  add column if not exists result_file_url text,
  add column if not exists result_file_name text,
  add column if not exists result_uploaded_at timestamptz;

-- Backfill result metadata from legacy options jsonb object.
-- Guarded for reruns where votes.options may already be removed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'votes'
      and column_name = 'options'
  ) then
    update public.votes v
    set
      result_file_url = coalesce(v.result_file_url, nullif(v.options ->> 'result_file_url', '')),
      result_file_name = coalesce(v.result_file_name, nullif(v.options ->> 'result_file_name', '')),
      result_uploaded_at = coalesce(
        v.result_uploaded_at,
        case
          when nullif(v.options ->> 'result_uploaded_at', '') is not null
          then (v.options ->> 'result_uploaded_at')::timestamptz
          else null
        end
      )
    where jsonb_typeof(v.options) = 'object';
  end if;
end
$$;

-- Rebuild normalized read view to expose result columns explicitly.
-- NOTE: use DROP + CREATE because CREATE OR REPLACE VIEW cannot change
-- existing output column names/order safely in PostgreSQL.
drop view if exists public.v_votes_with_options;
create view public.v_votes_with_options as
select
  v.id,
  v.title,
  v.description,
  v.created_at,
  v.created_by,
  v.ends_at,
  v.status,
  v.form_url,
  v.vote_url,
  v.result_file_url,
  v.result_file_name,
  v.result_uploaded_at,
  coalesce(
    jsonb_agg(vo.option_label order by vo.display_order)
      filter (where vo.id is not null),
    '[]'::jsonb
  ) as normalized_options
from public.votes v
left join public.vote_options vo
  on vo.vote_id = v.id
group by
  v.id,
  v.title,
  v.description,
  v.created_at,
  v.created_by,
  v.ends_at,
  v.status,
  v.form_url,
  v.vote_url,
  v.result_file_url,
  v.result_file_name,
  v.result_uploaded_at;

-- Drop sync trigger/function that depend on votes.options.
drop trigger if exists trg_sync_vote_options_from_votes on public.votes;
drop function if exists public.sync_vote_options_from_votes();

-- Drop legacy compatibility views that still reference votes.options.
drop view if exists public.votes_view;

-- Drop legacy options column.
alter table public.votes
  drop column if exists options;

-- Drop legacy compatibility views that depend on vote_records.option_selected.
drop view if exists public.vote_records_view;

-- Migrate vote_records.option_selected(text) -> uuid FK to vote_options(id).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vote_records'
      and column_name = 'option_selected'
      and data_type <> 'uuid'
  ) then
    -- Step 1: stage column
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vote_records'
        and column_name = 'option_selected_uuid'
    ) then
      alter table public.vote_records add column option_selected_uuid uuid;
    end if;

    -- Step 2: backfill by vote_id + label/key/uuid-text mapping
    update public.vote_records vr
    set option_selected_uuid = vo.id
    from public.vote_options vo
    where vr.vote_id = vo.vote_id
      and (
        vr.option_selected = vo.option_label
        or vr.option_selected = vo.option_key
        or vr.option_selected = vo.id::text
      )
      and vr.option_selected_uuid is null;

    -- Step 3: reject unresolved legacy values
    if exists (
      select 1
      from public.vote_records
      where option_selected is not null
        and option_selected_uuid is null
    ) then
      raise exception 'Cutover failed: unresolved vote_records.option_selected rows found';
    end if;

    -- Step 4: swap columns
    alter table public.vote_records drop column option_selected;
    alter table public.vote_records rename column option_selected_uuid to option_selected;
  end if;
end
$$;

-- Enforce FK integrity after swap (or when already uuid).
alter table public.vote_records
  alter column option_selected set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'vote_records'
      and constraint_name = 'vote_records_option_fkey'
  ) then
    alter table public.vote_records
      add constraint vote_records_option_fkey
      foreign key (option_selected)
      references public.vote_options(id)
      on delete restrict;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- C. Emergencies: hard retire legacy table with archive + compatibility view
-- -----------------------------------------------------------------------------

-- Keep one-way archive of old table to reduce rollback risk.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'emergencies'
      and table_type = 'BASE TABLE'
  ) then
    alter table public.emergencies rename to emergencies_legacy_archive_20260412;
  end if;
end
$$;

-- Compatibility view using canonical incidents (system source).
-- Keeps legacy read path available while removing legacy base table writes.
create or replace view public.emergencies as
select
  ei.source_record_id as id,
  coalesce(ei.event_type, '未分類') as type,
  ei.created_at as time,
  coalesce(ei.description, '') as note,
  ei.created_at,
  ei.updated_at,
  null::uuid as created_by,
  ei.reporter_profile_id as reported_by_id,
  false::boolean as iot_notification_sent,
  null::timestamptz as iot_notification_sent_at,
  case
    when ei.status = 'approved' then 'acknowledged'
    when ei.status = 'rejected' then 'failed'
    when ei.status in ('submitted', 'pending') then 'pending'
    else 'pending'
  end::text as iot_notification_status,
  null::text as iot_event_ref_id,
  null::text as iot_device_id,
  false::boolean as iot_triggered,
  'high'::text as severity_level
from public.emergency_incidents ei
where ei.source = 'system'
  and ei.source_record_id is not null;

-- -----------------------------------------------------------------------------
-- D. Final integrity assertions
-- -----------------------------------------------------------------------------

create unique index if not exists uq_vote_records_vote_user
  on public.vote_records(vote_id, user_id);

create unique index if not exists ux_announcement_reads_announcement_user
  on public.announcement_reads(announcement_id, user_id);

create unique index if not exists ux_emergency_incidents_source_record_id_system
  on public.emergency_incidents(source_record_id)
  where source = 'system' and source_record_id is not null;

commit;
