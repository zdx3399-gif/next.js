# Arduino IoT 整合 - SQL Schema 修改指南

> ⚠️ **注意**: 在執行任何SQL語句前，請備份你的數據庫！

## 📋 修改摘要

針對Arduino IoT功能（訪客、包裹、緊急事件），本指南提供完整的Schema修改。

| 類別 | 修改對象 | 操作 |
|-----|--------|------|
| **訪客門鈴 (V指令)** | `visitors` 表 | 增加5個欄位 |
| **包裹推播 (P指令)** | `packages` 表 | 增加6個欄位 |
| **緊急事件 (E指令)** | `emergencies`, `emergency_events` 表 | 增加13個欄位 |
| **緊急取消 (C指令)** | 新增 `emergency_cancellations` 表 | 新增8欄 |
| **設備管理** | 新增 `iot_devices` 表 | 新增10欄 |
| **命令日誌** | 新增 `iot_command_logs` 表 | 新增12欄 |
| **事件日誌** | 新增 `iot_events` 表 | 新增10欄 |
| **查詢最佳化** | 新增10個索引 | 加速IoT查詢 |
| **數據訪問** | 新增2個視圖 | 簡化複雜查詢 |

---

## 🚀 快速開始

### 步驟 1: 執行主Schema修改腳本

```bash
# 在 Supabase SQL 編輯器執行
# 文件: scripts/arduino-schema-additions.sql
```

此腳本會：
- ✅ 修改 4 個現有表格（visitors, packages, emergencies, emergency_events）
- ✅ 新增 4 個新表格（emergency_cancellations, iot_devices, iot_command_logs, iot_events）
- ✅ 建立 2 個視圖用於常見查詢
- ✅ 創建 10 個性能索引

### 步驟 2: 驗證修改

```sql
-- 查看訪客表新欄位
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'visitors'
ORDER BY column_name;

-- 檢查新表是否存在
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'iot_%' OR tablename = 'emergency_cancellations';
```

### 步驟 3: 初始化設備記錄

```sql
-- 插入你的Arduino設備
INSERT INTO public.iot_devices (
  device_id, device_name, device_type, location, status
) VALUES 
  ('doorbell_2a', '2A房間門鈴', 'doorbell', '2A走廊', 'active'),
  ('speaker_3c', '3C房間喇叭', 'speaker', '3C走廊', 'active');
```

---

## 📁 文件說明

### 1. `arduino-schema-additions.sql`
**主修改腳本** - 包含所有 ALTER TABLE 和 CREATE TABLE 語句
- ✅ 開發/測試環境推薦首先執行
- ✅ 使用 `IF NOT EXISTS` 確保冪等性（可重複執行）

### 2. `arduino-integration-guide.sql`
**集成指南與範例** - 詳細的功能描述和API流程
- 訪客門鈴工作流程 (V)
- 包裹推播工作流程 (P)
- 緊急事件流程 (E)
- 緊急取消流程 (C)
- 常用查詢範例

### 3. `arduino-schema-modifications-detail.sql`
**詳細修改說明** - 每個表格和欄位的詳細文檔
- 修改対象統計
- 每個欄位的目的和用途
- 查詢範例（實際SQL語句）

---

## 🔧 各功能詳細修改

### V - 訪客門鈴通知

**修改表**: `visitors`
**新增欄位** (5個):
```sql
ALTER TABLE public.visitors ADD COLUMN iot_notification_sent boolean DEFAULT false;
ALTER TABLE public.visitors ADD COLUMN iot_notification_sent_at timestamp with time zone;
ALTER TABLE public.visitors ADD COLUMN iot_notification_status text;
ALTER TABLE public.visitors ADD COLUMN iot_doorbell_triggered_at timestamp with time zone;
ALTER TABLE public.visitors ADD COLUMN iot_device_id text;
```

**查詢待發送門鈴**:
```sql
SELECT v.*, u.unit_number 
FROM public.visitors v
LEFT JOIN public.units u ON v.unit_id = u.id
WHERE v.iot_notification_sent = false
  AND v.iot_notification_status = 'pending'
ORDER BY v.created_at;
```

---

### P - 包裹到件推播

