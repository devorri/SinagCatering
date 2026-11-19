// One-time: moves archived base64 receipts into Supabase Storage and restores
// bookings.proof_of_payment_url with the real public URL.
//
// Run AFTER Supabase service is restored:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/restore-receipts.mjs
// (Service role key: Supabase Dashboard -> Project Settings -> API. Never commit it.)

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.RECEIPT_BUCKET || 'Files'

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data: rows, error } = await supabase
  .from('booking_receipt_archive')
  .select('booking_id, data_url')
if (error) {
  console.error('Could not read archive:', error.message)
  process.exit(1)
}
if (!rows.length) {
  console.log('Nothing to restore.')
  process.exit(0)
}

let ok = 0
for (const { booking_id, data_url } of rows) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(data_url)
  if (!m) {
    console.warn(`[skip] ${booking_id}: not a base64 data URL`)
    continue
  }
  const mime = m[1]
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const bytes = Buffer.from(m[2], 'base64')
  const path = `receipts/${booking_id}_restored.${ext}`

  const up = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: true,
  })
  if (up.error) {
    console.error(`[fail] ${booking_id}: upload — ${up.error.message}`)
    continue
  }
  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  const upd = await supabase.from('bookings').update({ proof_of_payment_url: publicUrl }).eq('id', booking_id)
  if (upd.error) {
    console.error(`[fail] ${booking_id}: update — ${upd.error.message}`)
    continue
  }
  await supabase.from('booking_receipt_archive').delete().eq('booking_id', booking_id)
  console.log(`[ok] ${booking_id} -> ${publicUrl} (${Math.round(bytes.length / 1024)} KB)`)
  ok++
}
console.log(`Done: ${ok}/${rows.length} restored.`)
