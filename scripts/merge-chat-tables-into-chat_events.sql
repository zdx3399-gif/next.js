-- Merge chat_history + chat_log + chat_feedback into one unified table: chat_events
-- Safe approach: create new table and backfill, do NOT drop old tables.

begin;

create table if not exists public.chat_events (
  id bigserial primary key,
  source text not null check (source in ('chat_history', 'chat_log')),
  source_pk text not null,
  created_at timestamptz not null default now(),
  user_id text,
  event_id text,

  -- Question/answer fields
  question text,
  raw_question text,
  normalized_question text,
  answer text,

  -- NLP / routing
  intent text,
  intent_confidence numeric,
  answered boolean,
  needs_clarification boolean,
  clarification_parent_id text,

  -- Retrieval / model metrics
  search_method text,
  similarity double precision,
  match_count integer,
  response_ms integer,
  sources jsonb,
  images jsonb,
  api_used jsonb,

  -- Review / learning queue
  needs_review boolean,
  issue_type text,
  priority integer,
  review_status text,
  admin_notes text,

  -- Feedback snapshot
  rating integer,
  is_helpful boolean,
  feedback text,
  success_count integer,
  unclear_count integer,
  fail_count integer,

  -- Full feedback records from chat_feedback (for chat_log source)
  feedback_events jsonb not null default '[]'::jsonb,

  merged_at timestamptz not null default now(),

  unique (source, source_pk)
);

create index if not exists idx_chat_events_created_at on public.chat_events (created_at desc);
create index if not exists idx_chat_events_source on public.chat_events (source);
create index if not exists idx_chat_events_user_id on public.chat_events (user_id);
create index if not exists idx_chat_events_issue_type on public.chat_events (issue_type);
create index if not exists idx_chat_events_review_status on public.chat_events (review_status);

-- Aggregate chat_feedback rows by chat_log_id
with feedback_agg as (
  select
    cf.chat_log_id::text as chat_log_id,
    jsonb_agg(
      jsonb_build_object(
        'id', cf.id,
        'user_id', cf.user_id,
        'feedback_type', cf.feedback_type,
        'clarification_choice', cf.clarification_choice,
        'comment', cf.comment,
        'created_at', cf.created_at
      )
      order by cf.created_at asc
    ) as feedback_events
  from public.chat_feedback cf
  group by cf.chat_log_id
)
insert into public.chat_events (
  source,
  source_pk,
  created_at,
  user_id,
  question,
  answer,
  search_method,
  similarity,
  match_count,
  response_ms,
  sources,
  images,
  api_used,
  needs_review,
  issue_type,
  priority,
  review_status,
  admin_notes,
  rating,
  is_helpful,
  feedback,
  feedback_events
)
select
  'chat_history' as source,
  ch.id::text as source_pk,
  ch.created_at,
  ch.user_id::text,
  ch.question,
  ch.answer,
  ch.search_method,
  ch.similarity,
  ch.match_count,
  ch.response_ms,
  ch.sources::jsonb,
  coalesce(ch.images::jsonb, '[]'::jsonb),
  ch.api_used::jsonb,
  ch.needs_review,
  ch.issue_type,
  ch.priority,
  ch.review_status,
  ch.admin_notes,
  ch.rating,
  ch.is_helpful,
  ch.feedback,
  '[]'::jsonb as feedback_events
from public.chat_history ch
on conflict (source, source_pk) do update
set
  created_at = excluded.created_at,
  user_id = excluded.user_id,
  question = excluded.question,
  answer = excluded.answer,
  search_method = excluded.search_method,
  similarity = excluded.similarity,
  match_count = excluded.match_count,
  response_ms = excluded.response_ms,
  sources = excluded.sources,
  images = excluded.images,
  api_used = excluded.api_used,
  needs_review = excluded.needs_review,
  issue_type = excluded.issue_type,
  priority = excluded.priority,
  review_status = excluded.review_status,
  admin_notes = excluded.admin_notes,
  rating = excluded.rating,
  is_helpful = excluded.is_helpful,
  feedback = excluded.feedback,
  merged_at = now();

with feedback_agg as (
  select
    cf.chat_log_id::text as chat_log_id,
    jsonb_agg(
      jsonb_build_object(
        'id', cf.id,
        'user_id', cf.user_id,
        'feedback_type', cf.feedback_type,
        'clarification_choice', cf.clarification_choice,
        'comment', cf.comment,
        'created_at', cf.created_at
      )
      order by cf.created_at asc
    ) as feedback_events
  from public.chat_feedback cf
  group by cf.chat_log_id
)
insert into public.chat_events (
  source,
  source_pk,
  created_at,
  user_id,
  event_id,
  raw_question,
  normalized_question,
  question,
  intent,
  intent_confidence,
  answered,
  needs_clarification,
  clarification_parent_id,
  feedback,
  success_count,
  unclear_count,
  fail_count,
  feedback_events
)
select
  'chat_log' as source,
  cl.id::text as source_pk,
  cl.created_at,
  cl.user_id::text,
  cl.event_id,
  cl.raw_question,
  cl.normalized_question,
  coalesce(cl.raw_question, cl.normalized_question) as question,
  cl.intent,
  cl.intent_confidence,
  cl.answered,
  cl.needs_clarification,
  cl.clarification_parent_id::text,
  cl.feedback,
  cl.success_count,
  cl.unclear_count,
  cl.fail_count,
  coalesce(fa.feedback_events, '[]'::jsonb) as feedback_events
from public.chat_log cl
left join feedback_agg fa on fa.chat_log_id = cl.id::text
on conflict (source, source_pk) do update
set
  created_at = excluded.created_at,
  user_id = excluded.user_id,
  event_id = excluded.event_id,
  raw_question = excluded.raw_question,
  normalized_question = excluded.normalized_question,
  question = excluded.question,
  intent = excluded.intent,
  intent_confidence = excluded.intent_confidence,
  answered = excluded.answered,
  needs_clarification = excluded.needs_clarification,
  clarification_parent_id = excluded.clarification_parent_id,
  feedback = excluded.feedback,
  success_count = excluded.success_count,
  unclear_count = excluded.unclear_count,
  fail_count = excluded.fail_count,
  feedback_events = excluded.feedback_events,
  merged_at = now();

commit;

-- Quick checks
-- select source, count(*) from public.chat_events group by source;
-- select count(*) as chat_history_count from public.chat_history;
-- select count(*) as chat_log_count from public.chat_log;
-- select count(*) as unified_count from public.chat_events;
