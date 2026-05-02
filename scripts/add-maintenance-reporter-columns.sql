-- 補充 maintenance 表缺少的欄位（供 LINE bot 報修 + 狀態通知使用）
-- 可重複執行

alter table if exists public.maintenance
  add column if not exists reported_by_id  uuid references public.profiles(id) on delete set null,
  add column if not exists unit_id          uuid references public.units(id) on delete set null,
  add column if not exists completed_at     timestamp with time zone,
  add column if not exists admin_note       text;

-- 若 reported_by (TEXT) 有值但 reported_by_id 仍為 null，可手動回填：
-- update public.maintenance m
--   set reported_by_id = p.id
--   from public.profiles p
--   where p.name = m.reported_by
--     and m.reported_by_id is null;
