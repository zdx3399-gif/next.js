-- 內容申訴機制：可重複執行（三情境）
-- 1) 申訴前（pending）
-- 2) 申訴後失敗（rejected）
-- 3) 申訴後成功（restored）

set lock_timeout = '3s';
set statement_timeout = '30s';

begin;

create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  author_id uuid not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'restored', 'rejected', 'cancelled')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderation_appeals_author_created_idx
  on public.moderation_appeals (author_id, created_at desc);

create index if not exists moderation_appeals_post_status_idx
  on public.moderation_appeals (post_id, status);

create unique index if not exists moderation_appeals_unique_open_idx
  on public.moderation_appeals (post_id, author_id)
  where status in ('pending', 'reviewing');

-- -------------------------------------------------
-- 固定測試帳號
-- resident: 434a92c0-9a7e-48cd-8e83-76acb77b537a（鄭得諼）
-- reviewer: b0000002-0002-0002-0002-000000000002（管委）
-- -------------------------------------------------

-- -------------------------------------------------
-- Step 0. 清理本腳本相關資料（可重跑）
-- -------------------------------------------------

-- 若你要「這兩張表只剩本次三情境資料」，就必須先整表清空
delete from public.moderation_queue;
delete from public.moderation_appeals;

delete from public.audit_logs
where reason in (
  '住戶申訴：已依AI規則修正文案，申請複審',
  '申訴失敗：誹謗風險未消除，維持下架',
  '申訴成功：違規指控已移除，恢復顯示'
)
   or (
     target_type in ('community_post', 'post')
     and target_id in (
       select id
       from public.community_posts
       where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
         and title in (
           '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
           '【申訴後失敗】B棟705住戶是騙子請大家小心',
           '【申訴後成功】深夜噪音改善建議（不指名）',
           '申訴測試貼文（鄭得諼）',
           '【申訴前樣本】社區清潔建議',
           '【申訴後樣本】社區停車動線建議'
         )
     )
   );

delete from public.moderation_queue
where ai_risk_summary in (
  'AI高風險：位置資訊+負面指控（申訴待審）',
  'AI高風險：誹謗指控未修正（申訴駁回）',
  'AI高風險：已修正為中性建議（申訴通過）'
)
or (
  item_type = 'post'
  and item_id in (
    select id
    from public.community_posts
    where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
      and title in (
        '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
        '【申訴後失敗】B棟705住戶是騙子請大家小心',
        '【申訴後成功】深夜噪音改善建議（不指名）',
        '申訴測試貼文（鄭得諼）',
        '【申訴前樣本】社區清潔建議',
        '【申訴後樣本】社區停車動線建議'
      )
  )
);

delete from public.moderation_appeals
where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and (
    reason like '我願意將戶別改成匿名描述，請人工複審。%'
    or reason like '我認為內容屬事實提醒，請恢復。%'
    or reason like '我已移除戶別與指控字眼，改為一般建議。%'
    or reason like '申訴前測試：%'
    or reason like '申訴後測試：%'
    or reason like '住戶申訴：內容被誤判，請協助複審（鄭得諼）%'
  );

delete from public.community_posts
where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and title in (
    '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
    '【申訴後失敗】B棟705住戶是騙子請大家小心',
    '【申訴後成功】深夜噪音改善建議（不指名）',
    '申訴測試貼文（鄭得諼）',
    '【申訴前樣本】社區清潔建議',
    '【申訴後樣本】社區停車動線建議'
  );

