-- ShiftReport database schema.
-- Apply with: supabase db push

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.reports (
  id bigint primary key,
  date timestamptz not null,
  worker_name text not null default '',
  dash_total numeric(12, 2) not null default 0 check (dash_total >= 0),
  dash_cash numeric(12, 2) not null default 0 check (dash_cash >= 0),
  dash_cashless numeric(12, 2) not null default 0 check (dash_cashless >= 0),
  fact_total numeric(12, 2) not null default 0 check (fact_total >= 0),
  fact_cash numeric(12, 2) not null default 0 check (fact_cash >= 0),
  fact_cashless numeric(12, 2) not null default 0 check (fact_cashless >= 0),
  two_percent numeric(12, 2) not null default 0,
  difference numeric(12, 2) not null default 0,
  expenses jsonb not null default '[]'::jsonb,
  goods_taken jsonb not null default '[]'::jsonb,
  cash_taken_items jsonb not null default '[]'::jsonb,
  cleaner_amount numeric(12, 2) not null default 0 check (cleaner_amount >= 0),
  transfers numeric(12, 2) not null default 0,
  fine jsonb,
  photo_base64 text,
  salary_paid boolean not null default false,
  shortage_amount numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_json_arrays check (
    jsonb_typeof(expenses) = 'array'
    and jsonb_typeof(goods_taken) = 'array'
    and jsonb_typeof(cash_taken_items) = 'array'
  )
);

create table if not exists public.workers (
  id bigint primary key,
  phone text,
  first_name text not null default '',
  last_name text not null default '',
  middle_name text not null default '',
  nickname text not null default '',
  role text not null default '',
  base_salary numeric(12, 2) not null default 1400 check (base_salary >= 0),
  calculate_percent boolean not null default true,
  include_in_salary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fines (
  id bigint primary key,
  worker_name text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  reason text not null default '',
  date timestamptz not null,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  show_worker boolean not null default true,
  show_dash boolean not null default true,
  show_fact boolean not null default true,
  show_goods_taken boolean not null default true,
  show_cash_taken boolean not null default true,
  show_fine boolean not null default true,
  show_other_expenses boolean not null default true,
  show_photo boolean not null default true,
  show_cleaner boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.settings (id)
values (1)
on conflict (id) do nothing;

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists workers_set_updated_at on public.workers;
create trigger workers_set_updated_at
before update on public.workers
for each row execute function public.set_updated_at();

drop trigger if exists fines_set_updated_at on public.fines;
create trigger fines_set_updated_at
before update on public.fines
for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

create index if not exists reports_created_at_idx
  on public.reports (created_at desc);
create index if not exists reports_worker_date_idx
  on public.reports (worker_name, date desc);
create index if not exists reports_unpaid_idx
  on public.reports (created_at desc)
  where salary_paid = false;
create index if not exists fines_unpaid_worker_idx
  on public.fines (worker_name, created_at desc)
  where paid = false;
create index if not exists fines_unpaid_idx
  on public.fines (created_at desc)
  where paid = false;

-- RLS is enabled from the first migration. The application currently uses
-- SmartShell credentials rather than Supabase Auth, so the compatibility
-- policies below are intentionally temporary. Replace them with policies based
-- on auth.uid() before exposing sensitive data in production.
alter table public.reports enable row level security;
alter table public.workers enable row level security;
alter table public.fines enable row level security;
alter table public.settings enable row level security;

drop policy if exists reports_client_compatibility on public.reports;
create policy reports_client_compatibility on public.reports
  for all to anon, authenticated using (true) with check (true);

drop policy if exists workers_client_compatibility on public.workers;
create policy workers_client_compatibility on public.workers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists fines_client_compatibility on public.fines;
create policy fines_client_compatibility on public.fines
  for all to anon, authenticated using (true) with check (true);

drop policy if exists settings_client_compatibility on public.settings;
create policy settings_client_compatibility on public.settings
  for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.reports, public.workers, public.fines, public.settings
  to anon, authenticated;
