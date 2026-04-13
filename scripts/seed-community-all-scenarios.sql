-- 社區討論全情境測試資料（可重複執行）
-- 包含：申訴前 / 申訴中 / 申訴後成功 / 申訴後失敗 / 影子封禁 / 已下架 / 已刪除 / 已遮蔽 / 已發布 / 待審核

set lock_timeout = '3s';
set statement_timeout = '30s';

begin;

-- 固定測試帳號
-- resident: 434a92c0-9a7e-48cd-8e83-76acb77b537a（鄭得諼）
-- reviewer: b0000002-0002-0002-0002-000000000002

-- 固定測試貼文 ID（重跑時可覆蓋）
-- 申訴四分區
-- f101: 申訴前
-- f102: 申訴中
-- f103: 申訴後成功
-- f104: 申訴後失敗
-- 其他狀態
-- f105: AI 初篩影子封禁
-- f106: 人工下架
-- f107: 已遮蔽
-- f108: 已刪除
-- f109: 已發布
-- f110: 待審核

-- 0) 清理舊資料（僅清本腳本固定 ID）
delete from public.moderation_queue
where item_type = 'post'
  and item_id in (
    'f1010000-0000-0000-0000-000000000001',
    'f1020000-0000-0000-0000-000000000002',
    'f1030000-0000-0000-0000-000000000003',
    'f1040000-0000-0000-0000-000000000004',
    'f1050000-0000-0000-0000-000000000005',
    'f1060000-0000-0000-0000-000000000006',
    'f1070000-0000-0000-0000-000000000007',
    'f1080000-0000-0000-0000-000000000008',
    'f1090000-0000-0000-0000-000000000009',
    'f1100000-0000-0000-0000-000000000010'
  );

delete from public.moderation_appeals
where post_id in (
  'f1010000-0000-0000-0000-000000000001',
  'f1020000-0000-0000-0000-000000000002',
  'f1030000-0000-0000-0000-000000000003',
  'f1040000-0000-0000-0000-000000000004',
  'f1050000-0000-0000-0000-000000000005',
  'f1060000-0000-0000-0000-000000000006',
  'f1070000-0000-0000-0000-000000000007',
  'f1080000-0000-0000-0000-000000000008',
  'f1090000-0000-0000-0000-000000000009',
  'f1100000-0000-0000-0000-000000000010'
);

delete from public.community_posts
where id in (
  'f1010000-0000-0000-0000-000000000001',
  'f1020000-0000-0000-0000-000000000002',
  'f1030000-0000-0000-0000-000000000003',
  'f1040000-0000-0000-0000-000000000004',
  'f1050000-0000-0000-0000-000000000005',
  'f1060000-0000-0000-0000-000000000006',
  'f1070000-0000-0000-0000-000000000007',
  'f1080000-0000-0000-0000-000000000008',
  'f1090000-0000-0000-0000-000000000009',
  'f1100000-0000-0000-0000-000000000010'
);

