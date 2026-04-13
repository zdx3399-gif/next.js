-- Non-chat normalization phase 2
-- Date: 2026-04-12
-- Goal:
-- 1) Keep emergency_incidents as canonical emergency source
-- 2) Normalize votes.options into vote_options child rows
-- This script is designed to be idempotent and non-breaking.

begin;

-- -----------------------------------------------------------------------------
-- A. Emergency canonical safeguards
-- -----------------------------------------------------------------------------

-- Ensure canonical linkage from legacy emergencies -> emergency_incidents is unique.
create unique index if not exists ux_emergency_incidents_source_record_id_system
  on public.emergency_incidents(source_record_id)
  where source = 'system' and source_record_id is not null;

-- Backfill any missing legacy emergency rows into canonical table.
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
  where ei.source = 'system' and ei.source_record_id = e.id
);

-- -----------------------------------------------------------------------------
-- B. Vote options normalization
-- -----------------------------------------------------------------------------

create table if not exists public.vote_options (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.votes(id) on delete cascade,
  option_key text not null,
  option_label text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vote_options_vote_id_option_key_key unique (vote_id, option_key)
);

create index if not exists idx_vote_options_vote_id on public.vote_options(vote_id);
create index if not exists idx_vote_options_vote_display_order on public.vote_options(vote_id, display_order);
create index if not exists idx_vote_options_vote_label on public.vote_options(vote_id, option_label);

-- Initial backfill from votes.options JSON.
with normalized as (
  select
    v.id as vote_id,
    trim(o.label) as option_label,
    o.ord::int as ord
  from public.votes v
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(v.options) = 'array' then v.options
      when jsonb_typeof(v.options) = 'object' and jsonb_typeof(v.options -> 'options') = 'array' then v.options -> 'options'
      else '[]'::jsonb
    end
  ) with ordinality as o(label, ord)
)
insert into public.vote_options (vote_id, option_key, option_label, display_order)
select
  n.vote_id,
  concat('option_', n.ord::text) as option_key,
  n.option_label,
  n.ord - 1 as display_order
from normalized n
where n.option_label is not null and n.option_label <> ''
on conflict (vote_id, option_key)
do update set
  option_label = excluded.option_label,
  display_order = excluded.display_order,
  updated_at = now();

-- Keep vote_options synchronized when votes.options changes.
create or replace function public.sync_vote_options_from_votes()
returns trigger
language plpgsql
as $$
begin
  delete from public.vote_options where vote_id = new.id;

  insert into public.vote_options (vote_id, option_key, option_label, display_order)
  select
    new.id,
    concat('option_', o.ord::text) as option_key,
    trim(o.label) as option_label,
    o.ord - 1 as display_order
  from jsonb_array_elements_text(
    case
      when jsonb_typeof(new.options) = 'array' then new.options
      when jsonb_typeof(new.options) = 'object' and jsonb_typeof(new.options -> 'options') = 'array' then new.options -> 'options'
      else '[]'::jsonb
    end
  ) with ordinality as o(label, ord)
  where trim(o.label) <> ''
  on conflict (vote_id, option_key)
  do update set
    option_label = excluded.option_label,
    display_order = excluded.display_order,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_vote_options_from_votes on public.votes;
create trigger trg_sync_vote_options_from_votes
after insert or update of options on public.votes
for each row
execute function public.sync_vote_options_from_votes();

-- Normalized read model for future app migration.
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
