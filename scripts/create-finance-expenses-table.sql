-- Shared community expense table for resident/admin finance pages
create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  item text not null,
  category text not null,
  amount numeric not null default 0,
  vendor text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_expenses_date on public.finance_expenses(date desc);
create index if not exists idx_finance_expenses_category on public.finance_expenses(category);

create or replace function public.set_finance_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_finance_expenses_updated_at on public.finance_expenses;
create trigger trg_finance_expenses_updated_at
before update on public.finance_expenses
for each row
execute function public.set_finance_expenses_updated_at();
