-- ============================================================================
-- SINAG CATERING — FULL DATABASE SCHEMA (fresh Supabase project)
-- Project Ref: lwgejivunwohzzpckwbb
-- Generated 2026-11-19. Consolidates: setup_complete.sql, schema.sql and all
-- migrations through 20261119_archive_receipt_dataurls.sql.
--
-- HOW TO USE
--   1. Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   2. Safe to run more than once.
--
-- ACCESS MODEL: matches the current browser app (anon key reads/writes the
-- tables directly). Only booking_receipt_archive and private.* are locked.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

grant usage on schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- SHARED: updated_at trigger function
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. USERS & SESSIONS
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  phone text,
  password text not null,
  role text not null default 'client' check (role in ('client', 'admin')),
  terms_accepted_at timestamptz,
  terms_version text,
  auth_provider text not null default 'email' check (auth_provider in ('email', 'google')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_sessions_user_expiry_idx
  on public.user_sessions (user_id, expires_at);

-- ----------------------------------------------------------------------------
-- 2. CATALOG: PACKAGES, ADD-ONS, MENU ITEMS
-- ----------------------------------------------------------------------------
create table if not exists public.packages (
  id text primary key,
  name text not null,
  ideal_for text,
  included_menu jsonb not null default '[]'::jsonb,
  default_pax integer not null default 50,
  price_per_head numeric,
  currency text not null default 'PHP' check (currency = 'PHP'),
  base_price numeric,
  tier_prices jsonb,                 -- [{"pax": 50, "price": 35000}, ...]
  details jsonb not null default '{}'::jsonb,  -- inclusions, entertainment, freebies...
  created_at timestamptz not null default now()
);

create table if not exists public.package_addons (
  id text primary key,
  name text not null,
  price numeric not null,
  currency text not null default 'PHP' check (currency = 'PHP'),
  rate_type text not null default 'flat' check (rate_type in ('flat', 'per_head')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  category text not null check (category in ('main', 'pasta', 'drink')),
  description text not null default '',
  image_url text,
  tag text,
  color text,
  accent_color text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists menu_items_category_active_idx
  on public.menu_items (category, active, sort_order);

-- ----------------------------------------------------------------------------
-- 3. BOOKINGS
-- ----------------------------------------------------------------------------
create table if not exists public.bookings (
  id text primary key,
  user_id text,
  customer_name text not null,
  email text not null,
  phone text not null,
  event_type text not null,
  custom_event_type text,
  event_date date not null,
  guest_count integer not null check (guest_count >= 1),
  package_name text not null,
  package_id text references public.packages(id) on delete set null,
  currency text not null default 'PHP' check (currency = 'PHP'),
  base_price numeric not null default 0,
  extra_pax_fee numeric not null default 0,
  add_ons jsonb not null default '{}'::jsonb,
  total_price numeric not null check (total_price >= 0),
  downpayment_amount numeric default 0,
  booking_status text not null default 'pending'
    check (booking_status in ('pending', 'approved', 'confirmed', 'completed', 'cancelled', 'forfeit')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending_verification', 'partially_paid', 'downpayment_paid', 'fully_paid')),
  payment_method text
    check (payment_method in ('qrph', 'gcash', 'maya', 'bank_transfer', 'paymongo')),
  gcash_ref_number text,
  proof_of_payment_url text,          -- Storage URL only (never base64 data URLs)
  staff_ids text[] default '{}'::text[],
  assigned_services text[] not null default '{}'::text[],
  notes text,
  -- Revision 6: payment terms, 48h hold, cancellation/refund, reminders
  payment_term text not null default 'downpayment'
    check (payment_term in ('full', 'downpayment', 'reserve')),
  hold_expires_at timestamptz,
  cancellation_reason text,
  cancellation_notes text,
  refund_percentage integer
    check (refund_percentage is null or refund_percentage between 0 and 100),
  refund_amount numeric,
  refund_status text not null default 'none'
    check (refund_status in ('none', 'pending', 'processed', 'not_applicable')),
  cancelled_at timestamptz,
  refund_processed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Production hardening
  constraint bookings_customer_name_not_blank check (length(btrim(customer_name)) between 1 and 120),
  constraint bookings_email_not_blank check (length(btrim(email)) between 3 and 254),
  constraint bookings_phone_not_blank check (length(btrim(phone)) between 7 and 32),
  constraint bookings_event_type_not_blank check (length(btrim(event_type)) between 1 and 100),
  constraint bookings_price_scale check (
    base_price <= 99999999.99
    and extra_pax_fee <= 99999999.99
    and total_price <= 99999999.99
    and coalesce(downpayment_amount, 0) <= total_price
  )
);

-- One active event per date (cancelled/forfeit release the date)
create unique index if not exists bookings_one_active_event_per_date_idx
  on public.bookings (event_date)
  where booking_status not in ('cancelled', 'forfeit');

create index if not exists bookings_hold_expires_at_idx
  on public.bookings (hold_expires_at)
  where payment_term = 'reserve' and booking_status = 'pending';

create index if not exists bookings_event_date_reminder_idx
  on public.bookings (event_date)
  where reminder_sent_at is null;

create index if not exists bookings_refund_status_idx
  on public.bookings (refund_status)
  where refund_status <> 'none';

-- 14-day lead time (Manila time)
create or replace function public.enforce_booking_lead_time()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.event_date < ((now() at time zone 'Asia/Manila')::date + 14) then
    raise exception 'Bookings must be scheduled at least 14 days in advance';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_lead_time_guard on public.bookings;
create trigger bookings_lead_time_guard
  before insert or update of event_date on public.bookings
  for each row execute function public.enforce_booking_lead_time();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- Private archive for old base64 receipts (kept from the egress fix)
create table if not exists public.booking_receipt_archive (
  booking_id text primary key references public.bookings(id) on delete cascade,
  data_url text not null,
  archived_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. PAYMONGO CHECKOUT SESSIONS
-- ----------------------------------------------------------------------------
create table if not exists public.paymongo_checkout_sessions (
  booking_id text primary key references public.bookings(id) on delete cascade,
  checkout_session_id text not null unique,
  checkout_url text not null,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency = 'PHP'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed')),
  payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists paymongo_checkout_sessions_set_updated_at on public.paymongo_checkout_sessions;
create trigger paymongo_checkout_sessions_set_updated_at
  before update on public.paymongo_checkout_sessions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. CALENDAR, STAFF, REVIEWS, INQUIRIES
-- ----------------------------------------------------------------------------
create table if not exists public.blocked_dates (
  date date primary key,
  reason text default 'Management reservation / inventory lock',
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text not null check (role in ('waiter', 'food_attendant')),
  status text not null default 'available' check (status in ('available', 'busy')),
  age integer check (age >= 18 and age <= 70),
  off_days text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id text primary key default ('rev-' || floor(random() * 100000)::text),
  user_name text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null,
  image_url text,
  date text not null default to_char(now(), 'YYYY-MM-DD'),
  reply text,
  created_at timestamptz not null default now()
);

create table if not exists public.catering_inquiries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  email text not null,
  phone text not null,
  event_type text not null,
  event_date date,
  guest_count integer not null check (guest_count >= 1),
  package_name text not null,
  venue_location text,
  notes text,
  replied boolean not null default false,
  reply_text text,
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'booked', 'declined')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. NOTIFICATIONS (SMS/Email audit log + in-app bell)
-- ----------------------------------------------------------------------------
create table if not exists public.notification_logs (
  id text primary key,
  type text not null check (type in ('sms', 'email')),
  recipient text not null,
  subject text,
  message text not null,
  status text not null check (status in ('sent', 'failed', 'simulated')),
  provider text not null check (provider in ('Semaphore', 'Email', 'InApp')),
  reference_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  audience text not null check (audience in ('admin', 'client')),
  user_id text,
  recipient_email text,
  booking_id text,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_audience_created_idx
  on public.notifications (audience, created_at desc);
create index if not exists notifications_recipient_email_idx
  on public.notifications (lower(recipient_email));

-- Realtime for the bell + live catalog/bookings
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'notifications', 'bookings', 'blocked_dates', 'packages',
      'menu_items', 'package_addons', 'staff', 'reviews', 'catering_inquiries'
    ]
    loop
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

-- SMS audit row when a downpayment is verified / booking confirmed
create or replace function public.on_booking_downpayment_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_id text;
begin
  if (new.payment_status = 'downpayment_paid' and (old.payment_status is distinct from 'downpayment_paid'))
     or (new.booking_status = 'confirmed' and (old.booking_status is distinct from 'confirmed')) then
    v_ref_id := coalesce(new.id, 'REF-PENDING');
    insert into public.notification_logs (id, type, recipient, subject, message, status, provider, reference_id)
    values (
      'notif-' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
      'sms',
      coalesce(new.phone, ''),
      'Downpayment Verification Alert',
      format(
        'Sinag Catering: Downpayment Verified & Booking Confirmed! Ref: #%s. Scheduled Date: %s. Your event reservation is locked in our calendar! Salamat po!',
        v_ref_id, coalesce(new.event_date::text, 'Upcoming')
      ),
      'sent', 'Semaphore', v_ref_id
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_booking_downpayment_verified_trigger on public.bookings;
create trigger on_booking_downpayment_verified_trigger
  after update on public.bookings
  for each row execute function public.on_booking_downpayment_verified();

-- ----------------------------------------------------------------------------
-- 7. AUTOMATION: expire 48-hour "Reserve Only" holds
-- ----------------------------------------------------------------------------
create or replace function public.expire_reserve_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
  rec record;
begin
  for rec in
    update public.bookings
    set booking_status = 'forfeit', updated_at = now()
    where payment_term = 'reserve'
      and booking_status = 'pending'
      and payment_status = 'unpaid'
      and hold_expires_at is not null
      and hold_expires_at < now()
    returning id, user_id, email, customer_name, event_date
  loop
    expired_count := expired_count + 1;

    insert into public.notifications (id, audience, user_id, recipient_email, booking_id, type, title, message)
    values (
      'nt-exp-c-' || rec.id, 'client', rec.user_id, rec.email, rec.id, 'hold_expired',
      'Temporary Hold Expired',
      'Your 48-hour temporary hold for booking ' || rec.id || ' on ' || rec.event_date ||
      ' expired because no payment was uploaded. The date has been released.'
    )
    on conflict (id) do nothing;

    insert into public.notifications (id, audience, booking_id, type, title, message)
    values (
      'nt-exp-a-' || rec.id, 'admin', rec.id, 'hold_expired',
      'Temporary Hold Expired',
      rec.customer_name || '''s 48-hour hold (' || rec.id || ') on ' || rec.event_date ||
      ' expired without payment and was forfeited. Date released to the calendar.'
    )
    on conflict (id) do nothing;
  end loop;

  return expired_count;
end;
$$;
grant execute on function public.expire_reserve_holds() to anon, authenticated, service_role;

-- Optional pg_cron schedule (enable pg_cron in Database → Extensions first)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sinag-expire-reserve-holds';
    perform cron.schedule('sinag-expire-reserve-holds', '*/10 * * * *', 'select public.expire_reserve_holds();');
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. EDGE FUNCTION RATE LIMITING (private schema)
-- ----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.api_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null
);
revoke all on table private.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  key_hash text,
  request_limit integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  insert into private.api_rate_limits as limits (key_hash, window_started_at, request_count)
  values (key_hash, now(), 1)
  on conflict (key_hash) do update
    set window_started_at = case
          when limits.window_started_at + make_interval(secs => window_seconds) <= now() then now()
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at + make_interval(secs => window_seconds) <= now() then 1
          else limits.request_count + 1
        end
  returning request_count into current_count;
  return current_count <= request_limit;
end;
$$;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

-- ============================================================================
-- 9. PERMISSIONS & RLS (matches how the browser app talks to the DB)
-- ============================================================================
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Catalog + notification bell: RLS off (open catalog management)
alter table public.packages disable row level security;
alter table public.package_addons disable row level security;
alter table public.menu_items disable row level security;
alter table public.notifications disable row level security;

-- Everything else: RLS on with an allow-all policy (app reads/writes with anon key)
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'user_sessions', 'bookings', 'paymongo_checkout_sessions',
    'blocked_dates', 'staff', 'reviews', 'catering_inquiries', 'notification_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Allow all on %s" on public.%I', t, t);
    execute format('create policy "Allow all on %s" on public.%I for all using (true) with check (true)', t, t);
  end loop;
end;
$$;

-- Receipt archive: RLS on, NO policies, no anon access (dashboard/service role only)
alter table public.booking_receipt_archive enable row level security;
revoke all on public.booking_receipt_archive from anon, authenticated;
grant all on public.booking_receipt_archive to service_role;

-- ============================================================================
-- 10. STORAGE BUCKET: "Files" (public)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('Files', 'Files', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow public read on Files bucket" on storage.objects;
create policy "Allow public read on Files bucket" on storage.objects
  for select using (bucket_id = 'Files' or bucket_id = 'files');

drop policy if exists "Allow upload to Files bucket" on storage.objects;
create policy "Allow upload to Files bucket" on storage.objects
  for insert with check (bucket_id = 'Files' or bucket_id = 'files');

drop policy if exists "Allow update on Files bucket" on storage.objects;
create policy "Allow update on Files bucket" on storage.objects
  for update using (bucket_id = 'Files' or bucket_id = 'files');

drop policy if exists "Allow delete on Files bucket" on storage.objects;
create policy "Allow delete on Files bucket" on storage.objects
  for delete using (bucket_id = 'Files' or bucket_id = 'files');

-- ============================================================================
-- 11. SEED DATA
-- ============================================================================

-- Admin account (change the password after first login)
insert into public.users (email, full_name, phone, password, role)
values ('admin@sinagcatering.ph', 'Executive Admin', '0928 714 4597', 'admin123', 'admin')
on conflict (email) do update set role = 'admin';

-- Real Sinag packages (from seed_sinag_packages.sql)
insert into public.packages (
  id, name, ideal_for, included_menu, default_pax, price_per_head,
  currency, base_price, tier_prices, details
)
values
  (
    'budget-basic',
    'Budgetarian Kids Party Package with Freebies',
    'Kids parties within the City of Baliwag area',
    '["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"]'::jsonb,
    50, 700, 'PHP', 35000,
    '[{"pax": 50, "price": 35000}, {"pax": 70, "price": 40000}, {"pax": 100, "price": 45000}, {"pax": 150, "price": 65000}, {"pax": 200, "price": 90000}]'::jsonb,
    '{
      "inclusions": ["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"],
      "entertainment": [],
      "freebies": ["Candy and sweet corner", "Event coordinator", "Ref magnet souvenir", "Styro name cut outs", "Lighted number standee"],
      "food_buffer_pax": 10,
      "service_area": "Within City of Baliwag area",
      "quotation_note": "Upgrades, downgrades, transport fees, crew meals, additional setup, and other miscellaneous requests require a new quotation.",
      "source_image": "packages/package_budgetarian_freebies_lower.webp",
      "image_url": "https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/packages/pkg_budget_basic.webp"
    }'::jsonb
  ),
  (
    'budget-entertainment',
    'Budgetarian Kids Party Package with Freebies and Entertainment',
    'Kids parties within the City of Baliwag area that need entertainment and photo coverage',
    '["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"]'::jsonb,
    50, 940, 'PHP', 47000,
    '[{"pax": 50, "price": 47000}, {"pax": 70, "price": 52000}, {"pax": 100, "price": 56000}, {"pax": 150, "price": 76000}, {"pax": 200, "price": 102000}]'::jsonb,
    '{
      "inclusions": ["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Stage decor and backdrop", "Entrance setup"],
      "entertainment": ["Clown / host", "Magician", "Photo booth", "Photographer", "Lights and sounds"],
      "freebies": ["Candy and sweet corner", "Event coordinator", "Ref magnet souvenir", "Styro name cut outs", "Lighted number standee"],
      "food_buffer_pax": 10,
      "service_area": "Within City of Baliwag area",
      "quotation_note": "Upgrades, downgrades, transport fees, crew meals, additional setup, and other miscellaneous requests require a new quotation.",
      "source_image": "packages/package_budgetarian_freebies.webp",
      "image_url": "https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/packages/pkg_budget_entertainment.webp"
    }'::jsonb
  ),
  (
    'full-blast',
    'Full Blast Kids Party Package with Freebies',
    'Premium kids parties within the City of Baliwag area',
    '["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Full Blast stage decor and backdrop", "Full Blast entrance setup", "Balloon ceiling"]'::jsonb,
    50, 1100, 'PHP', 55000,
    '[{"pax": 50, "price": 55000}, {"pax": 70, "price": 60000}, {"pax": 100, "price": 63000}, {"pax": 150, "price": 84000}, {"pax": 200, "price": 109000}]'::jsonb,
    '{
      "inclusions": ["4 main dishes", "Dessert and drinks", "Elegant buffet setup", "Food warmer or roll top with serving spoons", "Dinner plates, spoon and fork, glassware and pitcher", "Professional waiter services", "Fully dressed monoblock chairs", "Round tables with floor-length motif table cloth", "Decorated cake, gifts, and giveaways table", "Centerpiece for individual tables", "Ribbon for individual chairs", "Full Blast stage decor and backdrop", "Full Blast entrance setup", "Balloon ceiling"],
      "entertainment": ["Clown / host", "Magician", "Photo booth", "Photographer", "Lights and sounds"],
      "freebies": ["Candy and sweet corner", "Event coordinator", "Ref magnet souvenir", "Styro name cut outs", "Lighted number standee"],
      "food_buffer_pax": 10,
      "service_area": "Within City of Baliwag area",
      "quotation_note": "Upgrades, downgrades, transport fees, crew meals, additional setup, and other miscellaneous requests require a new quotation.",
      "source_image": "packages/package_fullblast_freebies.webp",
      "image_url": "https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/packages/pkg_full_blast.webp"
    }'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  ideal_for = excluded.ideal_for,
  included_menu = excluded.included_menu,
  default_pax = excluded.default_pax,
  price_per_head = excluded.price_per_head,
  currency = excluded.currency,
  base_price = excluded.base_price,
  tier_prices = excluded.tier_prices,
  details = excluded.details;

-- Add-ons & Per-Guest Extra Food Rates (Blue Box + Red Box in Booking Wizard)
insert into public.package_addons (id, name, price, currency, rate_type, description)
values
  ('ADD-MAIN-04', 'Extra Main Dish Course', 100, 'PHP', 'per_head', 'Additional luxury entrée selection served buffet style per guest'),
  ('ADD-PASTA-05', 'Extra Gourmet Pasta Station', 80, 'PHP', 'per_head', 'Fresh hot pasta prepared with choice of white or red sauce'),
  ('ADD-DESSERT-06', 'Extra Sweet Dessert Course', 50, 'PHP', 'per_head', 'Additional pastry or sweet treat per head'),
  ('ADD-CANDY-01', 'Chocolate Fountain & Candy Buffet', 1500, 'PHP', 'flat', 'Multi-tier Belgian chocolate fountain with marshmallows, cookies, and candy jars'),
  ('ADD-HOST-02', 'Party Emcee & Games Host', 2000, 'PHP', 'flat', 'Professional energetic host with party parlor games and sound effects'),
  ('ADD-DESSERT-03', 'Assorted Dessert Station', 1000, 'PHP', 'flat', 'Mini cupcakes, mango tartlets, chocolate mousse cups, and fruit platters')
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  currency = excluded.currency,
  rate_type = excluded.rate_type,
  description = excluded.description;

-- Menu items catalog
insert into public.menu_items (id, name, category, description, image_url, tag, color, accent_color, active, sort_order)
values
  ('menu-main-beef-broccoli', 'Beef Broccoli', 'main', 'Tender beef strips simmered in savory garlic soy sauce with crisp broccoli.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_beef_broccoli.webp', 'Signature Beef', null, null, true, 10),
  ('menu-main-cordon-bleu', 'Cordon Bleu', 'main', 'Crispy breaded chicken breast stuffed with savory ham and molten cheese.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_cordon_bleu.webp', 'Poultry Favorite', null, null, true, 20),
  ('menu-main-menudo', 'Menudo', 'main', 'Tender pork cubes and liver simmered in spiced tomato stew with vegetables.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_menudo.webp', 'Fiesta Classic', null, null, true, 30),
  ('menu-main-caldereta', 'Caldereta', 'main', 'Slow-braised beef in a rich liver-infused tomato gravy with bell peppers.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_caldereta.webp', 'Hearty Braised Beef', null, null, true, 40),
  ('menu-main-mixed-veggies', 'Mixed Veggies', 'main', 'Fresh seasonal vegetables sautéed in butter and garlic, paired with quail eggs.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_mixed_veggies_quail_egg.webp', 'Buttered Medley', null, null, true, 50),
  ('menu-main-chicken-curry', 'Chicken Curry', 'main', 'Tender chicken braised in fragrant yellow coconut curry with tender potatoes.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_chicken_curry.webp', 'Aromatic Curry', null, null, true, 60),
  ('menu-main-fish-fillet', 'Fish Fillet', 'main', 'Golden-crusted dory fish fillets served with homemade tartar dipping sauce.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_fish_fillet.webp', 'Crispy Seafood', null, null, true, 70),
  ('menu-pasta-pancit', 'Pancit', 'pasta', 'Sautéed bihon and canton noodles tossed with shredded vegetables and meat.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_pancit.webp', 'Traditional Feast', null, null, true, 10),
  ('menu-pasta-spaghetti', 'Spaghetti', 'pasta', 'Party-favorite sweet-savory ground meat sauce topped with shredded cheddar.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_spag.webp', 'Sweet-Style Pinoy', null, null, true, 20),
  ('menu-pasta-carbonara', 'Carbonara', 'pasta', 'Al dente pasta coated in luscious garlic cream with crispy smoked bacon.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/food_carbonara.webp', 'Creamy Bacon', null, null, true, 30),
  ('menu-drink-blue-lemonade', 'Blue Lemonade', 'drink', 'Vibrant chilled sweet-tangy blue lemonade garnished with fresh lemon slices and mint leaves.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/drink_blue_lemonade.webp', 'Citrus Cooler', '#0284C7', '#F0F9FF', true, 10),
  ('menu-drink-iced-tea', 'Iced Tea', 'drink', 'Crisp and refreshing house-blend sweet iced tea brewed fresh and served ice-chilled.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/drink_iced_tea.webp', 'Signature House Blend', '#D97706', '#FFFBEB', true, 20),
  ('menu-drink-cucumber', 'Cucumber', 'drink', 'Cooling cucumber-infused lemon refreshment with crisp fresh cucumber ribbon slices.', 'https://lwgejivunwohzzpckwbb.supabase.co/storage/v1/object/public/Files/menu/drink_cucumber.webp', 'Crisp Refresher', '#059669', '#ECFDF5', true, 30)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  image_url = excluded.image_url,
  tag = coalesce(excluded.tag, public.menu_items.tag),
  color = coalesce(excluded.color, public.menu_items.color),
  accent_color = coalesce(excluded.accent_color, public.menu_items.accent_color),
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Staff roster
insert into public.staff (id, name, role, status, age, off_days)
values
  ('st-1', 'Juan Dela Cruz', 'waiter', 'available', 28, array['Monday', 'Wednesday']),
  ('st-2', 'Maria Santos', 'waiter', 'available', 24, array['Tuesday']),
  ('st-3', 'Pedro Concepcion', 'waiter', 'available', 30, array['Monday', 'Thursday']),
  ('st-4', 'Carlos Perez', 'waiter', 'available', 26, array['Sunday']),
  ('st-5', 'Jose Rizal', 'waiter', 'available', 32, array['Wednesday', 'Friday']),
  ('st-6', 'Ana Kalang', 'food_attendant', 'available', 25, array['Monday']),
  ('st-7', 'Luisa Fernandez', 'food_attendant', 'available', 23, array['Thursday']),
  ('st-8', 'Rosario Mercado', 'food_attendant', 'available', 29, array['Saturday']),
  ('st-9', 'Gabriela Silang', 'food_attendant', 'available', 27, array['Tuesday', 'Friday']),
  ('st-10', 'Teresa Magbanua', 'food_attendant', 'available', 31, array['Monday', 'Sunday'])
on conflict (id) do update set
  age = excluded.age,
  off_days = excluded.off_days;

-- Holiday closure
insert into public.blocked_dates (date, reason)
values ('2026-12-25', 'Christmas Day Holiday Closure')
on conflict (date) do nothing;

-- ============================================================================
-- DONE. Quick check:
-- select table_name from information_schema.tables where table_schema = 'public' order by 1;
-- ============================================================================
