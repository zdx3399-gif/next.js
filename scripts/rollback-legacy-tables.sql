-- ============================================================
-- 回滾腳本（Rollback）
-- 用途：若 drop-legacy-tables.sql 執行後發生問題，從備份重建表結構
-- 前提：執行此腳本前必須先有 data backup（pg_dump 或 Supabase 快照）
-- ============================================================

-- ⚠️  此腳本只重建表結構，不含資料
-- ⚠️  請從備份匯入資料，或使用 Supabase Dashboard > Backups 還原

begin;

-- ── 重建 repairs 表 ─────────────────────────────────────────────
create table if not exists public.repairs (
  id              uuid primary key default gen_random_uuid(),
  repair_code     text,
  user_id         text,
  category        text,
  building        text,
  location        text,
  description     text not null,
  priority        text default 'medium'  check (priority in ('low','medium','high','urgent')),
  status          text default 'pending' check (status in ('pending','processing','completed','cancelled')),
  assigned_to     text,
  notes           text,
  completed_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 重建 maintenance_dispatches 表 ───────────────────────────────
create table if not exists public.maintenance_dispatches (
  id              uuid primary key default gen_random_uuid(),
  maintenance_id  uuid references public.maintenance(id) on delete cascade,
  vendor_name     text,
  worker_name     text,
  worker_phone    text,
  scheduled_at    timestamptz,
  estimated_cost  numeric,
  admin_note      text,
  status          text default 'pending',
  created_at      timestamptz default now()
);

-- ── 重建 line_users 實表（先刪 VIEW）────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'line_users'
  ) then
    drop view public.line_users;
    raise notice '已刪除 line_users VIEW，重建為實表';
  end if;
end $$;

create table if not exists public.line_users (
  id              uuid primary key default gen_random_uuid(),
  line_user_id    text unique not null,
  display_name    text,
  avatar_url      text,
  status_message  text,
  profile_id      uuid references public.profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── 重建 line_bindings 表 ─────────────────────────────────────────
create table if not exists public.line_bindings (
  id              uuid primary key default gen_random_uuid(),
  platform_user_id uuid references public.profiles(id),
  line_user_id    text not null,
  status          text default 'active' check (status in ('active','inactive')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

commit;

-- 完成後請從備份匯入資料：
-- psql -h <host> -U <user> -d <db> -f backup.sql
