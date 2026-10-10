-- ============================================================================
-- SINAG CATERING SERVICES — SUPABASE SETUP & PERMISSIONS
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/wldhvmbcvjbnwkgiafpg/sql)
-- ============================================================================

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";

-- 2. Grant schema usage to PostgREST roles
grant usage on schema public to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. USERS TABLE (Plaintext passwords as requested)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  phone text,
  password text not null,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure admin user exists
insert into public.users (email, full_name, phone, password, role)
values ('admin@sinagcatering.ph', 'Executive Admin', '0928 714 4597', 'admin123', 'admin')
on conflict (email) do update set role = 'admin', password = excluded.password;

-- ----------------------------------------------------------------------------
-- 4. PACKAGES & ADDONS
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
  tier_prices jsonb,
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

-- Seed Authentic Sinag Packages
insert into public.packages (id, name, ideal_for, included_menu, default_pax, price_per_head, currency, base_price, tier_prices)
values
  (
    'budget-basic',
    'Budgetarian Kids Party Package',
    'Simple kids birthdays with full food and party setup',
    '["Sinag Fried Chicken", "Creamy Carbonara", "Sweet Style Spaghetti", "Pork Lumpia Shanghai", "Chilled Juice & Ice Cream"]'::jsonb,
    50,
    700,
    'PHP',
    35000,
    '[{"pax": 50, "price": 35000}, {"pax": 70, "price": 40000}, {"pax": 100, "price": 45000}, {"pax": 150, "price": 65000}, {"pax": 200, "price": 90000}]'::jsonb
  ),
  (
    'budget-entertainment',
    'Budgetarian Kids Party Package with Freebies',
    'Kids parties that need entertainers, clown, magician and photo coverage',
    '["Sinag Fried Chicken", "Beef Caldereta", "Baked Macaroni", "Pork BBQ Skewers", "Dessert Station & Drinks"]'::jsonb,
    50,
    940,
    'PHP',
    47000,
    '[{"pax": 50, "price": 47000}, {"pax": 70, "price": 52000}, {"pax": 100, "price": 56000}, {"pax": 150, "price": 76000}, {"pax": 200, "price": 102000}]'::jsonb
  ),
  (
    'full-blast',
    'Full Blast Kids Party Package with Freebies',
    'Premium children parties with stage, ceiling balloons, and complete entertainment',
    '["Slow-Roasted Beef with Mushroom", "Cordon Bleu", "Creamy Fettuccine", "Chicken Lollipop", "Chocolate Fountain & Dessert Bar"]'::jsonb,
    50,
    1100,
    'PHP',
    55000,
    '[{"pax": 50, "price": 55000}, {"pax": 70, "price": 60000}, {"pax": 100, "price": 63000}, {"pax": 150, "price": 84000}, {"pax": 200, "price": 109000}]'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  ideal_for = excluded.ideal_for,
  included_menu = excluded.included_menu,
  default_pax = excluded.default_pax,
  price_per_head = excluded.price_per_head,
  currency = excluded.currency,
  base_price = excluded.base_price,
  tier_prices = excluded.tier_prices;

-- Clean out outdated placeholder packages
delete from public.packages where id in ('PKG-KIDDIE-01', 'PKG-CLASSIC-02', 'PKG-PREMIER-03');

-- Seed Addons
insert into public.package_addons (id, name, price, currency, rate_type, description)
values
  ('ADD-CANDY-01', 'Chocolate Fountain & Candy Buffet', 150, 'PHP', 'flat', 'Multi-tier Belgian chocolate fountain with marshmallows, cookies, and candy jars'),
  ('ADD-HOST-02', 'Party Emcee & Games Host', 200, 'PHP', 'flat', 'Professional energetic host with party parlor games and sound effects'),
  ('ADD-DESSERT-03', 'Assorted Dessert Station', 100, 'PHP', 'flat', 'Mini cupcakes, mango tartlets, chocolate mousse cups, and fruit platters'),
  ('ADD-MAIN-04', 'Extra Main Dish Course', 100, 'PHP', 'per_head', 'Additional luxury entrée selection served buffet style per guest'),
  ('ADD-PASTA-05', 'Extra Gourmet Pasta Station', 80, 'PHP', 'per_head', 'Fresh hot pasta prepared with choice of white or red sauce'),
  ('ADD-DESSERT-06', 'Extra Sweet Dessert Course', 50, 'PHP', 'per_head', 'Additional pastry or sweet treat per head')
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  currency = excluded.currency,
  rate_type = excluded.rate_type,
  description = excluded.description;

-- ----------------------------------------------------------------------------
-- 5. BOOKINGS TABLE
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
  booking_status text not null default 'pending' check (booking_status in ('pending', 'approved', 'confirmed', 'cancelled', 'forfeit')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending_verification', 'partially_paid', 'downpayment_paid', 'fully_paid')),
  payment_method text check (payment_method in ('qrph', 'gcash', 'maya', 'bank_transfer', 'paymongo')),
  gcash_ref_number text,
  proof_of_payment_url text,
  staff_ids text[] default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. BLOCKED DATES, STAFF, REVIEWS, INQUIRIES, LOGS
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

create table if not exists public.notification_logs (
  id text primary key,
  type text not null check (type in ('sms', 'email')),
  recipient text not null,
  subject text,
  message text not null,
  status text not null check (status in ('sent', 'failed', 'simulated')),
  provider text not null check (provider in ('Semaphore', 'Email')),
  reference_id text,
  created_at timestamptz not null default now()
);

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

-- Seed Staff
insert into public.staff (id, name, role, status)
values
  ('st-1', 'Juan Dela Cruz', 'waiter', 'available'),
  ('st-2', 'Maria Santos', 'waiter', 'available'),
  ('st-3', 'Pedro Concepcion', 'waiter', 'available'),
  ('st-4', 'Carlos Perez', 'waiter', 'available'),
  ('st-5', 'Jose Rizal', 'waiter', 'available'),
  ('st-6', 'Ana Kalang', 'food_attendant', 'available'),
  ('st-7', 'Luisa Fernandez', 'food_attendant', 'available'),
  ('st-8', 'Rosario Mercado', 'food_attendant', 'available'),
  ('st-9', 'Gabriela Silang', 'food_attendant', 'available'),
  ('st-10', 'Teresa Magbanua', 'food_attendant', 'available')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. GRANT PERMISSIONS TO POSTGREST ROLES (Fixes 42501 permission denied)
-- ----------------------------------------------------------------------------
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
alter table public.packages enable row level security;
alter table public.package_addons enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.staff enable row level security;
alter table public.reviews enable row level security;
alter table public.catering_inquiries enable row level security;
alter table public.notification_logs enable row level security;
alter table public.paymongo_checkout_sessions enable row level security;
alter table public.users enable row level security;

-- Packages & Addons: Public read
drop policy if exists "Allow public read on packages" on public.packages;
create policy "Allow public read on packages" on public.packages for select using (true);

drop policy if exists "Allow public read on addons" on public.package_addons;
create policy "Allow public read on addons" on public.package_addons for select using (true);

-- Blocked Dates: Public read, all for updates
drop policy if exists "Allow public read on blocked_dates" on public.blocked_dates;
create policy "Allow public read on blocked_dates" on public.blocked_dates for select using (true);
drop policy if exists "Allow all on blocked_dates" on public.blocked_dates;
create policy "Allow all on blocked_dates" on public.blocked_dates for all using (true) with check (true);

-- Staff: Public read, all for updates
drop policy if exists "Allow public read on staff" on public.staff;
create policy "Allow public read on staff" on public.staff for select using (true);
drop policy if exists "Allow all on staff" on public.staff;
create policy "Allow all on staff" on public.staff for all using (true) with check (true);

-- Reviews: Public read & insert & manage
drop policy if exists "Allow public read on reviews" on public.reviews;
create policy "Allow public read on reviews" on public.reviews for select using (true);
drop policy if exists "Allow insert on reviews" on public.reviews;
create policy "Allow insert on reviews" on public.reviews for insert with check (true);
drop policy if exists "Allow update delete on reviews" on public.reviews;
create policy "Allow update delete on reviews" on public.reviews for all using (true) with check (true);

-- Inquiries: Anyone insert, anyone read/manage
drop policy if exists "Allow insert on catering_inquiries" on public.catering_inquiries;
create policy "Allow insert on catering_inquiries" on public.catering_inquiries for insert with check (true);
drop policy if exists "Allow all on catering_inquiries" on public.catering_inquiries;
create policy "Allow all on catering_inquiries" on public.catering_inquiries for all using (true) with check (true);

-- Bookings: Anyone can insert bookings; anyone can read and update bookings
drop policy if exists "Allow anyone to create bookings" on public.bookings;
drop policy if exists "Allow all on bookings" on public.bookings;
create policy "Allow all on bookings" on public.bookings for all using (true) with check (true);

-- Notification logs: Anyone insert, anyone read
drop policy if exists "Allow all on notification_logs" on public.notification_logs;
create policy "Allow all on notification_logs" on public.notification_logs for all using (true) with check (true);

-- PayMongo checkout sessions: Anyone can read & manage
drop policy if exists "Allow all on paymongo_checkout_sessions" on public.paymongo_checkout_sessions;
create policy "Allow all on paymongo_checkout_sessions" on public.paymongo_checkout_sessions for all using (true) with check (true);

-- Users: Allow read and insert for authentication (plaintext password matching)
drop policy if exists "Allow all on users" on public.users;
create policy "Allow all on users" on public.users for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 9. AUTHENTICATION RPC FUNCTIONS (Plaintext as requested)
-- ----------------------------------------------------------------------------
create or replace function public.auth_sign_in(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  found_user record;
begin
  select id, email, full_name, phone, role
  into found_user
  from public.users
  where lower(trim(email)) = lower(trim(p_email))
    and password = p_password
  limit 1;

  if found_user.id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid email or password');
  end if;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', found_user.id::text,
      'email', found_user.email,
      'name', found_user.full_name,
      'phone', found_user.phone,
      'role', found_user.role
    )
  );
end;
$$;

create or replace function public.auth_sign_up(p_name text, p_email text, p_phone text, p_password text)
returns jsonb
language plpgsql
security definer
as $$
declare
  new_id uuid;
  assigned_role text := 'client';
begin
  if lower(trim(p_email)) like '%admin%' then
    assigned_role := 'admin';
  end if;

  insert into public.users (full_name, email, phone, password, role)
  values (trim(p_name), lower(trim(p_email)), trim(p_phone), p_password, assigned_role)
  returning id into new_id;

  return jsonb_build_object(
    'success', true,
    'user', jsonb_build_object(
      'id', new_id::text,
      'email', lower(trim(p_email)),
      'name', trim(p_name),
      'phone', trim(p_phone),
      'role', assigned_role
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'An account with this email already exists.');
end;
$$;

grant execute on function public.auth_sign_in(text, text) to anon, authenticated, service_role;
grant execute on function public.auth_sign_up(text, text, text, text) to anon, authenticated, service_role;
