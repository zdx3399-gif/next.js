-- 手動貼上執行用（請在每個 tenant 的 Supabase SQL Editor 各跑一次）
-- 若你的管理員 email 不是下列值，請替換 target email。
-- tenant_a 建議：admin@tenant-a.com
-- tenant_b 建議：admin@tenant-b.com

BEGIN;

-- 1) 建立/補齊表結構
CREATE TABLE IF NOT EXISTS routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  assignee_role TEXT NOT NULL CHECK (assignee_role IN ('resident', 'committee', 'guard', 'admin')),
  action_link TEXT NOT NULL DEFAULT '/admin',
  kms_link TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assignee_role TEXT NOT NULL CHECK (assignee_role IN ('resident', 'committee', 'guard', 'admin')),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, due_date)
);

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  module_key TEXT,
  action_link TEXT,
  target_role TEXT,
  target_user_id UUID,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_templates_frequency ON routine_templates(frequency);
CREATE INDEX IF NOT EXISTS idx_routine_instances_status_due_date ON routine_instances(status, due_date);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON notification_events(created_at DESC);

-- 2) 若舊環境 routine_instances 只有 pending/completed，更新 constraint 以支援 in_progress
ALTER TABLE routine_instances DROP CONSTRAINT IF EXISTS routine_instances_status_check;
ALTER TABLE routine_instances
  ADD CONSTRAINT routine_instances_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed'));

-- 3) 建立例行任務範本
INSERT INTO routine_templates (title, frequency, assignee_role, action_link, kms_link)
VALUES
  ('每月財報彙整與公告', 'monthly', 'committee', '/admin?section=finance', '/admin?section=handover-knowledge'),
  ('機電保養巡檢', 'monthly', 'committee', '/admin?section=maintenance', '/admin?section=handover-knowledge'),
  ('季度消防設備檢點', 'quarterly', 'committee', '/admin?section=facilities', '/admin?section=handover-knowledge')
ON CONFLICT DO NOTHING;

-- 4) 建立多筆週期待辦（待處理 / 處理中 / 已完成）
INSERT INTO routine_instances (template_id, due_date, status, assignee_role, completed_at, completed_by)
VALUES
  ((SELECT id FROM routine_templates WHERE title = '每月財報彙整與公告' LIMIT 1), CURRENT_DATE - INTERVAL '3 day', 'pending', 'committee', NULL, NULL),
  ((SELECT id FROM routine_templates WHERE title = '機電保養巡檢' LIMIT 1), CURRENT_DATE - INTERVAL '1 day', 'in_progress', 'committee', NULL, NULL),
  (
    (SELECT id FROM routine_templates WHERE title = '季度消防設備檢點' LIMIT 1),
    CURRENT_DATE - INTERVAL '10 day',
    'completed',
    'committee',
    NOW() - INTERVAL '2 day',
    (SELECT id FROM profiles WHERE email IN ('admin@tenant-a.com', 'admin@tenant-b.com') LIMIT 1)
  )
ON CONFLICT (template_id, due_date) DO NOTHING;

-- 5) 建立多筆小鈴鐺通知
INSERT INTO notification_events (title, message, module_key, action_link, target_role, target_user_id, payload)
VALUES
  (
    '緊急事件待處理',
    '有新的緊急事件尚未結案，請立即處理。',
    'emergencies',
    '/admin?section=emergencies',
    'committee',
    (SELECT id FROM profiles WHERE email IN ('admin@tenant-a.com', 'admin@tenant-b.com') LIMIT 1),
    '{"priority":"high"}'::jsonb
  ),
  (
    '設備維護進行中',
    '機電保養巡檢正在進行，請追蹤完成時程。',
    'maintenance',
    '/admin?section=maintenance',
    'committee',
    (SELECT id FROM profiles WHERE email IN ('admin@tenant-a.com', 'admin@tenant-b.com') LIMIT 1),
    '{"priority":"medium"}'::jsonb
  ),
  (
    '社區討論檢舉提醒',
    '有住戶檢舉尚待審核，請前往社區討論管理。',
    'community',
    '/admin?section=community',
    'committee',
    (SELECT id FROM profiles WHERE email IN ('admin@tenant-a.com', 'admin@tenant-b.com') LIMIT 1),
    '{"priority":"medium"}'::jsonb
  ),
  (
    '管理費異常提醒',
    '本月有未繳管理費，請儘速追蹤。',
    'finance',
    '/admin?section=finance',
    'committee',
    (SELECT id FROM profiles WHERE email IN ('admin@tenant-a.com', 'admin@tenant-b.com') LIMIT 1),
    '{"priority":"high"}'::jsonb
  ),
  (
    '例行任務已產生',
    '本月例行任務已建立，請於期限內完成。',
    'routine',
    '/admin?section=dashboard',
    'committee',
    (SELECT id FROM profiles WHERE email IN ('admin@tenant-a.com', 'admin@tenant-b.com') LIMIT 1),
    '{"priority":"low"}'::jsonb
  );

COMMIT;
