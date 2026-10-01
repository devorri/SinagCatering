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

const isWithinRateLimit = async (request: Request): Promise<boolean> => {
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor?.split(',').map((value) => value.trim()).at(-1) || 'unknown'
  if (!projectUrl || !serviceRoleKey || clientIp === 'unknown') return false

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sms:${clientIp}`))
  const keyHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const response = await fetch(`${projectUrl}/rest/v1/rpc/consume_api_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key_hash: keyHash, request_limit: 5, window_seconds: 900 }),
  })
  return response.ok && await response.json() === true
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { recipientPhone?: unknown; message?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body' }, 400)
  }

  const recipientPhone = typeof body.recipientPhone === 'string'
    ? body.recipientPhone.replace(/[^0-9+]/g, '')
    : ''
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : ''
  if (!/^09\d{9}$/.test(recipientPhone) || !message) {
    return jsonResponse({ error: 'A valid Philippine mobile number and message are required' }, 400)
  }

  const apiKey = Deno.env.get('SEMAPHORE_API_KEY')
  if (!apiKey) return jsonResponse({ success: true, simulated: true })

  try {
    if (!await isWithinRateLimit(request)) return jsonResponse({ success: false, error: 'SMS request limit reached or rate limiter unavailable' }, 429)
  } catch {
    return jsonResponse({ success: false, error: 'SMS request limit could not be verified' }, 503)
  }

  try {
    const payload = new URLSearchParams({ apikey: apiKey, number: recipientPhone, message })
    const senderName = Deno.env.get('SEMAPHORE_SENDER_NAME')
    if (senderName) payload.set('sendername', senderName)

    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload,
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return jsonResponse({ success: false, error: 'Semaphore rejected the SMS request' }, 502)

    const providerResult = await response.json()
    if (Array.isArray(providerResult) && providerResult.some((item) => item.status === 'Queued' || item.status === 'Pending')) {
      return jsonResponse({ success: true, simulated: false })
    }
    return jsonResponse({ success: false, error: 'Semaphore did not queue the SMS' }, 502)
  } catch {
    return jsonResponse({ success: false, error: 'SMS service is temporarily unavailable' }, 502)
  }
})