-- -------------------------------------------------
-- Step 1. 建三筆被處置貼文
-- -------------------------------------------------
insert into public.community_posts (
  author_id,
  category,
  display_mode,
  display_name,
  title,
  content,
  structured_data,
  status,
  ai_risk_level,
  ai_risk_reason,
  moderated_at,
  moderated_by,
  moderation_reason
)
values
(
  '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid,
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
  'A棟12樓那戶半夜都很吵，根本是故意擾民，請大家小心這種住戶。',
  '{}'::jsonb,
  'removed',
  'high',
  'AI 判定疑似誹謗風險（位置資訊 + 負面指控）',
  now(),
  'b0000002-0002-0002-0002-000000000002'::uuid,
  'AI 判定疑似誹謗風險（位置資訊 + 負面指控），先行下架'
),
(
  '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid,
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴後失敗】B棟705住戶是騙子請大家小心',
  'B棟705那個人就是騙子，會亂收代辦費，大家不要再被他騙。',
  '{}'::jsonb,
  'removed',
  'high',
  'AI 判定疑似誹謗與人身攻擊',
  now(),
  'b0000002-0002-0002-0002-000000000002'::uuid,
  'AI 判定疑似誹謗與人身攻擊，先行下架'
),
(
  '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid,
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴後成功】深夜噪音改善建議（不指名）',
  '建議社區增加夜間巡查與勸導機制，避免深夜噪音影響住戶休息。',
  '{}'::jsonb,
  'removed',
  'medium',
  'AI 判定需人工複審，先行下架',
  now(),
  'b0000002-0002-0002-0002-000000000002'::uuid,
  'AI 初判高風險，待人工複審'
);

-- -------------------------------------------------
-- Step 2. 建立三筆申訴
-- -------------------------------------------------
insert into public.moderation_appeals (post_id, author_id, reason, status, created_at, updated_at)
select
  cp.id,
  '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid,
  case
    when cp.title = '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民' then '我願意將戶別改成匿名描述，請人工複審。'
    when cp.title = '【申訴後失敗】B棟705住戶是騙子請大家小心' then '我認為內容屬事實提醒，請恢復。'
    else '我已移除戶別與指控字眼，改為一般建議。'
  end,
  case
    when cp.title = '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民' then 'pending'
    when cp.title = '【申訴後失敗】B棟705住戶是騙子請大家小心' then 'rejected'
    else 'restored'
  end,
  now(),
  now()
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title in (
    '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
    '【申訴後失敗】B棟705住戶是騙子請大家小心',
    '【申訴後成功】深夜噪音改善建議（不指名）'
  );

update public.moderation_appeals ma
set
  reviewed_by = 'b0000002-0002-0002-0002-000000000002'::uuid,
  reviewed_at = now(),
  review_note = case
    when ma.status = 'rejected' then '仍含戶別與騙子等指控，屬誹謗風險，維持下架。'
    when ma.status = 'restored' then '已移除戶別與人身指控，改為一般建議，恢復顯示。'
    else ma.review_note
  end,
  updated_at = now()
where ma.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and ma.status in ('rejected', 'restored');

-- -------------------------------------------------
-- Step 3. 貼文終態
-- -------------------------------------------------
update public.community_posts
set status = 'removed', moderation_reason = '申訴待審核：AI判定疑似誹謗（位置+指控）', moderated_at = now()
where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and title = '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民';

update public.community_posts
set status = 'removed', moderation_reason = '申訴失敗：仍含戶別與誹謗指控', moderated_at = now(), moderated_by = 'b0000002-0002-0002-0002-000000000002'::uuid
where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and title = '【申訴後失敗】B棟705住戶是騙子請大家小心';

update public.community_posts
set status = 'published', moderation_reason = '申訴成功：已移除個資與指控，恢復顯示', moderated_at = now(), moderated_by = 'b0000002-0002-0002-0002-000000000002'::uuid
where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and title = '【申訴後成功】深夜噪音改善建議（不指名）';

-- -------------------------------------------------
-- Step 4. moderation_queue
-- -------------------------------------------------
insert into public.moderation_queue (item_type, item_id, priority, ai_risk_summary, ai_suggested_action, status)
select 'post', cp.id, 'high', 'AI高風險：位置資訊+負面指控（申訴待審）', 'review_appeal', 'pending'
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title = '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民';