**修改表**: `packages`  
**新增欄位** (6個):
```sql
ALTER TABLE public.packages ADD COLUMN iot_notification_sent boolean DEFAULT false;
ALTER TABLE public.packages ADD COLUMN iot_notification_sent_at timestamp with time zone;
ALTER TABLE public.packages ADD COLUMN iot_notification_status text;
ALTER TABLE public.packages ADD COLUMN iot_arrival_notified_at timestamp with time zone;
ALTER TABLE public.packages ADD COLUMN iot_device_id text;
ALTER TABLE public.packages ADD COLUMN iot_retry_count integer DEFAULT 0;
```

**查詢失敗包裹通知**:
```sql
SELECT p.id, p.courier, p.recipient_room, p.iot_retry_count
FROM public.packages p
WHERE p.iot_notification_status = 'failed'
  AND p.iot_retry_count >= 3
ORDER BY p.arrived_at;
```

---

### E - 緊急事件通知

**修改表**: `emergencies`, `emergency_events`  
**emergencies 新增欄位** (7個):
```sql
ALTER TABLE public.emergencies ADD COLUMN iot_notification_sent boolean DEFAULT false;
ALTER TABLE public.emergencies ADD COLUMN iot_notification_sent_at timestamp with time zone;
ALTER TABLE public.emergencies ADD COLUMN iot_notification_status text;
ALTER TABLE public.emergencies ADD COLUMN iot_event_ref_id text;
ALTER TABLE public.emergencies ADD COLUMN iot_device_id text;
ALTER TABLE public.emergencies ADD COLUMN severity_level text DEFAULT 'high'::text;
```

**emergency_events 新增欄位** (6個):
```sql
ALTER TABLE public.emergency_events ADD COLUMN event_title text;
ALTER TABLE public.emergency_events ADD COLUMN severity_level text;
ALTER TABLE public.emergency_events ADD COLUMN iot_triggered boolean DEFAULT false;
ALTER TABLE public.emergency_events ADD COLUMN iot_device_id text;
ALTER TABLE public.emergency_events ADD COLUMN location_info jsonb;
ALTER TABLE public.emergency_events ADD COLUMN response_status text;
```

**查詢未回應的critical事件**:
```sql
SELECT e.id, e.type, e.time, 
       CASE WHEN ec.id IS NULL THEN '未取消' ELSE '已取消' END as status
FROM public.emergencies e
LEFT JOIN public.emergency_cancellations ec ON e.id = ec.emergency_id
WHERE e.severity_level = 'critical' AND ec.id IS NULL
ORDER BY e.time DESC;
```

---

### C - 緊急事件取消

**新增表**: `emergency_cancellations`  
**欄位** (8個):
```sql
CREATE TABLE public.emergency_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_id uuid NOT NULL,
  cancelled_by_id uuid,
  cancelled_at timestamp with time zone DEFAULT now(),
  cancellation_reason text,
  iot_cancel_confirmation boolean DEFAULT false,
  iot_cancel_confirmed_at timestamp with time zone,
  iot_device_id text,
  created_at timestamp with time zone DEFAULT now(),
  FOREIGN KEY (emergency_id) REFERENCES public.emergencies(id),
  FOREIGN KEY (cancelled_by_id) REFERENCES public.profiles(id)
);
```

**統計誤報率**:
```sql
SELECT 
  DATE(ec.cancelled_at) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN ec.cancellation_reason = 'false_alarm' THEN 1 END) as false_alarms
FROM public.emergency_cancellations ec
WHERE ec.cancelled_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(ec.cancelled_at)
ORDER BY date DESC;
```

---

## 📊 新增表格

### `iot_devices` - IoT設備管理
| 欄位 | 類型 | 說明 |
|-----|------|------|
| id | uuid | 主鍵 |
| device_id | text | 設備唯一ID (唯一) |
| device_name | text | 易讀名稱 |
| device_type | text | doorbell/alarm/speaker/multi_function |
| location | text | 物理位置 |
| unit_id | uuid | 關聯住戶單位 |
| status | text | active/inactive/maintenance |
| battery_level | integer | 電池百分比 (0-100) |
| last_ping_at | timestamp | 最後心跳時間 |
| firmware_version | text | 固件版本 |

### `iot_command_logs` - IoT命令日誌
追蹤所有發送給Arduino的命令，用於審計和故障排除

| 欄位 | 類型 | 說明 |
|-----|------|------|
| id | uuid | 主鍵 |
| command_type | text | V/P/E/C |
| target_device_id | text | 目標設備 |
| send_status | text | pending/sent/failed/timeout |
| response_time_ms | integer | 響應時間 |
| retry_count | integer | 重試次數 |

