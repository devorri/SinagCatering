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
4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Restart the Vite dev server.

Without env values, the form runs in preview mode and stores submissions in
`localStorage` under `sinag-preview-inquiries`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
