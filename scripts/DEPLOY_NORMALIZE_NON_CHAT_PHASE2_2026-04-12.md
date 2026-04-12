# Non-chat 正規化（Phase 2）部署說明

對應腳本：`scripts/normalize-non-chat-phase2-2026-04-12.sql`

## 變更內容

1. 緊急事件 canonical 保護
- 確保 `emergency_incidents(source_record_id)` 在 `source='system'` 下唯一。
- 將遺漏的 `emergencies` 資料補回 `emergency_incidents`。

2. 投票選項正規化
- 新增 `vote_options` 子表（`vote_id` + `option_key` + `option_label` + `display_order`）。
- 唯一鍵只限制 `vote_id + option_key`，避免舊資料若有重複 label 時 migration 失敗。
- 從 `votes.options` 回填既有資料。
- 建立 trigger：當 `votes.options` 變更時同步更新 `vote_options`。
- 新增 read view：`v_votes_with_options`（提供 `normalized_options`）。
- 應用層已啟用相容 dual-write/read-fallback：可分批部署，不需停機切換。

## 執行方式

1. 先在測試環境執行：
```sql
\i scripts/normalize-non-chat-phase2-2026-04-12.sql
```

2. 驗證資料：
```sql
select count(*) from public.vote_options;
select id, options from public.votes limit 5;
select vote_id, option_key, option_label, display_order from public.vote_options order by vote_id, display_order limit 20;
```

3. 驗證 trigger：
- 新增或更新一筆 `votes.options` 後，確認 `vote_options` 同步更新。

4. 驗證 API 讀取切換：
- `GET /api/votes` 會優先讀 `v_votes_with_options`。
- 若 view 尚未可用，會自動回退讀 `votes`（相容保護）。

## 回滾建議

若需回滾：
1. `drop trigger if exists trg_sync_vote_options_from_votes on public.votes;`
2. `drop function if exists public.sync_vote_options_from_votes();`
3. `drop view if exists public.v_votes_with_options;`
4. 依需求保留或移除 `vote_options`。

## 注意事項

- 此腳本為「非破壞式」：不會移除既有 `votes.options`，現有程式可繼續運作。
- 後續應逐步把程式讀取改到 `vote_options` / `v_votes_with_options`，再評估淘汰 `votes.options`。

## 目前最終狀態（本次已完成）

- API 讀取：優先 `v_votes_with_options`，回退 `votes`。
- API 寫入：維持 `votes.options` 並同步 `vote_options`（dual-write）。
- 前端讀取：支援 `normalized_options` 與舊 `options` 格式。
