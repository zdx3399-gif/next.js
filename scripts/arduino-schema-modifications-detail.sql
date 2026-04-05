-- Arduino IoT 表格修改摘要
-- 針對訪客、包裹、緊急事件功能

/**
 * ========================================================================
 * 修改對象表格統計
 * ========================================================================
 */

-- 修改現有表格：4 個
-- 1. visitors (訪客)
-- 2. packages (包裹)
-- 3. emergencies (緊急事件)
-- 4. emergency_events (緊急事件詳細)

-- 新增表格：3 個
-- 1. emergency_cancellations (緊急取消記錄)
-- 2. iot_devices (IoT設備管理)
-- 3. iot_command_logs (IoT命令日誌)
-- 4. iot_events (IoT事件日誌)

-- 新增視圖：2 個
-- 1. v_pending_iot_notifications (待發送通知)
-- 2. v_iot_device_status (設備狀態總覽)

-- 新增索引：10 個

/**
 * ========================================================================
 * 1. VISITORS 表格 - 訪客門鈴 (V指令)
 * ========================================================================
 */

-- 修改欄位：5 個
-- 新增: iot_notification_sent (boolean)
--   - 目的：標記是否已發送門鈴通知
--   - 用途：在查詢待發送通知時過濾
--
-- 新增: iot_notification_sent_at (timestamp with time zone)
--   - 目的：記錄門鈴發送時間
--   - 用途：追蹤通知延遲
--
-- 新增: iot_notification_status (text)
--   - 目的：追蹤通知狀態
--   - 允許值：pending | sent | failed | acknowledged
--   - 用途：區分各個狀態階段
--
-- 新增: iot_doorbell_triggered_at (timestamp with time zone)
--   - 目的：記錄門鈴實際被觸發的時間
--   - 用途：測量識別延遲（觸發到簽到）
--
-- 新增: iot_device_id (text)
--   - 目的：關聯到具體的IoT門鈴設備
--   - 例值：'doorbell_2a', 'doorbell_3c'
--   - 用途：支援多設備部署

-- 查詢範例：取得所有待發送門鈴通知的訪客
SELECT v.id, v.name, v.created_at, u.unit_number
FROM public.visitors v
LEFT JOIN public.units u ON v.unit_id = u.id
WHERE v.iot_notification_sent = false
  AND v.iot_notification_status = 'pending'
ORDER BY v.created_at ASC;


/**
 * ========================================================================
 * 2. PACKAGES 表格 - 包裹推播 (P指令)
 * ========================================================================
 */

-- 修改欄位：6 個
-- 新增: iot_notification_sent (boolean)
--   - 目的：標記是否已發送包裹推播
--
-- 新增: iot_notification_sent_at (timestamp with time zone)
--   - 目的：記錄推播發送時間
--
-- 新增: iot_notification_status (text)
--   - 允許值：pending | sent | failed | acknowledged
--   - 用途：區分各個狀態階段
--
-- 新增: iot_arrival_notified_at (timestamp with time zone)
--   - 目的：記錄住戶收到到件通知的時間
--
-- 新增: iot_device_id (text)
--   - 目的：關聯到該住戶的推播設備（喇叭/顯示器）
--   - 例值：'speaker_2a', 'display_3c'
--
-- 新增: iot_retry_count (integer)
--   - 目的：追蹤發送重試次數
--   - 用途：如果第一次失敗，自動重試（最多3次）

-- 查詢範例：取得所有失敗且已重試3次的包裹通知
SELECT p.id, p.courier, p.recipient_room, p.iot_retry_count
FROM public.packages p
WHERE p.iot_notification_status = 'failed'
  AND p.iot_retry_count >= 3
ORDER BY p.arrived_at ASC;


/**
 * ========================================================================
 * 3. EMERGENCIES 表格 - 緊急事件 (E指令)
 * ========================================================================
 */

-- 修改欄位：7 個
-- 新增: iot_notification_sent (boolean)
--   - 目的：標記是否已通知管理端
--
-- 新增: iot_notification_sent_at (timestamp with time zone)
--   - 目的：記錄管理端通知時間
--
-- 新增: iot_notification_status (text)
--   - 允許值：pending | sent | failed | acknowledged
--   - 用途：追蹤通知各階段
--
-- 新增: iot_event_ref_id (text)
--   - 目的：關聯到iot_events表中的原始事件
--   - 用途：追蹤事件來源
--
-- 新增: iot_device_id (text)
--   - 目的：記錄觸發設備ID（按鈕編號）
--   - 例值：'button_2a', 'button_3c'
--
-- 新增: severity_level (text)
--   - 允許值：low | medium | high | critical
--   - 用途：按危機程度優先通知

