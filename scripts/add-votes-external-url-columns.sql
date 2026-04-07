-- 讓 LINE Bot 可直接從 votes 表撈外部投票連結
-- 設定超時避免無限等待鎖定（Supabase 常見問題）
set lock_timeout = '3s';
set statement_timeout = '30s';

-- 第一步：新增欄位（無 DEFAULT，PostgreSQL 11+ 只改 metadata，瞬間完成）
alter table public.votes
  add column if not exists vote_url text,
  add column if not exists form_url text;

-- 第二步：回填舊資料（分開執行，不佔鎖）
-- 只更新 options 包含 external_url 的行，避免不必要的寫入
update public.votes
set
  vote_url = (options::jsonb)->>'external_url',
  form_url = (options::jsonb)->>'external_url'
where options is not null
  and vote_url is null
  and (options::jsonb)->>'external_url' is not null;

-- 第三步：建立索引
create index if not exists votes_vote_url_idx on public.votes(vote_url)
  where vote_url is not null;
create index if not exists votes_form_url_idx on public.votes(form_url)
  where form_url is not null;
