-- 2026-11-19 — Egress fix
-- Receipt screenshots were saved as base64 data URLs inside bookings.proof_of_payment_url
-- (~2.2 MB across 7 rows). Every bookings fetch downloaded them, which blew the
-- Supabase free-tier egress quota.
--
-- This moves them into a private archive table (nothing is deleted) and clears the
-- column. After Storage is available again, run scripts/restore-receipts.mjs to
-- upload them to the "Files" bucket and put the real URLs back.

-- 0) Preview what will be moved (run this alone first if you want to check)
-- select id, customer_name, payment_status, length(proof_of_payment_url) as bytes
-- from public.bookings where proof_of_payment_url like 'data:%' order by created_at;

begin;

create table if not exists public.booking_receipt_archive (
  booking_id text primary key references public.bookings(id) on delete cascade,
  data_url   text not null,
  archived_at timestamptz not null default now()
);

-- Private: RLS on with no policies, so the anon key cannot read it.
-- Only the dashboard / service role can.
alter table public.booking_receipt_archive enable row level security;

insert into public.booking_receipt_archive (booking_id, data_url)
select id, proof_of_payment_url
from public.bookings
where proof_of_payment_url like 'data:%'
on conflict (booking_id) do update set data_url = excluded.data_url, archived_at = now();

update public.bookings
set proof_of_payment_url = null
where proof_of_payment_url like 'data:%';

commit;

-- Verify: should return 0
-- select count(*) from public.bookings where proof_of_payment_url like 'data:%';
