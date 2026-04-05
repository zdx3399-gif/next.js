-- Arduino IoT 整合 - 數據庫 Schema 修改
-- 2026-04-06

-- =====================================================
-- 1. 訪客 (Visitor) - V 指令支援
-- =====================================================

-- 添加訪客表字段：IoT門鈴通知
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS iot_notification_sent boolean DEFAULT false;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS iot_notification_sent_at timestamp with time zone;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS iot_notification_status text DEFAULT 'pending'::text CHECK (iot_notification_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'acknowledged'::text]));
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS iot_doorbell_triggered_at timestamp with time zone;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS iot_device_id text;

-- =====================================================
-- 2. 包裹 (Package) - P 指令支援
-- =====================================================

-- 添加包裹表字段：IoT推播通知
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS iot_notification_sent boolean DEFAULT false;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS iot_notification_sent_at timestamp with time zone;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS iot_notification_status text DEFAULT 'pending'::text CHECK (iot_notification_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'acknowledged'::text]));
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS iot_arrival_notified_at timestamp with time zone;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS iot_device_id text;
ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS iot_retry_count integer DEFAULT 0;

-- =====================================================
-- 3. 緊急事件 (Emergency) - E 指令支援
-- =====================================================

-- 修改 emergencies 表，添加 IoT 相關欄位
ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS iot_notification_sent boolean DEFAULT false;
ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS iot_notification_sent_at timestamp with time zone;
ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS iot_notification_status text DEFAULT 'pending'::text CHECK (iot_notification_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'acknowledged'::text]));
ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS iot_event_ref_id text;
ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS iot_device_id text;
  ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS iot_triggered boolean DEFAULT false;
  ALTER TABLE public.emergencies ADD COLUMN IF NOT EXISTS severity_level text DEFAULT 'high'::text CHECK (severity_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]));

-- 修改 emergency_events 表，添加 IoT 追蹤
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS event_title text;
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS severity_level text DEFAULT 'high'::text CHECK (severity_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]));
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS iot_triggered boolean DEFAULT false;
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS iot_device_id text;
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS location_info jsonb;
ALTER TABLE public.emergency_events ADD COLUMN IF NOT EXISTS response_status text DEFAULT 'pending'::text CHECK (response_status = ANY (ARRAY['pending'::text, 'acknowledged'::text, 'responded'::text, 'resolved'::text]));

-- =====================================================
-- 4. 緊急取消 (Emergency Cancel) - C 指令支援
-- =====================================================

-- 添加 emergency_cancellations 表（追蹤取消事件）
CREATE TABLE IF NOT EXISTS public.emergency_cancellations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  emergency_id uuid NOT NULL,
  cancelled_by_id uuid,
  cancelled_at timestamp with time zone NOT NULL DEFAULT now(),
  cancellation_reason text,
  iot_cancel_confirmation boolean DEFAULT false,
  iot_cancel_confirmed_at timestamp with time zone,
  iot_device_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT emergency_cancellations_pkey PRIMARY KEY (id),
  CONSTRAINT emergency_cancellations_emergency_id_fkey FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id),
  CONSTRAINT emergency_cancellations_cancelled_by_id_fkey FOREIGN KEY (cancelled_by_id) REFERENCES public.profiles(id)
);

-- =====================================================
-- 5. IoT 設備和事件日誌表
-- =====================================================

-- IoT 設備管理表
CREATE TABLE IF NOT EXISTS public.iot_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  device_name text NOT NULL,
  device_type text NOT NULL CHECK (device_type = ANY (ARRAY['doorbell'::text, 'alarm'::text, 'speaker'::text, 'multi_function'::text])),
  location text,
  unit_id uuid,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'maintenance'::text])),
  last_ping_at timestamp with time zone,
  battery_level integer CHECK (battery_level >= 0 AND battery_level <= 100),
  firmware_version text,
  configuration jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT iot_devices_pkey PRIMARY KEY (id),
  CONSTRAINT iot_devices_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id)
);

-- IoT 命令日誌表
CREATE TABLE IF NOT EXISTS public.iot_command_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  command_type text NOT NULL CHECK (command_type = ANY (ARRAY['V'::text, 'P'::text, 'E'::text, 'C'::text])),
  target_device_id text NOT NULL,
  related_type text CHECK (related_type = ANY (ARRAY['visitor'::text, 'package'::text, 'emergency'::text])),
  related_id uuid,
  command_payload jsonb,
  send_status text DEFAULT 'pending'::text CHECK (send_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'timeout'::text])),
  response_payload jsonb,
  response_time_ms integer,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  sent_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT iot_command_logs_pkey PRIMARY KEY (id),
  CONSTRAINT iot_command_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- IoT 事件日誌表（來自Arduino設備的上報事件）
