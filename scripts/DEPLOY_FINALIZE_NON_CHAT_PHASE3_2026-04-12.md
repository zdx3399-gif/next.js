# Non-chat 正規化收尾（Phase 3）部署說明

對應腳本：[scripts/finalize-non-chat-phase3-2026-04-12.sql](scripts/finalize-non-chat-phase3-2026-04-12.sql)

## 目的

1. 補齊資料完整性約束（去重 + unique index）。
2. 確保 emergency 系統來源資料以 `emergency_incidents` 為正典。
3. 維持相容運行，不直接破壞現有 API。
4. 預留 hard-cutover 的人工步驟（不自動執行）。

## 會做的事

1. `announcement_reads`：
- 先去除 `(announcement_id, user_id)` 重複資料（保留最新一筆）。
- 建立唯一索引 `ux_announcement_reads_announcement_user`。

2. `vote_records`：
- 先去除 `(vote_id, user_id)` 重複資料（保留最新一筆）。
- 建立唯一索引 `uq_vote_records_vote_user`。

3. emergency 正典一致性：
- 確保 `ux_emergency_incidents_source_record_id_system` 存在。
- 將 `emergencies` 尚未映射資料補回 `emergency_incidents`。
- 建立相容讀取 view：`v_emergencies_from_incidents`。

4. vote 正規化讀模型：
- 重新建立/刷新 `v_votes_with_options`。

## 執行方式

```sql
\i scripts/finalize-non-chat-phase3-2026-04-12.sql
```

## 驗證 SQL

```sql
-- 1) 唯一性驗證
select announcement_id, user_id, count(*)
from public.announcement_reads
group by announcement_id, user_id
having count(*) > 1;

select vote_id, user_id, count(*)
from public.vote_records
group by vote_id, user_id
having count(*) > 1;

-- 2) emergency legacy 對應是否有缺口
select count(*) as missing_mapping
from public.emergencies e
where not exists (
  select 1 from public.emergency_incidents ei
  where ei.source = 'system' and ei.source_record_id = e.id
);

-- 3) vote options 讀模型
select id, title, normalized_options
from public.v_votes_with_options
order by created_at desc
limit 10;
```

## 是否已「完全正規化（不含 chat）」

此階段完成後，屬於「可上線收尾版」，但仍保留相容欄位/表（例如 `votes.options`、`emergencies`）。
若要嚴格完全正規化，需在後續 hard-cutover 視窗執行 legacy 退場（腳本內為註解手動步驟）。

## 回滾建議

1. 保守回滾：保留新索引與 view，不影響既有功能。
2. 若需還原：
- `drop index if exists ux_announcement_reads_announcement_user;`
- `drop index if exists uq_vote_records_vote_user;`
- `drop view if exists public.v_emergencies_from_incidents;`
- `drop view if exists public.v_votes_with_options;`

注意：去重刪除屬資料變更，無法用 `drop` 還原，若需完整回復請用備份/時間點還原。
