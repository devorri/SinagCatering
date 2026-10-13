-- Production hardening: run this migration before exposing the application.
--
-- This application uses trusted Edge Functions with the service role for account,
-- booking, payment, and administration mutations.  Browser clients must not be
-- allowed to read or mutate customer records directly.

-- ---------------------------------------------------------------------------
-- Bookings: enforce the business rules at the database boundary, where browser
-- checks cannot be bypassed and concurrent requests cannot double-book a date.
-- ---------------------------------------------------------------------------
alter table public.bookings
  add constraint bookings_customer_name_not_blank check (length(btrim(customer_name)) between 1 and 120) not valid,
  add constraint bookings_email_not_blank check (length(btrim(email)) between 3 and 254) not valid,
  add constraint bookings_phone_not_blank check (length(btrim(phone)) between 7 and 32) not valid,
  add constraint bookings_event_type_not_blank check (length(btrim(event_type)) between 1 and 100) not valid,
  add constraint bookings_price_scale check (
    base_price <= 99999999.99
    and extra_pax_fee <= 99999999.99
    and total_price <= 99999999.99
    and coalesce(downpayment_amount, 0) <= total_price
  ) not valid;

alter table public.bookings validate constraint bookings_customer_name_not_blank;
alter table public.bookings validate constraint bookings_email_not_blank;
alter table public.bookings validate constraint bookings_phone_not_blank;
alter table public.bookings validate constraint bookings_event_type_not_blank;
alter table public.bookings validate constraint bookings_price_scale;

-- Do not silently choose one booking when historical active duplicates exist.
-- Resolve the records named by this query before retrying the migration.
do $$
begin
  if exists (
    select 1
    from public.bookings
    where booking_status not in ('cancelled', 'forfeit')
    group by event_date
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce one active booking per date: resolve duplicate active booking dates first';
  end if;
end;
$$;

create unique index if not exists bookings_one_active_event_per_date_idx
  on public.bookings (event_date)
  where booking_status not in ('cancelled', 'forfeit');

-- Use the business timezone rather than the database server timezone.
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

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists paymongo_checkout_sessions_set_updated_at on public.paymongo_checkout_sessions;
create trigger paymongo_checkout_sessions_set_updated_at
  before update on public.paymongo_checkout_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS and grants: no PII or business mutation is available through the anon
-- key.  Catalog/availability/review display data stays public read-only.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow anyone to create bookings" on public.bookings;
drop policy if exists "Allow anyone to insert inquiries" on public.catering_inquiries;
drop policy if exists "Allow public read on bookings" on public.bookings;
drop policy if exists "Allow update on bookings" on public.bookings;
drop policy if exists "Allow delete on bookings" on public.bookings;
drop policy if exists "Allow anyone to insert reviews" on public.reviews;

revoke all on table
  public.users,
  public.user_sessions,
  public.bookings,
  public.paymongo_checkout_sessions,
  public.catering_inquiries,
  public.notification_logs,
  public.reviews,
  public.staff,
  public.blocked_dates,
  public.packages,
  public.package_addons
from anon, authenticated;

grant select on public.packages, public.package_addons, public.blocked_dates, public.staff, public.reviews
to anon, authenticated;

-- All admin/customer writes are now Edge-Function-only. Service role retains
-- access for those functions; do not add browser-side write policies here.
