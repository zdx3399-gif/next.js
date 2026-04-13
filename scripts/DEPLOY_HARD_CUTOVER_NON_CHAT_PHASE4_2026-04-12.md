# Non-chat Hard Cutover（Phase 4）部署說明

對應腳本：[scripts/hard-cutover-non-chat-phase4-2026-04-12.sql](scripts/hard-cutover-non-chat-phase4-2026-04-12.sql)

## 目標

1. 投票正式移除 `votes.options`（legacy JSONB）。
2. 緊急事件正式退場 legacy base table `emergencies`。
3. 保留相容讀取 view，降低切換風險。

## 會做的事情

1. 投票
- 新增 `votes.result_file_url/result_file_name/result_uploaded_at`（若不存在）。
- 從 legacy `votes.options`（object）回填結果檔 metadata。
- 重建 `v_votes_with_options` view。
- 移除 `trg_sync_vote_options_from_votes` 與 `sync_vote_options_from_votes()`。
- 先移除舊相容 view `votes_view`（若存在，且仍依賴 `votes.options`）。
- 移除 `votes.options` 欄位。
- 先移除舊相容 view `vote_records_view`（若存在，且仍依賴 `vote_records.option_selected`）。
- 將 `vote_records.option_selected` 由文字轉為 `uuid`，並建立外鍵到 `vote_options(id)`。

2. 緊急事件
- 將 legacy base table 改名為 `emergencies_legacy_archive_20260412`。
- 建立 `public.emergencies` 相容 view（來源為 `emergency_incidents` 的 system 資料）。

3. 完整性索引
- `uq_vote_records_vote_user`
- `ux_announcement_reads_announcement_user`
- `ux_emergency_incidents_source_record_id_system`

## 執行前必做

1. 做 DB snapshot / backup。
2. 確認應用程式已在 phase2/phase3 模式可穩定運行。
3. 建議先在 staging 演練。

## 執行方式

```sql
\i scripts/hard-cutover-non-chat-phase4-2026-04-12.sql
```

## 執行後驗證

```sql
-- votes.options 已移除
select column_name
from information_schema.columns
where table_schema='public' and table_name='votes' and column_name='options';

-- vote_records.option_selected 型別為 uuid，且已建立 FK
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='vote_records' and column_name='option_selected';

select constraint_name
from information_schema.table_constraints
where table_schema='public' and table_name='vote_records' and constraint_name='vote_records_option_fkey';

-- 緊急事件 legacy base table 已改名，emergencies 為 view
select table_name, table_type
from information_schema.tables
where table_schema='public'
  and table_name in ('emergencies', 'emergencies_legacy_archive_20260412');

-- 讀模型正常
select id, title, normalized_options, result_file_url
from public.v_votes_with_options
order by created_at desc
limit 10;
```

## 回滾策略

1. 快速回滾（結構層）
- 還原資料庫 snapshot。

2. 手動回滾（不建議，且不完整）
- 重新建立 `votes.options` 並回填（需另寫回填腳本）。
- 將 `emergencies_legacy_archive_20260412` rename 回 `emergencies`。

> 此階段屬 hard-cutover，建議以備份還原作為主要回滾手段。
