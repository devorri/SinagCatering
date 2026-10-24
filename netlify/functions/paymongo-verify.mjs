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

    const sessionId = body.checkoutSessionId || body.sessionId
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'checkoutSessionId is required' }),
      }
    }

    const pmRes = await fetch(
      `https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: authHeader },
      }
    )
    const pmData = await pmRes.json()
    if (!pmRes.ok) {
      return {
        statusCode: pmRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'PayMongo verification failed' }),
      }
    }

    const attributes = pmData.data?.attributes
    const payments = Array.isArray(attributes?.payments) ? attributes.payments : []
    const paidPayment = payments.find((p) => p.attributes?.status === 'paid')
    const isPaid = Boolean(paidPayment) || attributes?.status === 'paid'

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid: isPaid,
        status: attributes?.status || (isPaid ? 'paid' : 'unpaid'),
        amount_paid: paidPayment ? paidPayment.attributes.amount / 100 : 0,
        payment_id: paidPayment?.id || null,
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
