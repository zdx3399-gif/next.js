-- ============================================================
-- 正式下線腳本：廢棄表刪除
-- 前置條件：merge-non-ai-tables.sql 已在 staging 驗證通過
-- 執行前請確認 line_users_legacy / repairs 等表已無任何程式依賴
-- ============================================================

begin;

-- ── 驗證 1：確認 profiles 已含所有 LINE 綁定資料 ──────────────
do $$
declare
  profiles_with_line integer;
  legacy_line_count  integer;
begin
  select count(*) into profiles_with_line
  from public.profiles
  where line_user_id is not null;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'line_users_legacy'
  ) then
    select count(*) into legacy_line_count
    from public.line_users_legacy
    where line_user_id is not null;

    raise notice '--- 驗證報告 ---';
    raise notice 'profiles 已綁定 LINE: % 筆', profiles_with_line;
    raise notice 'line_users_legacy 原有: % 筆', legacy_line_count;

    if profiles_with_line < legacy_line_count then
      raise exception '⛔ 中止：profiles 綁定數 (%) 少於 line_users_legacy (%)，請先重跑 merge-non-ai-tables.sql',
        profiles_with_line, legacy_line_count;
    end if;
  end if;

  raise notice '✅ 驗證通過，可繼續執行下線';
end $$;

-- ── Step 1：刪除 repairs（資料已移至 maintenance）────────────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'repairs'
  ) then
    drop table public.repairs;
    raise notice '✅ 已刪除 repairs 表';
  else
    raise notice 'ℹ️  repairs 不存在，跳過';
  end if;
end $$;

-- ── Step 2：刪除 maintenance_dispatches（已移至 maintenance.logs）───
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'maintenance_dispatches'
  ) then
    drop table public.maintenance_dispatches;
    raise notice '✅ 已刪除 maintenance_dispatches 表';
  else
    raise notice 'ℹ️  maintenance_dispatches 不存在，跳過';
  end if;
end $$;

-- ── Step 3：刪除 line_users_legacy（資料已移至 profiles）───────────
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'line_users_legacy'
  ) then
    drop table public.line_users_legacy;
    raise notice '✅ 已刪除 line_users_legacy 表';
  else
    raise notice 'ℹ️  line_users_legacy 不存在，跳過';
  end if;
end $$;

-- ── Step 4：刪除 line_bindings（已由 profiles.line_user_id 取代）───
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'line_bindings'
  ) then
    drop table public.line_bindings;
    raise notice '✅ 已刪除 line_bindings 表';
  else
    raise notice 'ℹ️  line_bindings 不存在，跳過';
  end if;
end $$;

-- ── Step 5（選用）：刪除 users（無 .from("users") 呼叫）───────────
-- 若確認沒有外部系統依賴，可解除下一行註解
-- drop table if exists public.users;

-- ── Step 6（選用）：刪除其他候選表 ───────────────────────────────
-- 以下需額外審查業務邏輯後才解除
-- drop table if exists public.emergency_events cascade;  -- 會連同 emergency_events_view 一起刪
-- drop table if exists public.announcement_comments;
-- drop table if exists public.announcement_likes;

commit;
