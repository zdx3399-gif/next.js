-- Arduino IoT 功能說明和 API 集成範例
-- 針對會用到Arduino的表格和欄位修改

/**
 * ===============================================
 * 1. 訪客 (Visitor) - V 指令 - 門鈴通知
 * ===============================================
 * 
 * 工作流程:
 * 訪客預約 → 簽到時 → 觸發IoT門鈴 → 住戶接收通知
 * 
 * 新增欄位:
 * - iot_notification_sent (boolean) - 是否已發送IoT門鈴
 * - iot_notification_sent_at (timestamp) - 門鈴觸發時間
 * - iot_notification_status (text) - pending/sent/failed/acknowledged
 * - iot_doorbell_triggered_at (timestamp) - 門鈴實際觸發時間
 * - iot_device_id (text) - 目標設備ID（如門鈴編號）
 * 
 * API 流程:
 */

-- 訪客簽到時更新 visitors 表並發送IoT指令
-- 假設在 app/api/visitor/route.js 中:
-- 
-- const result = await supabase
--   .from('visitors')
--   .update({
--     checked_in_at: new Date().toISOString(),
--     status: 'checked_in',
--     iot_notification_sent: false,          // 標記待發送
--     iot_notification_status: 'pending',
--     iot_device_id: unit.iot_doorbell_id   // 該住戶的門鈴設備ID
--   })
--   .eq('id', visitor_id);
--
-- 然後調用 IoT API:
-- const iotResponse = await fetch('/api/iot', {
--   method: 'POST',
--   body: JSON.stringify({ cmd: 'V' })  // V = Visitor
-- });
--
-- 成功後更新:
-- await supabase
--   .from('visitors')
--   .update({
--     iot_notification_sent: true,
--     iot_notification_sent_at: new Date().toISOString(),
--     iot_notification_status: 'sent',
--     iot_doorbell_triggered_at: new Date().toISOString()
--   })
--   .eq('id', visitor_id);


/**
 * ===============================================
 * 2. 包裹 (Package) - P 指令 - 包裹推播
 * ===============================================
 * 
 * 工作流程:
 * 包裹到件 → 系統錄入 → 觸發IoT推播 → 住戶收到通知
 * 
 * 新增欄位:
 * - iot_notification_sent (boolean) - 是否已發送IoT推播
 * - iot_notification_sent_at (timestamp) - 推播時間
 * - iot_notification_status (text) - pending/sent/failed/acknowledged
 * - iot_arrival_notified_at (timestamp) - 到件通知時間
 * - iot_device_id (text) - 目標設備ID（如住戶房間的終端機）
 * - iot_retry_count (integer) - 重試次數
 * 
 * API 流程:
 */

-- 包裹新增時更新 packages 表並發送IoT指令
-- 假設在 app/api/packages/route.js 中:
--
-- const result = await supabase
--   .from('packages')
--   .insert({
--     courier: 'FedEx',
--     recipient_room: '2A',
--     recipient_name: '王小明',
--     arrived_at: new Date().toISOString(),
--     status: 'pending',
--     iot_notification_sent: false,
--     iot_notification_status: 'pending',
--     iot_device_id: unit.iot_speaker_id,  // 該住戶的喇叭設備ID
--     iot_retry_count: 0
--   });
--
-- 後續重試邏輯示例:
-- if (iotResponse.status !== 200 && iot_retry_count < 3) {
--   await supabase
--     .from('packages')
--     .update({ iot_retry_count: iot_retry_count + 1 })
--     .eq('id', package_id);
--   // 再試一次
-- }


