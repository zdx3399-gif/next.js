-- Normalize finance categories, IoT device locations, and points balance sync
-- Date: 2026-04-12
-- Scope: non-chat schema hardening
-- NOTE: idempotent and safe to re-run.

begin;

-- -----------------------------------------------------------------------------
-- A. Finance expense category dictionary
-- -----------------------------------------------------------------------------

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

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  category_code text not null unique,
  category_name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_expense_categories_name_ci
  on public.expense_categories (lower(trim(category_name)));

insert into public.expense_categories (category_code, category_name, sort_order)
values
  ('maintenance', '維護費', 10),
  ('cleaning', '清潔費', 20),
  ('staff', '人事費', 30),
  ('admin', '行政費', 40),
  ('other', '其他', 99)
on conflict (category_code) do update
set
  category_name = excluded.category_name,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.finance_expenses
  add column if not exists category_id uuid;

-- Backfill dictionary rows from existing free-text categories.
insert into public.expense_categories (category_code, category_name, sort_order)
select
  'legacy-' || substr(md5(lower(trim(fe.category))), 1, 12) as category_code,
  trim(fe.category) as category_name,
  200
from public.finance_expenses fe
where nullif(trim(fe.category), '') is not null
  and not exists (
    select 1
    from public.expense_categories ec
    where lower(trim(ec.category_name)) = lower(trim(fe.category))
  )
group by trim(fe.category)
on conflict (category_code) do nothing;

update public.finance_expenses fe
set category_id = ec.id,
    category = ec.category_name
from public.expense_categories ec
where nullif(trim(fe.category), '') is not null
  and lower(trim(ec.category_name)) = lower(trim(fe.category))
  and (fe.category_id is null or fe.category <> ec.category_name);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'finance_expenses'
      and constraint_name = 'finance_expenses_category_id_fkey'
  ) then
    alter table public.finance_expenses
      add constraint finance_expenses_category_id_fkey
      foreign key (category_id)
      references public.expense_categories(id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

create index if not exists idx_finance_expenses_category_id
  on public.finance_expenses(category_id);

create or replace function public.set_expense_category_consistency()
returns trigger
language plpgsql
as $$
declare
  resolved_id uuid;
  resolved_name text;
begin
  if new.category_id is not null then
    select id, category_name
      into resolved_id, resolved_name
    from public.expense_categories
    where id = new.category_id;

    if resolved_id is null then
      raise exception 'Invalid category_id: %', new.category_id;
    end if;

    new.category := resolved_name;
    return new;
  end if;

  if nullif(trim(new.category), '') is null then
    raise exception 'category is required';
  end if;

  select id, category_name
    into resolved_id, resolved_name
  from public.expense_categories
  where lower(trim(category_name)) = lower(trim(new.category))
  limit 1;

  if resolved_id is null then
    insert into public.expense_categories (category_code, category_name, sort_order)
    values (
      'legacy-' || substr(md5(lower(trim(new.category))), 1, 12),
      trim(new.category),
      200
    )
    on conflict (category_code) do update
      set category_name = excluded.category_name,
          updated_at = now()
    returning id, category_name into resolved_id, resolved_name;
  end if;

  new.category_id := resolved_id;
  new.category := resolved_name;
  return new;
end;
$$;

drop trigger if exists trg_finance_expenses_category_consistency on public.finance_expenses;
create trigger trg_finance_expenses_category_consistency
before insert or update of category, category_id on public.finance_expenses
for each row
execute function public.set_expense_category_consistency();

-- -----------------------------------------------------------------------------
-- B. IoT device location dictionary (non-breaking)
-- -----------------------------------------------------------------------------

create table if not exists public.iot_locations (
  id uuid primary key default gen_random_uuid(),
  location_code text not null unique,
  location_name text not null,
  location_type text not null check (location_type in ('public_area', 'unit', 'other')),
  unit_id uuid references public.units(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_iot_locations_name_ci
  on public.iot_locations (lower(trim(location_name)));

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'iot_devices'
  ) then
    alter table public.iot_devices
      add column if not exists location_id uuid;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'iot_devices'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'iot_devices'
        and constraint_name = 'iot_devices_location_id_fkey'
    ) then
      alter table public.iot_devices
        add constraint iot_devices_location_id_fkey
        foreign key (location_id)
        references public.iot_locations(id)
        on update cascade
        on delete set null;
    end if;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'iot_devices'
  ) then
    create index if not exists idx_iot_devices_location_id
      on public.iot_devices(location_id);
  end if;
end
$$;

-- Unit-bound devices -> canonical unit location.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'iot_devices'
  ) then
    insert into public.iot_locations (location_code, location_name, location_type, unit_id, sort_order)
    select
      'unit-' || u.id::text as location_code,
      coalesce(nullif(trim(u.unit_code), ''), '住戶單位') as location_name,
      'unit' as location_type,
      u.id as unit_id,
      100
    from public.units u
    where exists (
      select 1 from public.iot_devices d where d.unit_id = u.id
    )
    on conflict (location_code) do update
    set
      location_name = excluded.location_name,
      updated_at = now();

    update public.iot_devices d
    set location_id = il.id
    from public.iot_locations il
    where d.unit_id is not null
      and il.location_code = 'unit-' || d.unit_id::text
      and d.location_id is null;

    -- Free-text public locations -> dictionary rows.
    insert into public.iot_locations (location_code, location_name, location_type, sort_order)
    select
      'legacy-' || substr(md5(lower(trim(d.location))), 1, 12) as location_code,
      trim(d.location) as location_name,
      'public_area' as location_type,
      200
    from public.iot_devices d
    where nullif(trim(d.location), '') is not null
      and d.location_id is null
    group by trim(d.location)
    on conflict (location_code) do nothing;

    update public.iot_devices d
    set location_id = il.id
    from public.iot_locations il
    where d.location_id is null
      and nullif(trim(d.location), '') is not null
      and lower(trim(il.location_name)) = lower(trim(d.location));

    create or replace view public.v_iot_devices_with_location as
    select
      d.*,
      il.location_code,
      il.location_name,
      il.location_type,
      il.unit_id as location_unit_id
    from public.iot_devices d
    left join public.iot_locations il on il.id = d.location_id;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- C. Points balance synchronization by trigger
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'points_transactions'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'points_transactions'
      and column_name = 'user_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'points_transactions'
      and column_name = 'amount'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'points_balance'
  ) then
    create or replace function public.sync_profile_points_balance_from_transactions()
    returns trigger
    language plpgsql
    as $sync$
    declare
      target_user_id uuid;
    begin
      target_user_id := coalesce(new.user_id, old.user_id);
      if target_user_id is null then
        return coalesce(new, old);
      end if;

      update public.profiles p
      set points_balance = coalesce(tx.total_amount, 0)
      from (
        select sum(pt.amount) as total_amount
        from public.points_transactions pt
        where pt.user_id = target_user_id
      ) tx
      where p.id = target_user_id;

      return coalesce(new, old);
    end;
    $sync$;

    drop trigger if exists trg_sync_profile_points_balance_from_transactions on public.points_transactions;
    create trigger trg_sync_profile_points_balance_from_transactions
    after insert or update of user_id, amount or delete on public.points_transactions
    for each row
    execute function public.sync_profile_points_balance_from_transactions();

    -- One-time backfill for users who already have transaction history.
    update public.profiles p
    set points_balance = tx.total_amount
    from (
      select user_id, sum(amount) as total_amount
      from public.points_transactions
      group by user_id
    ) tx
    where p.id = tx.user_id;
  end if;
end
$$;

commit;