-- 1) 建立貼文（全部情境）
insert into public.community_posts (
  id,
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
  moderation_reason,
  redacted_title,
  redacted_content,
  redacted_items,
  created_at,
  updated_at
)
values
-- 申訴前（可申訴：AI 初篩 pending）
(
  'f1010000-0000-0000-0000-000000000001',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴前】A棟12樓半夜噪音',
  'A棟12樓半夜持續噪音，影響作息。',
  '{}'::jsonb,
  'pending',
  'high',
  'AI 判定可能含精確位置與負面指控',
  null,
  null,
  'AI 初判高風險，待人工審核',
  null,
  null,
  null,
  now() - interval '8 hour',
  now() - interval '4 hour'
),
-- 申訴中（pending）
(
  'f1020000-0000-0000-0000-000000000002',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴中】地下室糾紛說明',
  '地下室停車糾紛，內容已修正，請協助人工複審。',
  '{}'::jsonb,
  'shadow',
  'medium',
  'AI 需人工複審',
  now() - interval '2 hour',
  null,
  'AI 初篩暫停顯示，待申訴複審',
  null,
  null,
  null,
  now() - interval '6 hour',
  now() - interval '2 hour'
),
-- 申訴後成功（restored）
(
  'f1030000-0000-0000-0000-000000000003',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴後成功】停車管理建議',
  '建議調整停車動線並增設指引。',
  '{}'::jsonb,
  'published',
  'medium',
  '原文風險中等，人工複審可發布',
  now() - interval '50 minute',
  'b0000002-0002-0002-0002-000000000002',
  '申訴成功：內容修正後恢復顯示',
  null,
  null,
  null,
  now() - interval '5 hour',
  now() - interval '40 minute'
),
-- 申訴後失敗（rejected）
(
  'f1040000-0000-0000-0000-000000000004',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'opinion',
  'real_name',
  '鄭得諼',
  '【申訴後失敗】住戶指控貼文',
  '內容仍包含指控與個資線索。',
  '{}'::jsonb,
  'removed',
  'high',
  'AI 判定高風險誹謗內容',
  now() - interval '1 hour',
  'b0000002-0002-0002-0002-000000000002',
  '申訴失敗：維持下架',
  null,
  null,
  null,
  now() - interval '7 hour',
  now() - interval '30 minute'
),
-- 影子封禁（AI 初篩）
(
  'f1050000-0000-0000-0000-000000000005',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'opinion',
  'real_name',
  '鄭得諼',
  '【影子封禁】AI 初篩樣本',
  '這篇先以 AI 初篩暫停顯示。',
  '{}'::jsonb,
  'shadow',
  'high',
  'AI 偵測高風險詞句，需人工複審',
  now() - interval '3 hour',
  null,
  'AI 初篩暫停顯示',
  null,
  null,
  null,
  now() - interval '9 hour',
  now() - interval '3 hour'
),
-- 已下架（人工）
(
  'f1060000-0000-0000-0000-000000000006',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'case',
  'real_name',
  '鄭得諼',
  '【已下架】人工處置樣本',
  '這篇已被人工直接下架。',
  '{}'::jsonb,
  'removed',
  'medium',
  '內容偏離社區規範',
  now() - interval '5 hour',
  'b0000002-0002-0002-0002-000000000002',
  '人工審核：下架',
  null,
  null,
  null,
  now() - interval '10 hour',
  now() - interval '5 hour'
),
-- 已遮蔽（防雷遮罩，不進申訴）
(
  'f1070000-0000-0000-0000-000000000007',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'case',
  'real_name',
  '鄭得諼',
  '【已遮蔽】住戶爭議（防雷）',
  '此內容已啟用防雷遮罩，展開後可查看完整描述。',
  '{}'::jsonb,
  'redacted',
  'high',
  '偵測到位置與姓名資訊',
  now() - interval '6 hour',
  'b0000002-0002-0002-0002-000000000002',
  '已遮蔽敏感資訊',
  '【已遮蔽】住戶爭議（防雷）',
  '此內容已啟用防雷遮罩，展開後可查看完整描述。',
  '["防雷遮罩"]'::jsonb,
  now() - interval '11 hour',
  now() - interval '6 hour'
),
-- 已刪除
(
  'f1080000-0000-0000-0000-000000000008',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'opinion',
  'real_name',
  '鄭得諼',
  '【已刪除】樣本貼文',
  '這篇是已刪除狀態樣本。',
  '{}'::jsonb,
  'deleted',
  'low',
  '作者主動刪除或管理員刪除',
  now() - interval '1 day',
  'b0000002-0002-0002-0002-000000000002',
  '已刪除',
  null,
  null,
  null,
  now() - interval '2 day',
  now() - interval '1 day'
),
-- 已發布
(
  'f1090000-0000-0000-0000-000000000009',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'howto',
  'real_name',
  '鄭得諼',
  '【已發布】健身房使用提醒',
  '健身房開放時間與禮儀說明。',
  '{}'::jsonb,
  'published',
  'low',
  '風險低，可直接發布',
  null,
  null,
  null,
  null,
  null,
  null,
  now() - interval '3 day',
  now() - interval '2 day'
),
-- 待審核
(
  'f1100000-0000-0000-0000-000000000010',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  'alert',
  'real_name',
  '鄭得諼',
  '【待審核】通道障礙通報',
  '公共通道疑似被堆放雜物。',
  '{}'::jsonb,
  'pending',
  'medium',
  '待人工確認內容描述',
  null,
  null,
  null,
  null,
  null,
  null,
  now() - interval '4 day',
  now() - interval '4 day'
);

