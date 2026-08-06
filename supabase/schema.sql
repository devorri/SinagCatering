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
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'booked', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.catering_inquiries enable row level security;

drop policy if exists "Anyone can create catering inquiries" on public.catering_inquiries;
create policy "Anyone can create catering inquiries"
on public.catering_inquiries
for insert
to anon
with check (true);

drop policy if exists "Authenticated users can read catering inquiries" on public.catering_inquiries;
create policy "Authenticated users can read catering inquiries"
on public.catering_inquiries
for select
to authenticated
using (true);

create index if not exists catering_inquiries_created_at_idx
on public.catering_inquiries (created_at desc);
