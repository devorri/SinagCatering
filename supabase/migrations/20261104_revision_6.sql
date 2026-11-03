-- ============================================================================
-- MIGRATION: 20261104_revision_6.sql
-- Sinag Catering — Revision 6
--
--   1. Terms & Conditions acceptance tracking on users (+ auth provider for
--      the upcoming Google sign-in).
--   2. Three payment terms (full / downpayment / reserve) and the 48-hour
--      "Reserve Only" temporary hold.
--   3. Cancellation reasons + manual refund request tracking.
--   4. 1-week event reminder bookkeeping.
--   5. In-app notification center (admin bell + client bell).
--   6. Automatic expiry of 48-hour holds + 1-week reminders (pg_cron, if
--      available — the app and the Netlify scheduled function also run
--      the same checks, so this is optional).
--
-- Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. USERS
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists auth_provider text not null default 'email';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_auth_provider_check'
  ) then
    alter table public.users
      add constraint users_auth_provider_check
      check (auth_provider in ('email', 'google'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2-4. BOOKINGS
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists payment_term text not null default 'downpayment',
  add column if not exists hold_expires_at timestamptz,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_notes text,
  add column if not exists refund_percentage integer,
  add column if not exists refund_amount numeric,
  add column if not exists refund_status text not null default 'none',
  add column if not exists cancelled_at timestamptz,
  add column if not exists refund_processed_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_payment_term_check') then
    alter table public.bookings
      add constraint bookings_payment_term_check
      check (payment_term in ('full', 'downpayment', 'reserve'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_refund_status_check') then
    alter table public.bookings
      add constraint bookings_refund_status_check
      check (refund_status in ('none', 'pending', 'processed', 'not_applicable'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_refund_percentage_check') then
    alter table public.bookings
      add constraint bookings_refund_percentage_check
      check (refund_percentage is null or refund_percentage between 0 and 100);
  end if;
end;
$$;

-- Back-fill the payment term for bookings created before this revision.
update public.bookings
set payment_term = 'full'
where payment_term = 'downpayment'
  and total_price > 0
  and coalesce(downpayment_amount, 0) >= total_price;

create index if not exists bookings_hold_expires_at_idx
  on public.bookings (hold_expires_at)
  where payment_term = 'reserve' and booking_status = 'pending';

create index if not exists bookings_event_date_reminder_idx
  on public.bookings (event_date)
  where reminder_sent_at is null;

create index if not exists bookings_refund_status_idx
  on public.bookings (refund_status)
  where refund_status <> 'none';

-- ---------------------------------------------------------------------------
-- 5. NOTIFICATIONS (in-app bell for admin + clients)
-- ---------------------------------------------------------------------------
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

-- Match the access model the browser app already uses for its tables.
alter table public.notifications disable row level security;
grant all on public.notifications to anon, authenticated, service_role;

-- notification_logs.provider: allow the in-app channel used for admin alerts.
alter table public.notification_logs drop constraint if exists notification_logs_provider_check;
alter table public.notification_logs
  add constraint notification_logs_provider_check
  check (provider in ('Semaphore', 'Email', 'InApp'));

-- Realtime for the bell (ignored if the publication does not exist).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. AUTOMATION: expire 48-hour holds
-- ---------------------------------------------------------------------------
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
    set booking_status = 'forfeit',
        updated_at = now()
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
      'nt-exp-c-' || rec.id,
      'client', rec.user_id, rec.email, rec.id, 'hold_expired',
      'Temporary Hold Expired',
      'Your 48-hour temporary hold for booking ' || rec.id || ' on ' || rec.event_date ||
      ' expired because no payment was uploaded. The date has been released.'
    )
    on conflict (id) do nothing;

    insert into public.notifications (id, audience, booking_id, type, title, message)
    values (
      'nt-exp-a-' || rec.id,
      'admin', rec.id, 'hold_expired',
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

-- Optional: schedule with pg_cron when the extension is enabled
-- (Supabase Dashboard → Database → Extensions → pg_cron).
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
