# Finance / IoT / Points 正規化部署說明

對應腳本：[scripts/normalize-finance-iot-points-2026-04-12.sql](scripts/normalize-finance-iot-points-2026-04-12.sql)

## 本次做了什麼

1. 財務支出分類正規化
- 新增 `expense_categories` 主檔。
- `finance_expenses` 新增 `category_id`（FK）。
- 既有 `category` 文字資料會自動回填到主檔，並同步寫入 `category_id`。
- 新增 trigger 保持 `category` / `category_id` 一致。

2. IoT 設備位置正規化（非破壞）
- 新增 `iot_locations` 主檔。
- `iot_devices` 新增 `location_id`（FK），保留舊 `location` 文字欄位。
- 自動將 `unit_id` 與既有 `location` 文字回填到 `iot_locations`。
- 新增 `v_iot_devices_with_location` 方便查詢。

3. 點數餘額同步（受控冗餘）
- 新增 `points_transactions` -> `profiles.points_balance` 同步 trigger。
- 當交易 INSERT/UPDATE/DELETE 時，自動重算該 user 餘額。
- 會執行一次既有交易資料的 backfill（只覆蓋有交易紀錄的使用者）。

## 執行前

1. 先做 DB snapshot / backup。
2. 建議先在 staging 演練。

## 執行方式

```sql
\i scripts/normalize-finance-iot-points-2026-04-12.sql
```

## 驗證 SQL

```sql
-- 1) expense categories
select id, category_code, category_name
from public.expense_categories
order by sort_order, category_name;

select id, category, category_id
from public.finance_expenses
order by date desc
limit 20;

-- 2) iot location dictionary
select id, location_code, location_name, location_type, unit_id
from public.iot_locations
order by location_type, location_name;

select id, device_id, location, location_id
from public.iot_devices
order by created_at desc
limit 20;

-- 3) points trigger
select tgname
from pg_trigger
where tgname = 'trg_sync_profile_points_balance_from_transactions';

-- 取一位有交易的 user 測試
select p.id, p.points_balance,
       (select coalesce(sum(pt.amount),0) from public.points_transactions pt where pt.user_id = p.id) as tx_sum
from public.profiles p
where exists (select 1 from public.points_transactions t where t.user_id = p.id)
limit 10;
```