/**
 * ===============================================
 * 3. 緊急事件 (Emergency) - E 指令 - 緊急通知
 * ===============================================
 * 
 * 工作流程:
 * 住戶按下IoT求救按鈕 → 系統記錄 → 觸發管理端緊急告警
 * 
 * 新增表:
 * - emergencies (主記錄)
 * - emergency_events (詳細事件日誌)
 * - emergency_cancellations (取消記錄)
 * 
 * emergencies 新增欄位:
 * - iot_notification_sent (boolean) - 是否已通知管理端
 * - iot_notification_sent_at (timestamp) - 通知時間
 * - iot_notification_status (text) - pending/sent/failed/acknowledged
 * - iot_event_ref_id (text) - 對應的IoT事件ID
 * - iot_device_id (text) - 觸發設備ID（按鈕編號）
 * - severity_level (text) - low/medium/high/critical
 * 
 * emergency_events 新增欄位:
 * - event_title (text) - 事件標題
 * - severity_level (text) - 危機程度
 * - iot_triggered (boolean) - 是否由IoT設備觸發
 * - iot_device_id (text) - 觸發設備
 * - location_info (jsonb) - 設備位置信息
 * - response_status (text) - pending/acknowledged/responded/resolved
 * 
 * API 流程:
 */

-- Arduino設備直接POST到 /api/events 端點:
-- curl -X POST http://localhost:3000/api/events \
--   -H "Content-Type: application/json" \
--   -d "{
--     \"eventType\": \"emergency\",
--     \"message\": \"緊急求救 - 房間2A\",
--     \"time\": \"2026-04-06T12:34:56Z\"
--   }"
--
-- 後端在 app/api/events/route.ts 中:
-- const { error } = await supabaseServer
--   .from('emergency_events')
--   .insert({
--     event_title: '住戶IoT求救',
--     message: body.message,
--     iot_triggered: true,
--     iot_device_id: extractDeviceIdFromRequest(req),
--     severity_level: 'critical',
--     response_status: 'pending',
--     created_at: body.time
--   });


/**
 * ===============================================
 * 4. 緊急取消 (Cancel) - C 指令 - 誤報取消
 * ===============================================
 * 
 * 工作流程:
 * 住戶誤按 → 按下取消按鈕 → 系統停止告警 → 管理端收到確認
 * 
 * 新增表:
 * - emergency_cancellations (追蹤所有取消事件)
 * 
 * emergency_cancellations 欄位:
 * - emergency_id (uuid) - 關聯的緊急事件
 * - cancelled_by_id (uuid) - 按下取消按鈕的人
 * - cancelled_at (timestamp) - 取消時間
 * - cancellation_reason (text) - 誤按、測試等
 * - iot_cancel_confirmation (boolean) - IoT設備是否已確認
 * - iot_cancel_confirmed_at (timestamp) - 確認時間
 * - iot_device_id (text) - 取消設備ID
 * 
 * API 流程:
 */

-- 住戶按下取消按鈕，Arduino發送 C 指令:
-- curl -X POST http://localhost:3000/api/iot \
--   -H "Content-Type: application/json" \
--   -d "{ \"cmd\": \"C\" }"
--
-- 後端邏輯 (app/api/iot/route.ts):
-- if (normalizedCmd === 'C') {
--   // 找到最近的未解決緊急事件
--   const latestEmergency = await supabase
--     .from('emergencies')
--     .select('*')
--     .eq('response_status', 'pending')
--     .order('created_at', { ascending: false })
--     .limit(1)
--     .single();
--
--   // 記錄取消
--   await supabase
--     .from('emergency_cancellations')
--     .insert({
--       emergency_id: latestEmergency.id,
--       cancellation_reason: 'user_cancel',
--       iot_cancel_confirmation: true,
--       iot_cancel_confirmed_at: new Date().toISOString(),
--       iot_device_id: req.headers['x-device-id']
--     });
//
--   // 更新緊急事件狀態
--   await supabase
--     .from('emergencies')
--     .update({ status: 'resolved' })
--     .eq('id', latestEmergency.id);
-- }


/**
 * ===============================================
 * 5. IoT 設備管理 (New Table: iot_devices)
 * ===============================================
 * 
 * 用途: 追蹤所有連接的Arduino設備狀態
 * 
 * 欄位說明:
 * - device_id: 設備唯一標識（如 "doorbell_2a", "speaker_3c"）
 * - device_name: 易讀名稱（如 "2A房間門鈴"）
 * - device_type: doorbell | alarm | speaker | multi_function
 * - status: active | inactive | maintenance
 * - unit_id: 關聯住戶單位
 * - battery_level: 電池百分比（如無線設備）
 * - last_ping_at: 最後一次心跳時間
 * - firmware_version: 固件版本
 * - configuration: JSON 配置（自訂參數）
 * 
 * 範例插入:
 */