-- 2) 建立申訴紀錄（四分區）
insert into public.moderation_appeals
  (post_id, author_id, reason, status, review_note, reviewed_by, reviewed_at, created_at, updated_at)
values
(
  'f1020000-0000-0000-0000-000000000002',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  '已修正文案，請協助複審。',
  'pending',
  null,
  null,
  null,
  now() - interval '45 minute',
  now() - interval '30 minute'
),
(
  'f1030000-0000-0000-0000-000000000003',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  '我已移除敏感描述，請恢復顯示。',
  'restored',
  '已修正為中性建議內容，恢復顯示。',
  'b0000002-0002-0002-0002-000000000002',
  now() - interval '40 minute',
  now() - interval '70 minute',
  now() - interval '40 minute'
),
(
  'f1040000-0000-0000-0000-000000000004',
  '434a92c0-9a7e-48cd-8e83-76acb77b537a',
  '請恢復，這是事實陳述。',
  'rejected',
  '仍含人身攻擊與可識別線索，維持下架。',
  'b0000002-0002-0002-0002-000000000002',
  now() - interval '25 minute',
  now() - interval '90 minute',
  now() - interval '25 minute'
);

-- 3) 建立審核隊列（待處理 + 已完成）
insert into public.moderation_queue
  (item_type, item_id, priority, ai_risk_summary, ai_suggested_action, status, created_at)
values
(
  'post',
  'f1020000-0000-0000-0000-000000000002',
  'high',
  '住戶申訴案件：請人工複審（申訴中）',
  'review_appeal',
  'pending',
  now() - interval '30 minute'
),
(
  'post',
  'f1100000-0000-0000-0000-000000000010',
  'medium',
  '一般內容待人工審核',
  'review',
  'in_review',
  now() - interval '3 hour'
),
(
  'post',
  'f1030000-0000-0000-0000-000000000003',
  'high',
  '申訴複審完成：已恢復',
  'approve',
  'resolved',
  now() - interval '1 hour'
),
(
  'post',
  'f1040000-0000-0000-0000-000000000004',
  'high',
  '申訴複審完成：維持下架',
  'remove',
  'resolved',
  now() - interval '1 hour'
);

-- 補齊已完成隊列欄位
update public.moderation_queue
set
  resolved_at = now() - interval '40 minute',
  resolution = '{"action":"approve","reason":"申訴成功，恢復顯示","resolved_by":"b0000002-0002-0002-0002-000000000002"}'
where item_id = 'f1030000-0000-0000-0000-000000000003'
  and status = 'resolved';

update public.moderation_queue
set
  resolved_at = now() - interval '25 minute',
  resolution = '{"action":"remove","reason":"申訴失敗，維持下架","resolved_by":"b0000002-0002-0002-0002-000000000002"}'
where item_id = 'f1040000-0000-0000-0000-000000000004'
  and status = 'resolved';

commit;

-- 驗證 1：貼文狀態分布
select status, count(*)
from public.community_posts
where id in (
  'f1010000-0000-0000-0000-000000000001',
  'f1020000-0000-0000-0000-000000000002',
  'f1030000-0000-0000-0000-000000000003',
  'f1040000-0000-0000-0000-000000000004',
  'f1050000-0000-0000-0000-000000000005',
  'f1060000-0000-0000-0000-000000000006',
  'f1070000-0000-0000-0000-000000000007',
  'f1080000-0000-0000-0000-000000000008',
  'f1090000-0000-0000-0000-000000000009',
  'f1100000-0000-0000-0000-000000000010'
)
group by status
order by status;

-- 驗證 2：申訴四分區（作者 = 鄭得諼）
select cp.title, cp.status as post_status, ma.status as appeal_status, ma.updated_at
from public.moderation_appeals ma
join public.community_posts cp on cp.id = ma.post_id
where ma.author_id = '434a92c0-9a7e-48cd-8e83-76acb77b537a'
order by ma.updated_at desc;

-- 驗證 3：審核隊列（待處理 / 已完成）
select status, count(*)
from public.moderation_queue
where item_type = 'post'
  and item_id in (
    'f1020000-0000-0000-0000-000000000002',
    'f1030000-0000-0000-0000-000000000003',
    'f1040000-0000-0000-0000-000000000004',
    'f1100000-0000-0000-0000-000000000010'
  )
group by status
order by status;
