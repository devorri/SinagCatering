-- Business Settings: one row holding every admin-editable business rule
-- (contact details, payment accounts, pricing rules, policies, terms).
-- Run this once in Supabase → SQL Editor.

create table if not exists public.business_settings (
  id integer primary key default 1 check (id = 1),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id, settings)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.business_settings enable row level security;

-- Same access model as the rest of this project's tables (the app's own
-- login, not Supabase Auth, decides who sees the admin screens).
drop policy if exists "Allow all on business_settings" on public.business_settings;
create policy "Allow all on business_settings" on public.business_settings
  for all using (true) with check (true);

-- Live updates to every open browser
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'business_settings'
     ) then
    alter publication supabase_realtime add table public.business_settings;
  end if;
end;
$$;

-- Also make sure the catalog tables stream live changes
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['packages', 'menu_items', 'package_addons', 'blocked_dates', 'bookings'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- Tier prices are the source of truth; clear the old per-head override.
update public.packages
set price_per_head = null
where jsonb_typeof(tier_prices) = 'array' and jsonb_array_length(tier_prices) > 0;