### `iot_events` - IoT事件日誌
記錄來自Arduino設備的上報事件

| 欄位 | 類型 | 說明 |
|-----|------|------|
| id | uuid | 主鍵 |
| device_id | text | 發送設備 |
| event_type | text | visitor/package/emergency/cancel/status/error |
| event_data | jsonb | 事件詳情 |
| processed | boolean | 是否已處理 |
| linked_record_id | uuid | 關聯的業務記錄 |

---

## 🔍 提供的視圖

### `v_pending_iot_notifications`
獲取所有待發送的IoT通知（訪客、包裹、緊急事件）

```sql
SELECT * FROM public.v_pending_iot_notifications
ORDER BY triggered_at DESC;
```

### `v_iot_device_status`
IoT設備整體狀態歷覽

```sql
SELECT * FROM public.v_iot_device_status
WHERE status = 'active'
ORDER BY last_ping_at DESC;
```

---

## ⚡ 性能優化 - 新增索引

| 索引名 | 表 | 欄位 | 用途 |
|------|-----|------|------|
| `idx_visitors_iot_notification_status` | visitors | iot_notification_status, iot_notification_sent | 查詢待發送門鈴 |
| `idx_visitors_iot_device_id` | visitors | iot_device_id | 按設備查詢 |
| `idx_packages_iot_notification_status` | packages | iot_notification_status, iot_notification_sent | 查詢待發送推播 |
| `idx_packages_iot_device_id` | packages | iot_device_id, status | 按設備與狀態查詢 |
| `idx_emergencies_iot_notification_status` | emergencies | iot_notification_status, iot_triggered | 查詢緊急事件通知 |
| `idx_emergency_events_iot_triggered` | emergency_events | iot_triggered, response_status | 按事件源查詢 |
| `idx_iot_command_logs_command_type` | iot_command_logs | command_type, send_status | 命令統計 |
| `idx_iot_command_logs_related` | iot_command_logs | related_type, related_id | 按業務記錄查詢 |
| `idx_iot_events_device_id` | iot_events | device_id, event_type | 按設備和事件類型 |
| `idx_iot_events_processed` | iot_events | processed, created_at | 查詢待處理事件 |

---

## ✅ 執行前檢查清單

- [ ] 已備份Supabase數據庫
- [ ] 已在開發環境測試過腳本
- [ ] 業務部門已確認修改不影響現有功能
- [ ] 已準備好IoT設備ID列表（device_id）
- [ ] RLS (Row Level Security) 策略已考量新欄位
- [ ] 後端API已更新以利用新欄位

---

## 📝 執行步驟

### 開發環境 (推薦先執行)

```bash
# 1. 開啟 Supabase SQL 編輯器
# 2. 複製 scripts/arduino-schema-additions.sql 全文
# 3. 執行腳本
# 4. 驗證成功
```

### 生產環境

```bash
# 1. 設置maintenance window
# 2. 完整備份數據庫
# 3. 在staging環境再測一次
# 4. 執行腳本
# 5. 驗證所有功能正常
# 6. 更新API代碼以使用新欄位
# 7. 部署新版應用
```

---

## 🐛 常見問題

**Q: 可以不執行所有修改，只做訪客功能嗎？**  
A: 可以，但建議執行完整的IoT基礎建設（iot_devices, iot_command_logs, iot_events），這樣有利於未來擴展。

**Q: 執行腳本會影響現有數據嗎？**  
A: 不會。所有ALTER TABLE都使用ADD COLUMN，新欄位有適當的DEFAULT值。CREATE TABLE IF NOT EXISTS確保冪等性。

**Q: 如何回滾這些修改？**  
A: 執行 `arduino-schema-rollback.sql`（需要另外準備）或逐個DROP COLUMN。

**Q: 哪些欄位有CHECK約束？**  
A: iot_notification_status, iot_retry_count, severity_level, response_status等都有CHECK以確保數據完整性。

---

## 📞 支持

如有任何問題，請參考：
- `scripts/arduino-integration-guide.sql` - 詳細的工作流程說明
- `scripts/arduino-schema-modifications-detail.sql` - 每個欄位的精詳細說明
- 你的項目README中的Arduino IoT章節
