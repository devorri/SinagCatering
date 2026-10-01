# Sinag Catering

A Vite + React catering inquiry site with Supabase-backed lead capture.

## Run Locally

```bash
npm install
npm run dev
```

## Connect Supabase

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Fill in the Supabase URL and anon key, plus the EmailJS service, template, and public key.
5. Restart the Vite dev server.

All catalog prices and estimates are in Philippine pesos (PHP).

Accounts use the application-owned `public.users` and `public.user_sessions`
tables; Supabase Auth is not used. Passwords are stored as plain text in
`public.users` as requested; session tokens are stored hashed. The
`table-auth` Edge Function is the only account read/write path. Plain-text
password storage is unsafe for any real or reused credentials. This basic
table-auth flow does not include email verification, password reset, or MFA.
After registering an administrator, grant the role in SQL Editor:

```sql
update public.users
set role = 'admin'
where email = 'admin@example.com';
```

Bookings, reviews, staff, blocked dates, and inquiries still use the app's
existing local business-data state; user accounts and hashed credentials are
stored in the Supabase tables described above.

Deploy `table-auth` with `supabase/functions/table-auth/index.ts`. Its gateway
JWT verification is disabled in `supabase/config.toml`; the function validates
opaque session tokens against `public.user_sessions` itself.

## Deploy Edge Functions

Gemini, Semaphore, and PayMongo credentials must only be stored as Supabase Edge
Function secrets. In the Supabase dashboard, open **Project Settings > Edge Functions > Secrets**
and add `GEMINI_API_KEY`, `SEMAPHORE_API_KEY`, `SEMAPHORE_SENDER_NAME`,
`PAYMONGO_SECRET_KEY`, and `PAYMONGO_APP_ORIGIN`. Use a newly rotated PayMongo test
secret because the one previously pasted into chat is exposed. Set `PAYMONGO_APP_ORIGIN`
to the exact site origin (for local testing, `http://127.0.0.1:5173`). Do not add
provider secret keys to `VITE_` variables. Hosted Checkout does not need the PayMongo
public key in the browser.

Install and authenticate the Supabase CLI, then link and deploy:

```bash
npx supabase login
npx supabase link --project-ref wldhvmbcvjbnwkgiafpg
npx supabase functions deploy ai-assistant
npx supabase functions deploy send-sms
npx supabase functions deploy table-auth
npx supabase functions deploy create-paymongo-checkout
npx supabase functions deploy verify-paymongo-payment
```

Run `supabase/schema.sql` in the Supabase SQL editor to create/update the tables,
RLS policies, package catalog, currency fields, and add-ons. The browser app does not
deploy SQL or Edge Functions automatically.

Without Supabase URL/key values, public inquiry submissions run in preview mode
and use `localStorage` under `sinag-preview-inquiries`. Account sign-up/sign-in
requires the deployed `table-auth` Edge Function.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
