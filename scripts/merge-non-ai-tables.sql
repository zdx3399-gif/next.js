-- 非 AI 聊天範圍資料表整併腳本
-- 目標：整併 repairs -> maintenance、maintenance_dispatches -> maintenance.logs
-- 注意：本腳本採「可重複執行」設計，實際上線前請先在 staging 驗證

begin;

-- 1) repairs -> maintenance（若 repairs 存在才搬）
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'repairs'
  ) then
    insert into public.maintenance (
      equipment,
      item,
      description,
      note,
      status,
      reported_by_id,
      reported_by_name,
      completed_at,
      created_at,
      updated_at,
      logs
    )
    select
      coalesce(r.category, '一般報修') as equipment,
      trim(concat(coalesce(r.building, ''), case when r.location is not null and r.location <> '' then ' / ' || r.location else '' end)) as item,
      coalesce(r.description, '') as description,
      coalesce(r.notes, '') as note,
      case
        when r.status in ('processing') then 'progress'
        when r.status in ('completed', 'cancelled') then 'closed'
        else 'open'
      end as status,
      nullif(r.user_id::text, 'admin')::uuid as reported_by_id,
      case when r.user_id::text = 'admin' then '管理員' else null end as reported_by_name,
      r.completed_at,
      coalesce(r.created_at, now()),
      coalesce(r.updated_at, now()),
      jsonb_build_array(
        jsonb_build_object(
          'type', 'migrated_from_repairs',
          'at', now(),
          'legacy_id', r.id,
          'legacy_repair_code', r.repair_code,
          'legacy_priority', r.priority,
          'legacy_assigned_to', r.assigned_to
        )
      ) as logs
    from public.repairs r;
  end if;
end $$;

-- 2) maintenance_dispatches -> maintenance.logs（若維修派工表存在才搬）
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'maintenance_dispatches'
  ) then
    update public.maintenance m
    set logs = coalesce(m.logs, '[]'::jsonb) || coalesce(md.dispatch_logs, '[]'::jsonb)
    from (
      select
        maintenance_id,
        jsonb_agg(
          jsonb_build_object(
            'type', 'dispatch',
            'at', coalesce(created_at, now()),
            'vendor_name', vendor_name,
            'worker_name', worker_name,
            'worker_phone', worker_phone,
            'scheduled_at', scheduled_at,
            'estimated_cost', estimated_cost,
            'admin_note', admin_note,
            'status', status,
            'legacy_dispatch_id', id
          )
          order by created_at
        ) as dispatch_logs
      from public.maintenance_dispatches
      group by maintenance_id
    ) md
    where m.id = md.maintenance_id;
  end if;
end $$;

-- 3) line_users -> profiles（合併 LINE 綁定主檔到 profiles）
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'line_users'
  ) then
    update public.profiles p
    set
      line_user_id = coalesce(p.line_user_id, lu.line_user_id),
      line_display_name = coalesce(nullif(p.line_display_name, ''), nullif(lu.display_name, '')),
      line_avatar_url = coalesce(nullif(p.line_avatar_url, ''), nullif(lu.avatar_url, '')),
      line_status_message = coalesce(nullif(p.line_status_message, ''), nullif(lu.status_message, '')),
      updated_at = now()
    from public.line_users lu
    where lu.profile_id = p.id
      and (
        p.line_user_id is null
        or p.line_display_name is null
        or p.line_avatar_url is null
        or p.line_status_message is null
      );
  end if;
end $$;

-- 4) 建立 line_users 相容 view（讓舊查詢可過渡，不需立刻改全站）
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'line_users'
  ) then
    alter table public.line_users rename to line_users_legacy;
  end if;

  if exists (
    select 1
    from information_schema.views
    where table_schema = 'public' and table_name = 'line_users'
  ) then
    drop view public.line_users;
  end if;

  create view public.line_users as
  select
    p.id,
    p.line_user_id,
    coalesce(p.line_display_name, p.name, '') as display_name,
    p.line_avatar_url as avatar_url,
    p.line_status_message as status_message,
    p.created_at,
    p.updated_at,
    p.id as profile_id
  from public.profiles p
  where p.line_user_id is not null;
end $$;

-- 5) line_bindings -> profiles（若存在可回填，之後標記 legacy）
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'line_bindings'
  ) then
    update public.profiles p
    set
      line_user_id = coalesce(p.line_user_id, lb.line_user_id),
      updated_at = now()
    from public.line_bindings lb
    where lb.platform_user_id = p.id
      and lb.status = 'active'
      and p.line_user_id is null;
  end if;
end $$;

-- 3) 建立相容 view（可選）：legacy repairs
-- 若你仍有 BI/報表查 repairs，可先建立 view 過渡
-- create or replace view public.repairs_legacy_view as
-- select
--   id,
--   'M-' || left(id::text, 8) as repair_code,
--   reported_by_id as user_id,
--   equipment as category,
--   null::text as building,
--   item as location,
--   description,
--   'medium'::text as priority,
--   case when status = 'progress' then 'processing' when status = 'closed' then 'completed' else 'pending' end as status,
--   handler_name as assigned_to,
--   note as notes,
--   created_at,
--   updated_at,
--   completed_at
-- from public.maintenance;

-- 6) 候選下線（請先人工確認依賴，再解除註解）
-- drop table if exists public.repairs;
-- drop table if exists public.maintenance_dispatches;
-- drop table if exists public.line_bindings;
-- drop table if exists public.users;
-- drop table if exists public.emergency_events;
-- drop table if exists public.announcement_comments;
-- drop table if exists public.announcement_likes;

commit;
