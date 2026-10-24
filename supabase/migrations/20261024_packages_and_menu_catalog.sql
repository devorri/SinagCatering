-- ============================================================================
-- MIGRATION: 20261024_packages_and_menu_catalog.sql
-- Description: Dynamic packages, menu items, and catalog add-ons management.
-- ============================================================================

-- 1. Ensure packages table has the details column for inclusions, entertainment, freebies
alter table public.packages
  add column if not exists details jsonb not null default '{}'::jsonb;

-- 2. Ensure package_addons table exists
create table if not exists public.package_addons (
  id text primary key,
  name text not null,
  price numeric not null,
  currency text not null default 'PHP' check (currency = 'PHP'),
  rate_type text not null default 'flat' check (rate_type in ('flat', 'per_head')),
  description text,
  created_at timestamptz not null default now()
);

-- 3. Create menu_items table
create table if not exists public.menu_items (
  id text not null primary key,
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

-- Index for category and active status lookups
create index if not exists menu_items_category_active_idx
  on public.menu_items (category, active, sort_order);

-- Enable RLS
alter table public.packages enable row level security;
alter table public.package_addons enable row level security;
alter table public.menu_items enable row level security;

-- RLS Policies & Permissions for Catalog Management
drop policy if exists "Allow public read on menu_items" on public.menu_items;
drop policy if exists "Allow all on menu_items" on public.menu_items;
create policy "Allow all on menu_items" on public.menu_items
  for all using (true) with check (true);

drop policy if exists "Allow public read on packages" on public.packages;
drop policy if exists "Allow all on packages" on public.packages;
create policy "Allow all on packages" on public.packages
  for all using (true) with check (true);

drop policy if exists "Allow public read on addons" on public.package_addons;
drop policy if exists "Allow all on package_addons" on public.package_addons;
create policy "Allow all on package_addons" on public.package_addons
  for all using (true) with check (true);

-- Permissions
grant all on public.menu_items to anon, authenticated, service_role;
grant all on public.packages to anon, authenticated, service_role;
grant all on public.package_addons to anon, authenticated, service_role;

-- 3. Seed initial menu items if table is empty
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
  sort_order = excluded.sort_order,
  updated_at = now();

-- 5. Ensure storage bucket 'Files' exists and is configured for public assets
insert into storage.buckets (id, name, public)
values ('Files', 'Files', true)
on conflict (id) do update set public = true;

-- Storage RLS policies for 'Files' bucket
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

