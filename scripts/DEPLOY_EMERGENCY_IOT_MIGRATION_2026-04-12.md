# Emergency/IoT 正規化部署順序（2026-04-12）

## 目標
- Canonical 緊急事件來源統一為 `public.emergency_incidents`
- IoT webhook ingestion 統一為 `public.iot_events`
- API 不再接受 `iot_action_logs` 作為 webhook 事件來源

## 先決條件
- 已備份資料庫
- 已確認生產環境具有 `SUPABASE_SERVICE_ROLE_KEY`、`IOT_WEBHOOK_SECRET`
- 已確認 webhook 發送端可改送到 `iot_events` 事件格式

## 部署順序
1. 先部署 DB migration：
   - 執行 [scripts/normalize-emergency-iot-2026-04-12.sql](scripts/normalize-emergency-iot-2026-04-12.sql)
2. 驗證資料表存在：
   - `public.emergency_incidents`
   - `public.iot_events`
   - `public.iot_command_logs`
3. 再部署 API 程式：
   - [app/api/emergency-notify/route.ts](app/api/emergency-notify/route.ts)
   - [app/api/iot-emergency-webhook/route.js](app/api/iot-emergency-webhook/route.js)
   - [features/emergencies/api/emergencies.ts](features/emergencies/api/emergencies.ts)
4. 切換 webhook 上游：
   - 僅送 `INSERT` 到 `iot_events`
   - 不再送 `iot_action_logs`
5. 上線後驗證：
   - 觸發一筆 emergency 事件，確認 `emergency_incidents` 有新增
   - 確認 `iot_events.processed=true`、`linked_record_id` 已回填
   - 確認 `iot_command_logs` 有命令發送記錄

## 風險與回滾
- 風險：若上游仍送 `iot_action_logs`，webhook 會回 400。
- 臨時回滾：
  - 回退 [app/api/iot-emergency-webhook/route.js](app/api/iot-emergency-webhook/route.js) 到支援雙來源版本
  - DB migration 可保留，不需回退（為向前相容）

## 停用策略
- `iot_action_logs` 視為遺留來源，建議標示為 deprecated。
- 新功能一律基於 `iot_events` + `emergency_incidents`。
