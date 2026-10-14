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

Deno.serve(async (request) => {
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

  const recipientEmail = (body.recipientEmail || body.email || body.to || '').trim()
  const subject = (body.subject || "Sinag Catering Services Notification").trim()
  let message = (body.message || body.body || '').trim()
  const referenceId = body.referenceId || body.id || ''

  // Replace default placeables like [Company Name] with official branding
  message = message.replace(/\[Company Name\]/g, "Sinag Catering Services")

  if (!recipientEmail || (!message && !body.otp && !body.passcode)) {
    return jsonResponse({ error: 'Valid recipient email and message/code are required' }, 400)
  }

  const expiryDate = new Date(Date.now() + 15 * 60 * 1000)
  const formattedTime = expiryDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  // Check EmailJS credentials from environment
  const serviceId = Deno.env.get('EMAILJS_SERVICE_ID') || Deno.env.get('VITE_EMAILJS_SERVICE_ID')
  const templateId = Deno.env.get('EMAILJS_TEMPLATE_ID') || Deno.env.get('VITE_EMAILJS_TEMPLATE_ID')
  const publicKey = Deno.env.get('EMAILJS_PUBLIC_KEY') || Deno.env.get('VITE_EMAILJS_PUBLIC_KEY')

  if (serviceId && templateId && publicKey) {
    try {
      const emailjsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_email: recipientEmail,
            email: recipientEmail,
            to_name: recipientEmail.split('@')[0],
            subject: subject,
            message: message,
            company_name: "Sinag's Cater",
            company: "Sinag's Cater",
            passcode: body.otp || body.passcode || message,
            time: formattedTime,
            reference_id: referenceId,
          },
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (emailjsRes.ok) {
        return jsonResponse({ success: true, simulated: false, provider: 'EmailJS' })
      }
      const errText = await emailjsRes.text().catch(() => '')
      return jsonResponse({ success: false, error: errText || 'EmailJS rejected message' }, 502)
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message || 'Email dispatch failed' }, 502)
    }
  }

  // Simulated delivery if no provider configured
  return jsonResponse({
    success: true,
    simulated: true,
    provider: 'EmailJS (Simulated)',
    recipient: recipientEmail,
    subject: subject,
  })
})
