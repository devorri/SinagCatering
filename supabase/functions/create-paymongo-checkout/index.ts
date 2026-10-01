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

const getConfig = () => ({
  projectUrl: Deno.env.get('SUPABASE_URL'),
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
})

const databaseRequest = async (path: string, serviceRoleKey: string, init?: RequestInit) =>
  fetch(`${getConfig().projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

const rateLimitKey = async (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',').map((part) => part.trim()).at(-1)
  if (!ip) return null
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`paymongo:${ip}`)))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const { projectUrl, serviceRoleKey } = getConfig()
  const paymongoSecret = Deno.env.get('PAYMONGO_SECRET_KEY')
  const appOrigin = Deno.env.get('PAYMONGO_APP_ORIGIN')
  if (!projectUrl || !serviceRoleKey || !paymongoSecret || !appOrigin) {
    return jsonResponse({ error: 'PayMongo checkout is not configured' }, 503)
  }

  let requestBody: { bookingId?: unknown; booking?: unknown }
  try {
    requestBody = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body' }, 400)
  }

  const booking = requestBody.booking && typeof requestBody.booking === 'object'
    ? requestBody.booking as Record<string, unknown>
    : null
  const bookingId = typeof requestBody.bookingId === 'string' ? requestBody.bookingId : ''
  if (!booking || !/^bk-[0-9a-f-]{36}$/i.test(bookingId)) {
    return jsonResponse({ error: 'Booking details and a valid booking ID are required' }, 400)
  }

  const customerName = typeof booking.customerName === 'string' ? booking.customerName.trim().slice(0, 120) : ''
  const email = typeof booking.email === 'string' ? booking.email.trim().toLowerCase().slice(0, 254) : ''
  const phone = typeof booking.phone === 'string' ? booking.phone.trim().slice(0, 32) : ''
  const eventType = typeof booking.eventType === 'string' ? booking.eventType.trim().slice(0, 100) : ''
  const eventDate = typeof booking.eventDate === 'string' ? booking.eventDate : ''
  const packageId = typeof booking.packageId === 'string' ? booking.packageId : ''
  const guestCount = Number(booking.guestCount)
  if (!customerName || !/^\S+@\S+\.\S+$/.test(email) || !phone || !eventType ||
      !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !packageId ||
      !Number.isInteger(guestCount) || guestCount < 1 || guestCount > 1000) {
    return jsonResponse({ error: 'Booking details are incomplete or invalid' }, 400)
  }

  try {
    const keyHash = await rateLimitKey(request)
    if (!keyHash) return jsonResponse({ error: 'Could not identify checkout request' }, 400)
    const limitResponse = await fetch(`${projectUrl}/rest/v1/rpc/consume_api_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key_hash: keyHash, request_limit: 3, window_seconds: 900 }),
    })
    if (!limitResponse.ok || await limitResponse.json() !== true) {
      return jsonResponse({ error: 'Checkout limit reached or rate limiter unavailable' }, 429)
    }
  } catch {
    return jsonResponse({ error: 'Checkout limit could not be verified' }, 503)
  }

  const packageParams = new URLSearchParams({
    id: `eq.${packageId}`,
    select: 'id,name,currency,price_per_head,tier_prices',
  })
  const packageResponse = await databaseRequest(`packages?${packageParams}`, serviceRoleKey)
  if (!packageResponse.ok) return jsonResponse({ error: 'Package catalog is unavailable' }, 503)
  const packageRows = await packageResponse.json()
  const selectedPackage = packageRows[0]
  if (!selectedPackage || selectedPackage.currency !== 'PHP') {
    return jsonResponse({ error: 'Only PHP catalog packages can be paid through PayMongo.' }, 400)
  }

  const tierPrices = Array.isArray(selectedPackage.tier_prices) ? selectedPackage.tier_prices : []
  const perHeadPrice = Number(selectedPackage.price_per_head)
  const isPerHead = Number.isFinite(perHeadPrice) && perHeadPrice > 0
  const tier = tierPrices.find((item: { pax: number }) => guestCount <= Number(item.pax) + 10) ?? tierPrices.at(-1)
  if (!isPerHead && (!tier || !Number.isFinite(Number(tier.price)) || !Number.isFinite(Number(tier.pax)))) {
    return jsonResponse({ error: 'Package pricing is invalid' }, 503)
  }

  const addOns = booking.addOns && typeof booking.addOns === 'object'
    ? booking.addOns as Record<string, unknown>
    : {}
  const selectedAddons: { id: string; quantity: number }[] = [
    { id: 'ADD-MAIN-04', quantity: Number(addOns.extraMainCount ?? 0) },
    { id: 'ADD-PASTA-05', quantity: Number(addOns.extraPastaCount ?? 0) },
    { id: 'ADD-DESSERT-06', quantity: Number(addOns.extraDessertCount ?? 0) },
  ]
  if (Array.isArray(addOns.selectedAddonIds)) {
    for (const addonId of addOns.selectedAddonIds) {
      if (typeof addonId !== 'string') return jsonResponse({ error: 'Invalid add-on selection' }, 400)
      selectedAddons.push({ id: addonId, quantity: 1 })
    }
  }
  if (selectedAddons.some((addon) => !Number.isInteger(addon.quantity) || addon.quantity < 0 || addon.quantity > 20)) {
    return jsonResponse({ error: 'Add-on quantity is invalid' }, 400)
  }
  const billableAddons = selectedAddons.filter((addon) => addon.quantity > 0)

  let addonTotal = 0
  if (billableAddons.length) {
    const addonIds = [...new Set(billableAddons.map((addon) => addon.id))]
    const addonParams = new URLSearchParams({
      id: `in.(${addonIds.join(',')})`,
      select: 'id,price,currency,rate_type',
    })
    const addonsResponse = await databaseRequest(`package_addons?${addonParams}`, serviceRoleKey)
    if (!addonsResponse.ok) return jsonResponse({ error: 'Add-on catalog is unavailable' }, 503)
    const addonRows = await addonsResponse.json()
    if (addonRows.length !== addonIds.length || addonRows.some((addon: { currency: string }) => addon.currency !== 'PHP')) {
      return jsonResponse({ error: 'One or more add-ons cannot be paid in PHP' }, 400)
    }
    addonTotal = billableAddons.reduce((sum, selected) => {
      const addon = addonRows.find((row: { id: string }) => row.id === selected.id)
      return sum + Number(addon.price) * selected.quantity * (addon.rate_type === 'per_head' ? guestCount : 1)
    }, 0)
  }

  const basePrice = isPerHead ? guestCount * perHeadPrice : Number(tier.price)
  const excessPaxFee = isPerHead ? 0 : Math.max(0, guestCount - (Number(tier.pax) + 10)) * 700
  const totalPrice = basePrice + excessPaxFee + addonTotal
  const downpayment = Math.round(totalPrice * 0.5)
  const amountMinor = downpayment * 100
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return jsonResponse({ error: 'Calculated downpayment is invalid' }, 400)

  const bookingParams = new URLSearchParams({ id: `eq.${bookingId}`, select: 'id,email,total_price,payment_status' })
  const existingBookingResponse = await databaseRequest(`bookings?${bookingParams}`, serviceRoleKey)
  if (!existingBookingResponse.ok) return jsonResponse({ error: 'Booking store is unavailable' }, 503)
  const existingBookings = await existingBookingResponse.json()
  if (existingBookings[0]) {
    const existing = existingBookings[0]
    if (existing.email !== email || Number(existing.total_price) !== totalPrice || existing.payment_status !== 'unpaid') {
      return jsonResponse({ error: 'Booking reference cannot be reused' }, 409)
    }
  } else {
    const bookingRow = {
      id: bookingId,
      user_id: typeof booking.userId === 'string' ? booking.userId : null,
      customer_name: customerName,
      email,
      phone,
      event_type: eventType,
      custom_event_type: typeof booking.customEventType === 'string' ? booking.customEventType.slice(0, 100) : null,
      event_date: eventDate,
      guest_count: guestCount,
      package_name: selectedPackage.name,
      package_id: packageId,
      currency: 'PHP',
      base_price: basePrice,
      extra_pax_fee: excessPaxFee,
      add_ons: addOns,
      total_price: totalPrice,
      downpayment_amount: downpayment,
      booking_status: 'pending',
      payment_status: 'unpaid',
      payment_method: 'paymongo',
      notes: typeof booking.notes === 'string' ? booking.notes.slice(0, 2000) : null,
    }
    const insertResponse = await databaseRequest('bookings', serviceRoleKey, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(bookingRow),
    })
    if (!insertResponse.ok) return jsonResponse({ error: 'Could not save booking before payment' }, 503)
  }

  const sessionParams = new URLSearchParams({ booking_id: `eq.${bookingId}`, select: 'checkout_url,status,amount_minor' })
  const sessionResponse = await databaseRequest(`paymongo_checkout_sessions?${sessionParams}`, serviceRoleKey)
  if (!sessionResponse.ok) return jsonResponse({ error: 'Payment session store is unavailable' }, 503)
  const existingSessions = await sessionResponse.json()
  if (existingSessions[0]?.status === 'pending' && Number(existingSessions[0].amount_minor) === amountMinor) {
    return jsonResponse({ booking_id: bookingId, checkout_url: existingSessions[0].checkout_url, total_price: totalPrice, downpayment_amount: downpayment })
  }

  const successUrl = new URL(appOrigin)
  successUrl.searchParams.set('paymongo', 'success')
  successUrl.searchParams.set('booking', bookingId)
  const cancelUrl = new URL(appOrigin)
  cancelUrl.searchParams.set('paymongo', 'cancelled')
  cancelUrl.searchParams.set('booking', bookingId)

  try {
    const paymongoResponse = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${paymongoSecret}:`)}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': bookingId,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{
              name: `${selectedPackage.name} 50% downpayment`,
              amount: amountMinor,
              currency: 'PHP',
              quantity: 1,
            }],
            payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
            success_url: successUrl.toString(),
            cancel_url: cancelUrl.toString(),
            reference_number: bookingId,
            customer_email: email,
            send_email_receipt: true,
            metadata: { booking_id: bookingId },
          },
        },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!paymongoResponse.ok) return jsonResponse({ error: 'PayMongo could not create checkout. Check that the account has these payment methods enabled.' }, 502)

    const paymongoData = await paymongoResponse.json()
    const session = paymongoData.data
    const checkoutUrl = session?.attributes?.checkout_url
    const sessionId = session?.id
    if (typeof checkoutUrl !== 'string' || typeof sessionId !== 'string') {
      return jsonResponse({ error: 'PayMongo returned an invalid checkout session' }, 502)
    }

    const saveResponse = await databaseRequest('paymongo_checkout_sessions', serviceRoleKey, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        booking_id: bookingId,
        checkout_session_id: sessionId,
        checkout_url: checkoutUrl,
        amount_minor: amountMinor,
        currency: 'PHP',
        status: 'pending',
      }),
    })
    if (!saveResponse.ok) return jsonResponse({ error: 'Checkout was created but could not be recorded. Contact the concierge before retrying.' }, 503)
    return jsonResponse({ booking_id: bookingId, checkout_url: checkoutUrl, total_price: totalPrice, downpayment_amount: downpayment })
  } catch {
    return jsonResponse({ error: 'PayMongo checkout is temporarily unavailable' }, 502)
  }
})
