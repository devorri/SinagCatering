export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: 'OK' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const secretKey =
      process.env.VITE_PAYMONGO_SECRET_KEY ||
      process.env.PAYMONGO_SECRET_KEY ||
      ''
    const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
    const amountMinor = Math.round((body.amount || 17500) * 100)
    const origin =
      event.headers.origin ||
      event.headers.referer?.replace(/\/$/, '') ||
      'https://sinag-catering.netlify.app'
    const successUrl = `${origin}?paymongo=success&booking=${encodeURIComponent(body.bookingId || '')}`
    const cancelUrl = `${origin}?paymongo=cancelled&booking=${encodeURIComponent(body.bookingId || '')}`

    const pmRes = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: `${body.packageName || 'Sinag Catering Package'} 50% Downpayment`,
                amount: amountMinor,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: ['card', 'gcash', 'paymaya', 'qrph'],
            description: `Downpayment for Booking #${body.bookingId || 'New'} (${body.guestCount || 50} pax, ${body.eventDate || 'TBD'})`,
            success_url: successUrl,
            cancel_url: cancelUrl,
            reference_number: body.bookingId,
            customer_email: body.email || 'customer@example.com',
            send_email_receipt: true,
            metadata: { booking_id: body.bookingId },
          },
        },
      }),
    })

    const pmData = await pmRes.json()
    if (!pmRes.ok) {
      return {
        statusCode: pmRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: pmData?.errors?.[0]?.detail || 'PayMongo checkout failed' }),
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        checkout_url: pmData.data?.attributes?.checkout_url,
        checkout_session_id: pmData.data?.id,
      }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal error' }),
    }
  }
}
