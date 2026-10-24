-- ============================================================================
-- MIGRATION: 20261024_open_catalog_security.sql
-- Description: Remove RLS restrictions from packages, menu_items, and addons
--              so all catalog updates push directly without security blocking.
-- ============================================================================

-- Disable Row Level Security completely on packages, menu_items, package_addons
alter table if exists public.packages disable row level security;
alter table if exists public.menu_items disable row level security;
alter table if exists public.package_addons disable row level security;

-- Drop all existing policies that could restrict reads or writes
drop policy if exists "Allow public read on packages" on public.packages;
drop policy if exists "Allow all on packages" on public.packages;
drop policy if exists "Allow public read on menu_items" on public.menu_items;
drop policy if exists "Allow all on menu_items" on public.menu_items;
drop policy if exists "Allow public read on addons" on public.package_addons;
drop policy if exists "Allow all on package_addons" on public.package_addons;

-- Grant complete permissions to anon, authenticated, and service_role
grant all on public.packages to anon, authenticated, service_role;
grant all on public.menu_items to anon, authenticated, service_role;
grant all on public.package_addons to anon, authenticated, service_role;
