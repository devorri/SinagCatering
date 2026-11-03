// Netlify Scheduled Function — runs every hour.
//
//  1. Expires "Reserve Only" 48-hour holds that received no payment and
//     releases the date back to the calendar.
//  2. Sends the automated 1-week event reminder (client SMS + in-app for
//     client and admin), exactly once per booking.
//
// Required environment variables (Netlify → Site configuration → Environment):
//   VITE_SUPABASE_URL (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY   (recommended; falls back to VITE_SUPABASE_ANON_KEY)
//   VITE_SEMAPHORE_API_KEY (or SEMAPHORE_API_KEY)
// Optional: VITE_SEMAPHORE_SENDER_NAME, ADMIN_PHONE

export const config = {
  schedule: '@hourly',
}

const REMINDER_DAYS = 7

const env = (...names) => {
  for (const n of names) {
    const v = process.env[n]
    if (v && String(v).trim()) return String(v).trim()
  }
  return ''
}

const manilaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

const normalizePhone = (raw) => {
  const digits = String(raw || '').replace(/[^0-9]/g, '')
  if (digits.startsWith('09') && digits.length === 11) return `63${digits.slice(1)}`
  if (digits.startsWith('9') && digits.length === 10) return `63${digits}`
  return digits
}

const makeClient = () => {
  const url = env('SUPABASE_URL', 'VITE_SUPABASE_URL').replace(/\/$/, '')
  const key = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY')
  if (!url || !key) return null
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
  const rest = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } })
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { ok: res.ok, status: res.status, data }
  }
  return { rest }
}

const sendSms = async (phone, message) => {
  const apikey = env('VITE_SEMAPHORE_API_KEY', 'SEMAPHORE_API_KEY')
  const number = normalizePhone(phone)
  if (!apikey || !number) return { ok: false, error: 'SMS not configured' }
  const send = async (sender) => {
    const params = new URLSearchParams({ apikey, number, message })
    if (sender && sender.toUpperCase() !== 'SEMAPHORE') params.set('sendername', sender)
    const res = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await res.json().catch(() => null)
    return { res, data }
  }
  let { res, data } = await send(env('VITE_SEMAPHORE_SENDER_NAME', 'SEMAPHORE_SENDER_NAME') || 'SinagsCater')
  if (!res.ok && Array.isArray(data) && data.some((d) => d?.senderName)) {
    ;({ res, data } = await send(undefined))
  }
  return { ok: res.ok, data }
}

const insertNotifications = async (db, rows) => {
  if (rows.length === 0) return
  await db.rest('notifications?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
}

const logSms = async (db, recipient, message, ok, referenceId) => {
  await db.rest('notification_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: 'sms',
      recipient: normalizePhone(recipient),
      message,
      status: ok ? 'sent' : 'failed',
      provider: 'Semaphore',
      reference_id: referenceId,
    }),
  })
}

const expireHolds = async (db) => {
  // Preferred: database function (also creates the notifications)
  const rpc = await db.rest('rpc/expire_reserve_holds', { method: 'POST', body: '{}' })
  if (rpc.ok) return Number(rpc.data) || 0

  // Fallback: direct update
  const nowIso = new Date().toISOString()
  const res = await db.rest(
    `bookings?payment_term=eq.reserve&booking_status=eq.pending&payment_status=eq.unpaid&hold_expires_at=lt.${encodeURIComponent(nowIso)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ booking_status: 'forfeit' }),
    },
  )
  const rows = Array.isArray(res.data) ? res.data : []
  await insertNotifications(
    db,
    rows.flatMap((b) => [
      {
        id: `nt-exp-c-${b.id}`,
        audience: 'client',
        user_id: b.user_id,
        recipient_email: String(b.email || '').toLowerCase(),
        booking_id: b.id,
        type: 'hold_expired',
        title: 'Temporary Hold Expired',
        message: `Your 48-hour temporary hold for booking ${b.id} on ${b.event_date} expired because no payment was uploaded. The date has been released.`,
      },
      {
        id: `nt-exp-a-${b.id}`,
        audience: 'admin',
        booking_id: b.id,
        type: 'hold_expired',
        title: 'Temporary Hold Expired',
        message: `${b.customer_name}'s 48-hour hold (${b.id}) on ${b.event_date} expired without payment and was forfeited. Date released to the calendar.`,
      },
    ]),
  )
  return rows.length
}

const sendReminders = async (db) => {
  const today = manilaToday()
  const until = addDays(today, REMINDER_DAYS)
  const query =
    `bookings?select=id,user_id,customer_name,email,phone,event_date,booking_status,payment_status,payment_term` +
    `&reminder_sent_at=is.null&event_date=gte.${today}&event_date=lte.${until}` +
    `&booking_status=in.(confirmed,approved,pending)`
  const res = await db.rest(query)
  if (!res.ok || !Array.isArray(res.data)) return 0

  let sent = 0
  for (const b of res.data) {
    if (b.payment_term === 'reserve' && b.payment_status === 'unpaid') continue

    // Claim the reminder so it is sent only once (browser sessions use the same guard)
    const claim = await db.rest(`bookings?id=eq.${encodeURIComponent(b.id)}&reminder_sent_at=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
    })
    if (!claim.ok || !Array.isArray(claim.data) || claim.data.length === 0) continue

    const clientText = `Sinag Catering Reminder: Your event is coming up in 1 week! Booking Reference: ${b.id} on ${b.event_date}. We are excited to serve you. Check your portal for full details.`
    const sms = await sendSms(b.phone, clientText)
    await logSms(db, b.phone, clientText, sms.ok, b.id)

    await insertNotifications(db, [
      {
        id: `nt-rem-c-${b.id}`,
        audience: 'client',
        user_id: b.user_id,
        recipient_email: String(b.email || '').toLowerCase(),
        booking_id: b.id,
        type: 'event_reminder',
        title: 'Your event is 1 week away!',
        message: clientText,
      },
      {
        id: `nt-rem-a-${b.id}`,
        audience: 'admin',
        booking_id: b.id,
        type: 'event_reminder',
        title: 'Upcoming Event Alert',
        message: `Upcoming Event Alert: Booking ${b.id} (${b.customer_name}) is scheduled in 7 days on ${b.event_date}. Please coordinate final preparations.`,
      },
    ])
    sent += 1
  }
  return sent
}

export default async () => {
  const db = makeClient()
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Supabase environment variables are not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const result = { ok: true, expiredHolds: 0, remindersSent: 0, errors: [] }
  try {
    result.expiredHolds = await expireHolds(db)
  } catch (err) {
    result.errors.push(`expireHolds: ${err?.message || err}`)
  }
  try {
    result.remindersSent = await sendReminders(db)
  } catch (err) {
    result.errors.push(`sendReminders: ${err?.message || err}`)
  }
  console.log('[sinag-automation]', JSON.stringify(result))
  return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