INSERT INTO public.iot_devices (
  device_id, device_name, device_type, location, 
  status, battery_level, firmware_version
) VALUES 
  ('doorbell_2a', '2A房間門鈴', 'doorbell', '2A走廊', 'active', 95, 'v2.1.0'),
  ('speaker_3c', '3C房間喇叭', 'speaker', '3C走廊', 'active', 100, 'v1.8.0'),
  ('alarm_g1', '一樓告警器', 'alarm', '一樓大廳', 'active', 100, 'v3.0.1');


/**
 * ===============================================
 * 6. IoT 命令日誌 (New Table: iot_command_logs)
 * ===============================================
 * 
 * 用途: 審計所有發送給Arduino的命令
 * 
 * 欄位說明:
 * - command_type: V|P|E|C
 * - target_device_id: 目標設備
 * - send_status: pending | sent | failed | timeout
 * - response_payload: Arduino回應內容
 * - response_time_ms: 響應時間（毫秒）
 * - retry_count: 當前重試次數
 * - max_retries: 最大重試次數
 * 
 * 範例查詢失敗的命令:
 */

SELECT * FROM public.iot_command_logs 
WHERE send_status IN ('failed', 'timeout')
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;


/**
 * ===============================================
 * 7. IoT 事件日誌 (New Table: iot_events)
 * ===============================================
 * 
 * 用途: 記錄來自Arduino設備的上報事件
 * 
 * 欄位說明:
 * - device_id: 發送設備
 * - event_type: visitor | package | emergency | cancel | status | error
 * - event_data: JSON 事件詳細數據
 * - processed: 是否已處理
 * - linked_record_id: 關聯的數據庫記錄
 * 
 * 典型事件範例:
 */

-- Arduino求救按鈕按下
INSERT INTO public.iot_events (
  device_id, event_type, event_data, message
) VALUES (
  'button_2a',
  'emergency',
  '{"unit": "2A", "button_press_count": 1, "battery_level": 87}'::jsonb,
  '住戶緊急求救 - 房間2A'
);

-- 門鈴被按下
INSERT INTO public.iot_events (
  device_id, event_type, event_data, message
) VALUES (
  'doorbell_3c', 
  'visitor',
  '{"visitor_id": "v123", "duration_seconds": 15}'::jsonb,
  '訪客門鈴被按下'
);


/**
 * ===============================================
 * 8. 查詢常用 SQL 語句
 * ===============================================
 */

-- 查詢所有待發送的IoT通知
SELECT * FROM public.v_pending_iot_notifications
ORDER BY triggered_at DESC;

-- 查詢所有IoT設備狀態
SELECT * FROM public.v_iot_device_status
WHERE status = 'active'
ORDER BY last_ping_at DESC;

-- 查詢昨天內失敗的IoT命令
SELECT 
  command_type,
  target_device_id,
  COUNT(*) as failure_count,
  MAX(created_at) as last_failure
FROM public.iot_command_logs
WHERE send_status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY command_type, target_device_id
ORDER BY failure_count DESC;

-- 查詢特定住戶的IoT設備
SELECT d.* 
FROM public.iot_devices d
WHERE d.unit_id = (SELECT id FROM public.units WHERE unit_number = '2A')
ORDER BY d.device_type;

-- 查詢待確認的緊急事件
SELECT 
  e.id, e.type, e.time, e.severity_level,
  ec.id as cancellation_id, ec.cancelled_at
FROM public.emergencies e
LEFT JOIN public.emergency_cancellations ec ON e.id = ec.emergency_id
WHERE e.iot_notification_status = 'acknowledged'
  AND ec.id IS NULL  -- 還未被取消
ORDER BY e.time DESC;

-- 查詢IoT設備心跳（告警設備超過1小時未上線）
SELECT d.device_id, d.device_name, d.last_ping_at
FROM public.iot_devices d
WHERE d.status = 'active'
  AND (d.last_ping_at IS NULL OR d.last_ping_at < NOW() - INTERVAL '1 hour')
ORDER BY d.last_ping_at ASC;
