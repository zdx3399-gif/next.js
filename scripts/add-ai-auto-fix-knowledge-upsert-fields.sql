-- Add stable keys for AI auto-fix knowledge entries.
-- Run this once in each tenant Supabase database before using "新增至知識庫".

alter table public.knowledge
  add column if not exists source text,
  add column if not exists source_key text,
  add column if not exists question text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_knowledge_source_key
  on public.knowledge (source, source_key)
  where source is not null and source_key is not null;
