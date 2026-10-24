-- ============================================================================
-- SINAG CATERING SERVICES — SUPABASE PRODUCTION DATABASE SCHEMA
-- Project Reference: wldhvmbcvjbnwkgiafpg
-- Description: Complete schema for packages, bookings, blocked dates, staff,
--              reviews, inquiries, and notification audit logs with RLS policies.
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Application-owned account records; account access is restricted to the table-auth Edge Function.
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

alter table public.users enable row level security;
alter table public.user_sessions enable row level security;
revoke all on public.users, public.user_sessions from public, anon, authenticated;
grant all on public.users, public.user_sessions to service_role;

-- ----------------------------------------------------------------------------
-- 1. CATERING PACKAGES & AI RECOMMENDATION CATALOG
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
  tier_prices jsonb, -- [{pax: 50, price: 35000}, ...]
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.packages
  add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.packages
  add column if not exists currency text not null default 'PHP' check (currency = 'PHP');
alter table public.packages drop constraint if exists packages_currency_check;
update public.packages set currency = 'PHP' where currency <> 'PHP';
alter table public.packages add constraint packages_currency_check check (currency = 'PHP');

create table if not exists public.package_addons (
  id text primary key,
  name text not null,
  price numeric not null,
  currency text not null default 'PHP' check (currency = 'PHP'),
  rate_type text not null default 'flat' check (rate_type in ('flat', 'per_head')),
  description text,
  created_at timestamptz not null default now()
);

alter table public.package_addons
  add column if not exists currency text not null default 'PHP' check (currency = 'PHP');
alter table public.package_addons drop constraint if exists package_addons_currency_check;
update public.package_addons set currency = 'PHP' where currency <> 'PHP';
alter table public.package_addons add constraint package_addons_currency_check check (currency = 'PHP');

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

-- ----------------------------------------------------------------------------
-- 2. CLIENT EVENT BOOKINGS
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
  booking_status text not null default 'pending' check (booking_status in ('pending', 'approved', 'confirmed', 'completed', 'cancelled', 'forfeit')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'pending_verification', 'partially_paid', 'downpayment_paid', 'fully_paid')),
  payment_method text check (payment_method in ('qrph', 'gcash', 'maya', 'bank_transfer', 'paymongo')),
  gcash_ref_number text,
  proof_of_payment_url text,
  staff_ids text[] default '{}'::text[],
  assigned_services text[] default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A date can have only one active event. Cancelled/forfeited records remain
-- available for audit while releasing the date for a new reservation.
create unique index if not exists bookings_one_active_event_per_date_idx
  on public.bookings (event_date)
  where booking_status not in ('cancelled', 'forfeit');

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

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;
alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in ('qrph', 'gcash', 'maya', 'bank_transfer', 'paymongo'));
alter table public.bookings drop constraint if exists bookings_currency_check;
update public.bookings set currency = 'PHP' where currency <> 'PHP';
alter table public.bookings add constraint bookings_currency_check check (currency = 'PHP');

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

