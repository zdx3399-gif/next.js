-- 新增 profiles 的緊急聯絡人欄位（支援個人資料/註冊/住戶管理）
set lock_timeout = '3s';
set statement_timeout = '30s';

alter table public.profiles
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text;

create index if not exists profiles_emergency_contact_phone_idx
  on public.profiles (emergency_contact_phone)
  where emergency_contact_phone is not null;