-- 查詢範例：取得所有未回應的critical級別緊急事件
SELECT e.id, e.type, e.time, e.severity_level, 
       CASE 
         WHEN ec.id IS NULL THEN '未取消'
         ELSE '已取消'
       END as status
FROM public.emergencies e
LEFT JOIN public.emergency_cancellations ec ON e.id = ec.emergency_id
WHERE e.severity_level = 'critical'
  AND ec.id IS NULL
ORDER BY e.time DESC;


/**
 * ========================================================================
 * 4. EMERGENCY_EVENTS 表格 - 緊急事件詳細日誌
 * ========================================================================
 */

-- 修改欄位：6 個
-- 新增: event_title (text)
--   - 目的：簡短的事件標題
--   - 例值：'住戶IoT求救', '測試按鈕'
--
-- 新增: severity_level (text)
--   - 允許值：low | medium | high | critical
--   - 用途：區分事件重要性
--
-- 新增: iot_triggered (boolean)
--   - 目的：標記事件是否由IoT設備觸發
--   - 用途：區分手動輸入 vs 自動觸發
--
-- 新增: iot_device_id (text)
--   - 目的：記錄觸發設備
--   - 例值：'button_2a', 'motion_sensor_1'
--
-- 新增: location_info (jsonb)
--   - 目的：存儲設備位置及相關信息
--   - 例值：{"unit": "2A", "area": "客廳", "coordinates": "45.5N,123.4E"}
--
-- 新增: response_status (text) 
--   - 允許值：pending | acknowledged | responded | resolved
--   - 用途：追蹤事件處理進度

-- 查詢範例：取得過去1小時critical緊急事件及其回應狀態
SELECT 
  ee.event_title, ee.severity_level, ee.created_at,
  ee.response_status, ee.iot_device_id,
  ee.location_info->>'unit' as unit,
  ee.location_info->>'area' as area
FROM public.emergency_events ee
WHERE ee.iot_triggered = true
  AND ee.severity_level = 'critical'
  AND ee.created_at > NOW() - INTERVAL '1 hour'
ORDER BY ee.created_at DESC;

/**
 * ========================================================================
 * 5. EMERGENCY_CANCELLATIONS 表格 (NEW) - 緊急取消 (C指令)
 * ========================================================================
 */

-- 新表格，共8欄
-- 目的: 追蹤所有緊急事件的取消記錄

-- 欄位說明:
-- id (uuid) - 主鍵
-- emergency_id (uuid) - FK to emergencies
--   - 關聯的緊急事件
--
-- cancelled_by_id (uuid) - FK to profiles
--   - 誰按下了取消按鈕（可能是住戶或管理員）
--
-- cancelled_at (timestamp with time zone)
--   - 實際取消時間
--
-- cancellation_reason (text)
--   - 取消原因：'user_cancel' | 'false_alarm' | 'resolved' | 'testing'
--
-- iot_cancel_confirmation (boolean)
--   - IoT設備是否已確認取消
--
-- iot_cancel_confirmed_at (timestamp with time zone)
--   - IoT設備確認時間
--
-- iot_device_id (text)
--   - 按下取消按鈕的設備ID
--
-- created_at (timestamp with time zone)
--   - 取消記錄建檔時間

-- 查詢範例：統計最近7天的誤報率
SELECT 
  DATE(ec.cancelled_at) as cancel_date,
  COUNT(*) as cancel_count,
  COUNT(CASE WHEN ec.cancellation_reason = 'false_alarm' THEN 1 END) as false_alarms,
  ROUND(
    100.0 * COUNT(CASE WHEN ec.cancellation_reason = 'false_alarm' THEN 1 END) 
    / COUNT(*), 2
  ) as false_alarm_rate
FROM public.emergency_cancellations ec
WHERE ec.cancelled_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(ec.cancelled_at)
ORDER BY cancel_date DESC;


/**
 * ========================================================================
 * 6. IOT_DEVICES 表格 (NEW) - IoT設備管理
 * ========================================================================
 */