-- ----------------------------------------------------------------------------
-- 3. CALENDAR BLOCKED DATES COORDINATOR
-- ----------------------------------------------------------------------------
create table if not exists public.blocked_dates (
  date date primary key,
  reason text default 'Management reservation / inventory lock',
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. SERVICE STAFF ROSTER
-- ----------------------------------------------------------------------------
create table if not exists public.staff (
  id text primary key,
  name text not null,
  role text not null check (role in ('waiter', 'food_attendant')),
  status text not null default 'available' check (status in ('available', 'busy')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. REVIEWS & TESTIMONIALS
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 6. GENERAL CONTACT & CATERING INQUIRIES
-- ----------------------------------------------------------------------------
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
-- 7. NOTIFICATION AUDIT LOGS (Semaphore SMS & EmailJS)
-- ----------------------------------------------------------------------------
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

-- Server-side request throttling for paid provider Edge Functions.
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

alter table public.packages enable row level security;
alter table public.package_addons enable row level security;
alter table public.menu_items enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.staff enable row level security;
alter table public.reviews enable row level security;
alter table public.catering_inquiries enable row level security;
alter table public.notification_logs enable row level security;
alter table public.paymongo_checkout_sessions enable row level security;

-- Packages, Addons, and Menu Items management policies
drop policy if exists "Allow public read on packages" on public.packages;
drop policy if exists "Allow all on packages" on public.packages;
create policy "Allow all on packages" on public.packages for all using (true) with check (true);

drop policy if exists "Allow public read on addons" on public.package_addons;
drop policy if exists "Allow all on addons" on public.package_addons;
create policy "Allow all on addons" on public.package_addons for all using (true) with check (true);

drop policy if exists "Allow public read on menu_items" on public.menu_items;
drop policy if exists "Allow all on menu_items" on public.menu_items;
create policy "Allow all on menu_items" on public.menu_items for all using (true) with check (true);

-- Clients may submit bookings but cannot read or alter booking records directly.
drop policy if exists "Allow anyone to create bookings" on public.bookings;
drop policy if exists "Allow public read on bookings" on public.bookings;
drop policy if exists "Allow update on bookings" on public.bookings;
drop policy if exists "Allow delete on bookings" on public.bookings;

-- Availability metadata is public read-only data.
drop policy if exists "Allow public read on blocked_dates" on public.blocked_dates;
create policy "Allow public read on blocked_dates" on public.blocked_dates for select using (true);
drop policy if exists "Allow all on blocked_dates" on public.blocked_dates;

-- Staff names/status may be displayed publicly, but only trusted services may change them.
drop policy if exists "Allow public read on staff" on public.staff;
create policy "Allow public read on staff" on public.staff for select using (true);
drop policy if exists "Allow all on staff" on public.staff;

-- Reviews are public read-only data; moderation is performed by a trusted service.
drop policy if exists "Allow public read on reviews" on public.reviews;
create policy "Allow public read on reviews" on public.reviews for select using (true);
drop policy if exists "Allow anyone to insert reviews" on public.reviews;
drop policy if exists "Allow all on reviews" on public.reviews;

-- The public may submit an inquiry, but inquiry contents are never publicly readable.
drop policy if exists "Allow anyone to insert inquiries" on public.catering_inquiries;
drop policy if exists "Allow public read on inquiries" on public.catering_inquiries;
drop policy if exists "Allow all on inquiries" on public.catering_inquiries;

-- Notification logs contain customer data and have no anonymous policies.
drop policy if exists "Allow all on notification_logs" on public.notification_logs;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Prices throughout the catalog are Philippine pesos (PHP).
insert into public.packages (id, name, ideal_for, included_menu, default_pax, price_per_head, currency, base_price, tier_prices)
values
  (
    'PKG-KIDDIE-01',
    'Kiddie Party Special',
    'Children''s birthdays (Ages 3-12), playful events',
    '["Kiddie Spaghetti", "Mini Crispy Burgers", "Chicken Tenders", "Juice Boxes"]'::jsonb,
    30,
    12,
    'PHP',
    360,
    '[{"pax": 30, "price": 360}, {"pax": 50, "price": 600}]'::jsonb
  ),
  (
    'PKG-CLASSIC-02',
    'Classic Family Feast',
    'Family reunions, casual gatherings, intimate adult parties',
    '["Roast Pork", "Baked Macaroni", "Buttered Mixed Veggies", "Fried Chicken"]'::jsonb,
    50,
    18,
    'PHP',
    900,
    '[{"pax": 50, "price": 900}, {"pax": 70, "price": 1260}]'::jsonb
  ),
  (
    'PKG-PREMIER-03',
    'Grand Executive Buffet',
    'Formal events, weddings, corporate galas',
    '["Slow-Roasted Beef", "Seafood Alfredo", "Creamy Grilled Salmon", "Caesar Salad"]'::jsonb,
    100,
    30,
    'PHP',
    3000,
    '[{"pax": 100, "price": 3000}, {"pax": 150, "price": 4500}]'::jsonb
  ),
  (
    'budget-basic',
    'Budgetarian Celebration Package',
    'Cost-effective celebrations with full catering & elegant styling',
    '["Sinag Fried Chicken", "Creamy Carbonara", "Sweet Style Spaghetti", "Pork Lumpia Shanghai", "Chilled Juice & Ice Cream"]'::jsonb,
    50,
    700,
    'PHP',
    35000,
    '[{"pax": 50, "price": 35000}, {"pax": 70, "price": 40000}, {"pax": 100, "price": 45000}, {"pax": 150, "price": 65000}, {"pax": 200, "price": 90000}]'::jsonb
  ),
  (
    'budget-entertainment',
    'Budgetarian Package with Freebies and Entertainment',
    'Complete celebration with clown, magic show, photo booth, and complete freebies',
    '["Sinag Fried Chicken", "Beef Caldereta", "Baked Macaroni", "Pork BBQ Skewers", "Dessert Station & Drinks"]'::jsonb,
    50,
    940,
    'PHP',
    47000,
    '[{"pax": 50, "price": 47000}, {"pax": 70, "price": 52000}, {"pax": 100, "price": 56000}, {"pax": 150, "price": 76000}, {"pax": 200, "price": 102000}]'::jsonb
  ),
  (
    'full-blast',
    'Full Blast Package with Freebies',
    'Premium grand celebration with full balloon ceiling, executive banquet, stage setup, and all freebies',
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

-- Add-ons Database
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

-- Initial Menu Items Catalog
insert into public.menu_items (id, name, category, description, image_url, tag, color, accent_color, active, sort_order)
values
  ('menu-main-beef-broccoli', 'Beef Broccoli', 'main', 'Tender beef strips simmered in savory garlic soy sauce with crisp broccoli.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_beef_broccoli.jpg', 'Signature Beef', null, null, true, 10),
  ('menu-main-cordon-bleu', 'Cordon Bleu', 'main', 'Crispy breaded chicken breast stuffed with savory ham and molten cheese.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_cordon_bleu.jpg', 'Poultry Favorite', null, null, true, 20),
  ('menu-main-menudo', 'Menudo', 'main', 'Tender pork cubes and liver simmered in spiced tomato stew with vegetables.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_menudo.jpg', 'Fiesta Classic', null, null, true, 30),
  ('menu-main-caldereta', 'Caldereta', 'main', 'Slow-braised beef in a rich liver-infused tomato gravy with bell peppers.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_caldereta.jpg', 'Hearty Braised Beef', null, null, true, 40),
  ('menu-main-mixed-veggies', 'Mixed Veggies', 'main', 'Fresh seasonal vegetables sautéed in butter and garlic, paired with quail eggs.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_mixed_veggies_quail_egg.jpg', 'Buttered Medley', null, null, true, 50),
  ('menu-main-chicken-curry', 'Chicken Curry', 'main', 'Tender chicken braised in fragrant yellow coconut curry with tender potatoes.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_chicken_curry.jpg', 'Aromatic Curry', null, null, true, 60),
  ('menu-main-fish-fillet', 'Fish Fillet', 'main', 'Golden-crusted dory fish fillets served with homemade tartar dipping sauce.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_fish_fillet.jpg', 'Crispy Seafood', null, null, true, 70),
  ('menu-pasta-pancit', 'Pancit', 'pasta', 'Sautéed bihon and canton noodles tossed with shredded vegetables and meat.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_pancit.jpg', 'Traditional Feast', null, null, true, 10),
  ('menu-pasta-spaghetti', 'Spaghetti', 'pasta', 'Party-favorite sweet-savory ground meat sauce topped with shredded cheddar.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_spag.jpg', 'Sweet-Style Pinoy', null, null, true, 20),
  ('menu-pasta-carbonara', 'Carbonara', 'pasta', 'Al dente pasta coated in luscious garlic cream with crispy smoked bacon.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/food_carbonara.jpg', 'Creamy Bacon', null, null, true, 30),
  ('menu-drink-blue-lemonade', 'Blue Lemonade', 'drink', 'Vibrant chilled sweet-tangy blue lemonade garnished with fresh lemon slices and mint leaves.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/drink_blue_lemonade.jpg', 'Citrus Cooler', '#0284C7', '#F0F9FF', true, 10),
  ('menu-drink-iced-tea', 'Iced Tea', 'drink', 'Crisp and refreshing house-blend sweet iced tea brewed fresh and served ice-chilled.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/drink_iced_tea.jpg', 'Signature House Blend', '#D97706', '#FFFBEB', true, 20),
  ('menu-drink-cucumber', 'Cucumber', 'drink', 'Cooling cucumber-infused lemon refreshment with crisp fresh cucumber ribbon slices.', 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files/menu/drink_cucumber.jpg', 'Crisp Refresher', '#059669', '#ECFDF5', true, 30)
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  image_url = coalesce(excluded.image_url, public.menu_items.image_url),
  tag = coalesce(excluded.tag, public.menu_items.tag),
  color = coalesce(excluded.color, public.menu_items.color),
  accent_color = coalesce(excluded.accent_color, public.menu_items.accent_color),
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Staff Roster
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

-- Blocked Dates Initial Seed
insert into public.blocked_dates (date, reason)
values
  ('2026-10-01', 'Private Catering Event / Inventory Lock'),
  ('2026-12-25', 'Christmas Day Holiday Closure')
on conflict (date) do nothing;

-- Initial Reviews
insert into public.reviews (id, user_name, rating, comment, image_url, date, reply)
values
  ('rev-1', 'Kathryn B.', 5, 'Sinag Catering made our daughter''s 7th birthday unforgettable! The clown was so entertaining and the chicken tenders were a massive hit!', 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=500&auto=format&fit=crop&q=60', '2026-08-15', 'Thank you so much Kathryn! It was an absolute joy celebrating with your family!'),
  ('rev-2', 'Mark Anthony G.', 5, 'Smooth booking process! The QR Ph downpayment was verified within minutes by the admin. Staff were very courteous.', null, '2026-09-02', 'Maraming salamat po Sir Mark! Looking forward to your next event!')
on conflict (id) do nothing;

-- ============================================================================
-- 8. STORAGE BUCKET CONFIGURATION ('Files')
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

