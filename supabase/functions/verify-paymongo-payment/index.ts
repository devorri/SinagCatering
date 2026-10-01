declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

export {}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const databaseRequest = (projectUrl: string, serviceRoleKey: string, path: string, init?: RequestInit) =>
  fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const paymongoSecret = Deno.env.get('PAYMONGO_SECRET_KEY')
  if (!projectUrl || !serviceRoleKey || !paymongoSecret) return jsonResponse({ error: 'Payment verification is not configured' }, 503)

  let body: { bookingId?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body' }, 400)
  }
  const bookingId = typeof body.bookingId === 'string' ? body.bookingId : ''
  if (!/^bk-[0-9a-f-]{36}$/i.test(bookingId)) return jsonResponse({ error: 'Invalid booking reference' }, 400)

  const sessionParams = new URLSearchParams({
    booking_id: `eq.${bookingId}`,
    select: 'checkout_session_id,amount_minor,currency,status,payment_id',
  })
  const sessionResponse = await databaseRequest(projectUrl, serviceRoleKey, `paymongo_checkout_sessions?${sessionParams}`)
  if (!sessionResponse.ok) return jsonResponse({ error: 'Payment record could not be read' }, 503)
  const sessions = await sessionResponse.json()
  const session = sessions[0]
  if (!session || session.currency !== 'PHP') return jsonResponse({ error: 'Payment session not found' }, 404)
  if (session.status === 'paid') {
    return jsonResponse({ paid: true, downpayment_amount: Number(session.amount_minor) / 100 })
  }

  try {
    const providerResponse = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(session.checkout_session_id)}`, {
      headers: { Authorization: `Basic ${btoa(`${paymongoSecret}:`)}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!providerResponse.ok) return jsonResponse({ error: 'Could not verify the PayMongo session' }, 502)
    const providerData = await providerResponse.json()
    const attributes = providerData.data?.attributes
    const paidPayment = Array.isArray(attributes?.payments)
      ? attributes.payments.find((payment: { attributes?: { status?: string; currency?: string } }) =>
          payment.attributes?.status === 'paid' && payment.attributes.currency === 'PHP')
      : undefined
    if (!paidPayment || Number(paidPayment.attributes.amount) < Number(session.amount_minor)) {
      return jsonResponse({ paid: false, payment_status: 'unpaid' })
    }

    const paymentId = paidPayment.id
    const saveSession = await databaseRequest(projectUrl, serviceRoleKey, `paymongo_checkout_sessions?booking_id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'paid', payment_id: paymentId, updated_at: new Date().toISOString() }),
    })
    if (!saveSession.ok) return jsonResponse({ error: 'Could not update PayMongo session status' }, 503)

    const updateBooking = await databaseRequest(projectUrl, serviceRoleKey, `bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ payment_status: 'downpayment_paid', downpayment_amount: Number(session.amount_minor) / 100, updated_at: new Date().toISOString() }),
    })
    if (!updateBooking.ok) return jsonResponse({ error: 'Could not update booking payment status' }, 503)
    return jsonResponse({ paid: true, downpayment_amount: Number(session.amount_minor) / 100 })
  } catch {
    return jsonResponse({ error: 'Payment verification is temporarily unavailable' }, 502)
  }
})
