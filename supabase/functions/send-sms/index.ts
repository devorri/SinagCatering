declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

export {}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, prefer, baggage, sentry-trace',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const isWithinRateLimit = async (request: Request): Promise<boolean> => {
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor?.split(',').map((value) => value.trim()).at(-1) || 'unknown'
  
  // Fail open if rate limiter infrastructure is not configured
  if (!projectUrl || !serviceRoleKey || clientIp === 'unknown') return true

  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sms:${clientIp}`))
    const keyHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const response = await fetch(`${projectUrl}/rest/v1/rpc/consume_api_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key_hash: keyHash, request_limit: 10, window_seconds: 900 }),
    })
    return response.ok ? (await response.json() === true) : true
  } catch {
    return true
  }
}

Deno.serve(async (request) => {
  // Handle CORS preflight request cleanly
  if (request.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: any
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body' }, 400)
  }

  // 1. Resolve recipient phone number from direct call or webhook payload
  const rawRecipient = body.recipientPhone || body.phone || body.number || body.record?.phone || body.record?.customer_phone || ''
  const rawDigits = typeof rawRecipient === 'string' ? rawRecipient.replace(/[^0-9]/g, '') : ''
  let recipientPhone = rawDigits
  if (recipientPhone.startsWith('09') && recipientPhone.length === 11) {
    recipientPhone = '63' + recipientPhone.slice(1)
  } else if (recipientPhone.startsWith('9') && recipientPhone.length === 10) {
    recipientPhone = '63' + recipientPhone
  } else if (recipientPhone.startsWith('639') && recipientPhone.length === 12) {
    // already standardized
  }

  // 2. Resolve & format message payload
  // Action Item 2: Fix raw UUID or OTP code being sent as the body
  let rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
  const record = body.record || null
  const bookingId = body.referenceId || record?.id || ''

  // If payload is from a database webhook or passed raw booking ID / UUID as message
  const isRawUuidOrId = /^bk-[a-f0-9-]+$/i.test(rawMessage) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawMessage)

  if ((!rawMessage || isRawUuidOrId) && (record || bookingId)) {
    const ref = bookingId || record?.id || 'Booking'
    const eventDate = record?.event_date || 'Upcoming'
    const pax = record?.guest_count ? ` (${record.guest_count} pax)` : ''
    rawMessage = `Sinag Catering: Downpayment Verified & Booking Confirmed! Ref: #${ref}. Date: ${eventDate}${pax}. Your event date is locked in our calendar! Salamat po!`
  } else if (!rawMessage && body.otp) {
    rawMessage = `[Sinag Catering] Your verification OTP is: ${body.otp}. Valid for 10 minutes. Use this to verify your reservation account.`
  }

  const message = rawMessage.slice(0, 1000)

  if (!/^639\d{9}$/.test(recipientPhone) || !message) {
    return jsonResponse({
      error: 'A valid 11-digit Philippine mobile number starting with 09 and message are required',
      receivedPhone: recipientPhone,
    }, 400)
  }

  const apiKey = Deno.env.get('SEMAPHORE_API_KEY') || Deno.env.get('VITE_SEMAPHORE_API_KEY') || 'f18fe7eb9f2f4b5477776b98d8b55565'
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'Semaphore SMS is not configured on the server' }, 503)
  }

  try {
    if (!await isWithinRateLimit(request)) {
      return jsonResponse({ success: false, error: 'SMS request limit reached' }, 429)
    }
  } catch {
    // Continue if rate limiter throws
  }

  // Sender names to try: SENDER_NAME, SEMAPHORE_SENDER_NAME, SinagsCater, and default fallback
  const preferredSender = Deno.env.get('SENDER_NAME') || Deno.env.get('SEMAPHORE_SENDER_NAME') || 'SinagsCater'

  const sendToSemaphore = async (sender?: string) => {
    const payload = new URLSearchParams({ apikey: apiKey, number: recipientPhone, message })
    if (sender && sender.toUpperCase() !== 'SEMAPHORE') {
      payload.set('sendername', sender)
    }

    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      signal: AbortSignal.timeout(15000),
    })

    const data = await response.json().catch(() => null)
    return { ok: response.ok, data }
  }

  try {
    // First attempt with configured sender name
    let result = await sendToSemaphore(preferredSender)

    // If Semaphore rejects because sender name is unapproved, retry without sendername
    const hasSenderError = Array.isArray(result.data) && result.data.some((item: any) => item?.senderName)
    if (!result.ok && hasSenderError) {
      result = await sendToSemaphore(undefined)
    }

    const items = Array.isArray(result.data) ? result.data : (result.data ? [result.data] : [])
    const firstMsg = items[0] || null
    const isSuccess = result.ok && Boolean(firstMsg?.message_id || firstMsg?.status === 'Queued' || firstMsg?.status === 'Pending')

    if (isSuccess) {
      return jsonResponse({
        success: true,
        simulated: false,
        message_id: firstMsg?.message_id,
        status: firstMsg?.status || 'Pending',
        network: firstMsg?.network,
      })
    }

    const errorMessage = Array.isArray(result.data) && result.data[0]?.senderName
      ? result.data[0].senderName
      : (result.data?.error || (typeof result.data === 'string' ? result.data : 'Semaphore rejected the SMS request'))

    return jsonResponse({ success: false, error: errorMessage, details: result.data }, 502)
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || 'SMS service is temporarily unavailable' }, 502)
  }
})