CREATE TABLE IF NOT EXISTS public.iot_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['visitor'::text, 'package'::text, 'emergency'::text, 'cancel'::text, 'status'::text, 'error'::text])),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  processed boolean DEFAULT false,
  processed_at timestamp with time zone,
  linked_record_type text CHECK (linked_record_type = ANY (ARRAY['visitor'::text, 'package'::text, 'emergency'::text])),
  linked_record_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT iot_events_pkey PRIMARY KEY (id)
);

-- =====================================================
-- 6. 索引優化
-- =====================================================

-- 訪客 IoT 查詢索引
CREATE INDEX IF NOT EXISTS idx_visitors_iot_notification_status 
  ON public.visitors(iot_notification_status, iot_notification_sent);
CREATE INDEX IF NOT EXISTS idx_visitors_iot_device_id 
  ON public.visitors(iot_device_id);

-- 包裹 IoT 查詢索引
CREATE INDEX IF NOT EXISTS idx_packages_iot_notification_status 
  ON public.packages(iot_notification_status, iot_notification_sent);
CREATE INDEX IF NOT EXISTS idx_packages_iot_device_id 
  ON public.packages(iot_device_id, status);

-- 緊急事件 IoT 查詢索引
CREATE INDEX IF NOT EXISTS idx_emergencies_iot_notification_status 
  ON public.emergencies(iot_notification_status, iot_triggered);
CREATE INDEX IF NOT EXISTS idx_emergency_events_iot_triggered 
  ON public.emergency_events(iot_triggered, response_status);

-- IoT 命令日誌查詢索引
CREATE INDEX IF NOT EXISTS idx_iot_command_logs_command_type 
  ON public.iot_command_logs(command_type, send_status);
CREATE INDEX IF NOT EXISTS idx_iot_command_logs_related 
  ON public.iot_command_logs(related_type, related_id);

-- IoT 事件日誌查詢索引
CREATE INDEX IF NOT EXISTS idx_iot_events_device_id 
  ON public.iot_events(device_id, event_type);
CREATE INDEX IF NOT EXISTS idx_iot_events_processed 
  ON public.iot_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_iot_events_linked 
  ON public.iot_events(linked_record_type, linked_record_id);

-- =====================================================
-- 7. 視圖定義（於數據查詢）
-- =====================================================

-- 待發送 IoT 通知總覽
DROP VIEW IF EXISTS public.v_pending_iot_notifications;
CREATE VIEW public.v_pending_iot_notifications AS
SELECT 
  'visitor' as notification_type,
  id as record_id,
  name as subject,
  created_at as triggered_at,
  iot_notification_status,
  iot_device_id
FROM public.visitors
WHERE iot_notification_sent = false AND iot_notification_status = 'pending'::text

UNION ALL

SELECT 
  'package' as notification_type,
  id as record_id,
  courier as subject,
  arrived_at as triggered_at,
  iot_notification_status,
  iot_device_id
FROM public.packages
WHERE iot_notification_sent = false AND iot_notification_status = 'pending'::text

UNION ALL

SELECT 
  'emergency' as notification_type,
  id as record_id,
  type as subject,
  time as triggered_at,
  iot_notification_status,
  iot_device_id
FROM public.emergencies
WHERE iot_notification_sent = false AND iot_notification_status = 'pending'::text;

-- IoT 設備狀態總覽
DROP VIEW IF EXISTS public.v_iot_device_status;
CREATE VIEW public.v_iot_device_status AS
SELECT 
  d.id,
  d.device_id,
  d.device_name,
  d.device_type,
  d.status,
  d.location,
  d.unit_id,
  d.battery_level,
  d.last_ping_at,
  COUNT(CASE WHEN cl.send_status = 'pending'::text THEN 1 END) as pending_commands,
  COUNT(CASE WHEN cl.send_status = 'failed'::text THEN 1 END) as failed_commands,
  MAX(ie.created_at) as last_event_at
FROM public.iot_devices d
LEFT JOIN public.iot_command_logs cl ON d.device_id = cl.target_device_id
LEFT JOIN public.iot_events ie ON d.device_id = ie.device_id
GROUP BY d.id, d.device_id, d.device_name, d.device_type, d.status, d.location, d.unit_id, d.battery_level, d.last_ping_at;
