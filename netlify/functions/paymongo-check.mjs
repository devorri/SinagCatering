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
    const piId = body.paymentIntentId

    if (!piId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'paymentIntentId is required' }),
      }
    }

    const checkRes = await fetch(
      `https://api.paymongo.com/v1/payment_intents/${encodeURIComponent(piId)}`,
      {
        headers: { Authorization: authHeader },
      }
    )
    const checkData = await checkRes.json()
    if (!checkRes.ok) {
      return {
        statusCode: checkRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to check payment status' }),
      }
    }

    const status = checkData.data?.attributes?.status
    const isPaid = status === 'succeeded'
    const payments = checkData.data?.attributes?.payments || []

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        paid: isPaid,
        payments,
      }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err?.message || 'Internal check error' }),
    }
  }
}