-- 新表格，共10欄
-- 目的: 中央管理所有連接的Arduino設備

-- 欄位說明:
-- id (uuid) - 主鍵
-- device_id (text, UNIQUE) - 設備唯一標識
--   - 例值：'doorbell_2a', 'speaker_3c', 'button_1f'
--
-- device_name (text) - 易讀名稱
--   - 例值：'2A房間門鈴', '3C走廊喇叭'
--
-- device_type (text) - 設備類型
--   - 允許值：doorbell | alarm | speaker | multi_function
--
-- location (text) - 物理位置
--   - 例值：'2A走廊', '一樓大廳'
--
-- unit_id (uuid) - FK to units
--   - 關聯住戶單位（可選，部份設備不屬特定單位）
--
-- status (text) - 設備狀態
--   - 允許值：active | inactive | maintenance
--
-- battery_level (integer) - 電池百分比（0-100）
--   - 用於無線設備
//
-- last_ping_at (timestamp with time zone) - 最後心跳時間
//   - 用於偵測設備掉線
--
-- firmware_version (text) - 固件版本
//   - 例值：'v2.1.0', 'v3.0.1'
--
-- configuration (jsonb) - 自訂配置參數
//   - 例值：{"alert_volume": 80, "language": "zh-tw"}

-- 查詢範例：找出所有掉線的設備（1小時內無心跳）
SELECT d.device_id, d.device_name, d.location, d.last_ping_at
FROM public.iot_devices d
WHERE d.status = 'active'
  AND (d.last_ping_at IS NULL OR d.last_ping_at < NOW() - INTERVAL '1 hour')
ORDER BY d.last_ping_at ASC;


/**
 * ========================================================================
 * 7. IOT_COMMAND_LOGS 表格 (NEW) - IoT命令日誌
 * ========================================================================
 */

-- 新表格，共12欄
-- 目的: 審計所有發送給Arduino設備的命令

-- 欄位說明:
-- id (uuid) - 主鍵
-- command_type (text) - V | P | E | C
--   - V: 訪客門鈴
--   - P: 包裹推播
--   - E: 緊急事件
--   - C: 取消
--
-- target_device_id (text) - 目標設備ID
--
-- related_type (text, 可選) - 相關記錄類型
--   - visitor | package | emergency
--
-- related_id (uuid, 可選) - 相關記錄ID
--
-- command_payload (jsonb) - 發送的命令詳情
//
// send_status (text) - pending | sent | failed | timeout
--
-- response_payload (jsonb) - Arduino的回應
--
-- response_time_ms (integer) - 響應時間（毫秒）
--
-- retry_count (integer) - 當前重試次數
--
// max_retries (integer) - 最大重試次數（通常3）
--
-- sent_at (timestamp) - 甲骨文送時間
--
-- acknowledged_at (timestamp) - 裝置確認時間
--
-- created_at (timestamp) - 記錄建檔時間
--
-- created_by (uuid) - FK to profiles - 誰發起的命令

-- 查詢範例：過去1小時內失敗的命令
SELECT 
  command_type, target_device_id, COUNT(*) as count
FROM public.iot_command_logs
WHERE send_status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY command_type, target_device_id
ORDER BY count DESC;


/**
 * ========================================================================
 * 8. IOT_EVENTS 表格 (NEW) - IoT事件日誌
 * ========================================================================
 */

-- 新表格，共10欄
-- 目的: 記錄來自Arduino設備的上報事件

-- 欄位說明:
-- id (uuid) - 主鍵
-- device_id (text) - 發送設備ID
//
-- event_type (text) - visitor | package | emergency | cancel | status | error
--
-- event_data (jsonb) - 事件詳細數據（由設備提供）
--   - 例：{"unit": "2A", "duration": 15, "battery": 87}
--
-- message (text) - 人類易讀的事件描述
//
// processed (boolean) - 是否已處理
--
// processed_at (timestamp) - 處理時間
--
// linked_record_type (text) - 關聯記錄類型
--   - visitor | package | emergency
--
-- linked_record_id (uuid) - 關聯記錄ID
--
//- created_at (timestamp) - 事件時間

-- 查詢範例：所有未處理的緊急事件
SELECT * FROM public.iot_events
WHERE event_type = 'emergency'
  AND processed = false
ORDER BY created_at DESC;
