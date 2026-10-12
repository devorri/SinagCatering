-- Revision 2: persist menu/service choices and complete full-payment workflow.
alter table public.bookings add column if not exists assigned_services text[] not null default '{}'::text[];

alter table public.bookings drop constraint if exists bookings_booking_status_check;
alter table public.bookings add constraint bookings_booking_status_check
  check (booking_status in ('pending', 'approved', 'confirmed', 'completed', 'cancelled', 'forfeit'));

-- Server-side guard prevents a client from bypassing the 14-day booking rule.
create or replace function public.enforce_booking_lead_time()
returns trigger language plpgsql as $$
begin
  if new.event_date < current_date + 14 then
    raise exception 'Bookings must be scheduled at least 14 days in advance';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_lead_time_guard on public.bookings;
create trigger bookings_lead_time_guard
  before insert or update of event_date on public.bookings
  for each row execute function public.enforce_booking_lead_time();
