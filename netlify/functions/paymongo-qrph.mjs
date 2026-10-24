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
    const amountMinor = Math.round((body.amount || 25000) * 100)

    // Step 1: Create Payment Intent
    const piRes = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountMinor,
            payment_method_allowed: ['qrph'],
            payment_method_options: { card: { request_three_d_secure: 'any' } },
            currency: 'PHP',
            description: `Sinag Catering 50% Downpayment - ${body.packageName || 'Banquet'} (Booking #${body.bookingId || 'New'})`,
          },
        },
      }),
    })
    const piData = await piRes.json()
    if (!piRes.ok) {
      return {
        statusCode: piRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: piData?.errors?.[0]?.detail || 'Failed to create payment intent',
        }),
      }
    }

    const piId = piData.data?.id
    const clientKey = piData.data?.attributes?.client_key

    // Step 2: Create Payment Method qrph
    const pmRes = await fetch('https://api.paymongo.com/v1/payment_methods', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            type: 'qrph',
          },
        },
      }),
    })
    const pmData = await pmRes.json()
    if (!pmRes.ok) {
      return {
        statusCode: pmRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: pmData?.errors?.[0]?.detail || 'Failed to create QR Ph payment method',
        }),
      }
    }
    const pmId = pmData.data?.id

    // Step 3: Attach Payment Method to Payment Intent
    const attachRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${piId}/attach`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: pmId,
            client_key: clientKey,
          },
        },
      }),
    })
    const attachData = await attachRes.json()
    if (!attachRes.ok) {
      return {
        statusCode: attachRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: attachData?.errors?.[0]?.detail || 'Failed to attach QR Ph payment method',
        }),
      }
    }

    const nextAction = attachData.data?.attributes?.next_action
    const qrImageUrl = nextAction?.code?.image_url
    const expiresAt = nextAction?.code?.expires_at

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        payment_intent_id: piId,
        client_key: clientKey,
        qr_image: qrImageUrl,
        expires_at: expiresAt,
      }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal QR Ph error' }),
    }
  }
}