insert into public.moderation_queue (item_type, item_id, priority, ai_risk_summary, ai_suggested_action, status, resolved_at, resolution)
select 'post', cp.id, 'high', 'AI高風險：誹謗指控未修正（申訴駁回）', 'review_appeal', 'resolved', now(),
       '{"action":"remove","reason":"仍含戶別與誹謗指控，維持下架","resolved_by":"b0000002-0002-0002-0002-000000000002"}'
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title = '【申訴後失敗】B棟705住戶是騙子請大家小心';

insert into public.moderation_queue (item_type, item_id, priority, ai_risk_summary, ai_suggested_action, status, resolved_at, resolution)
select 'post', cp.id, 'high', 'AI高風險：已修正為中性建議（申訴通過）', 'review_appeal', 'resolved', now(),
       '{"action":"approve","reason":"已移除戶別與指控，恢復顯示","resolved_by":"b0000002-0002-0002-0002-000000000002"}'
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title = '【申訴後成功】深夜噪音改善建議（不指名）';

-- -------------------------------------------------
-- Step 5. audit_logs
-- -------------------------------------------------
insert into public.audit_logs (operator_id, operator_role, action_type, target_type, target_id, reason)
select
  '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid,
  'resident',
  'appeal_submit',
  'community_post',
  cp.id,
  '住戶申訴：已依AI規則修正文案，申請複審'
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title in (
    '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
    '【申訴後失敗】B棟705住戶是騙子請大家小心',
    '【申訴後成功】深夜噪音改善建議（不指名）'
  );

insert into public.audit_logs (operator_id, operator_role, action_type, target_type, target_id, reason)
select
  'b0000002-0002-0002-0002-000000000002'::uuid,
  'committee',
  'appeal_rejected',
  'community_post',
  cp.id,
  '申訴失敗：誹謗風險未消除，維持下架'
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title = '【申訴後失敗】B棟705住戶是騙子請大家小心';

insert into public.audit_logs (operator_id, operator_role, action_type, target_type, target_id, reason)
select
  'b0000002-0002-0002-0002-000000000002'::uuid,
  'committee',
  'appeal_restored',
  'community_post',
  cp.id,
  '申訴成功：違規指控已移除，恢復顯示'
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title = '【申訴後成功】深夜噪音改善建議（不指名）';

commit;

-- -------------------------------------------------
-- 驗證查詢
-- -------------------------------------------------

-- Z0. 兩張表總筆數（若只跑本腳本，理論：appeals=3、queue=3）
select 'moderation_appeals_total' as metric, count(*) as total from public.moderation_appeals
union all
select 'moderation_queue_total' as metric, count(*) as total from public.moderation_queue;

-- A. 三情境貼文（應 3 筆）
select id, title, status, moderation_reason, updated_at
from public.community_posts
where author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and title in (
    '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
    '【申訴後失敗】B棟705住戶是騙子請大家小心',
    '【申訴後成功】深夜噪音改善建議（不指名）'
  )
order by title;

-- B. 三情境申訴（應 3 筆）
select ma.id, cp.title, ma.status, ma.reason, ma.review_note, ma.reviewed_at
from public.moderation_appeals ma
join public.community_posts cp on cp.id = ma.post_id
where ma.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and cp.title in (
    '【申訴前】A棟12樓住戶半夜噪音且疑似惡意擾民',
    '【申訴後失敗】B棟705住戶是騙子請大家小心',
    '【申訴後成功】深夜噪音改善建議（不指名）'
  )
order by cp.title;

-- C. 舊版殘留（應 0 筆）
select cp.id, cp.title, cp.status
from public.community_posts cp
where cp.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'::uuid
  and (
    cp.title like '申訴測試貼文（%'
    or cp.title like '【申訴前樣本】%'
    or cp.title like '【申訴後樣本】%'
  )
order by cp.title;
