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

const packages = {
  'PKG-KIDDIE-01': {
    name: 'Kiddie Party Special',
    idealFor: "Children's birthdays (Ages 3-12), playful events",
    menu: ['Kiddie Spaghetti', 'Mini Crispy Burgers', 'Chicken Tenders', 'Juice Boxes'],
    defaultPax: 30,
    pricePerHead: 12,
  },
  'PKG-CLASSIC-02': {
    name: 'Classic Family Feast',
    idealFor: 'Family reunions, casual gatherings, intimate adult parties',
    menu: ['Roast Pork', 'Baked Macaroni', 'Buttered Mixed Veggies', 'Fried Chicken'],
    defaultPax: 50,
    pricePerHead: 18,
  },
  'PKG-PREMIER-03': {
    name: 'Grand Executive Buffet',
    idealFor: 'Formal events, weddings, corporate galas',
    menu: ['Slow-Roasted Beef', 'Seafood Alfredo', 'Creamy Grilled Salmon', 'Caesar Salad'],
    defaultPax: 100,
    pricePerHead: 30,
  },
} as const

const addons = {
  'ADD-CANDY-01': { name: 'Chocolate Fountain & Candy Buffet', price: 150 },
  'ADD-HOST-02': { name: 'Party Emcee & Games Host', price: 200 },
  'ADD-DESSERT-03': { name: 'Assorted Dessert Station', price: 100 },
} as const

const systemPrompt = `You are Sinag Catering's booking assistant. Recommend only these packages and add-ons; do not invent offerings. Return JSON with chat_reply and form_data. For general policy/payment questions not specified here, ask the user to contact the concierge and set form_data to null.

Packages:
PKG-KIDDIE-01 | Kiddie Party Special | Children's birthdays ages 3-12 | Menu: Kiddie Spaghetti, Mini Crispy Burgers, Chicken Tenders, Juice Boxes | default 30 guests | PHP 12 per guest.
PKG-CLASSIC-02 | Classic Family Feast | Family reunions, casual gatherings, intimate adult parties | Menu: Roast Pork, Baked Macaroni, Buttered Mixed Veggies, Fried Chicken | default 50 guests | PHP 18 per guest.
PKG-PREMIER-03 | Grand Executive Buffet | Formal events, weddings, corporate galas | Menu: Slow-Roasted Beef, Seafood Alfredo, Creamy Grilled Salmon, Caesar Salad | default 100 guests | PHP 30 per guest.

Flat add-ons:
ADD-CANDY-01 Chocolate Fountain & Candy Buffet PHP 150.
ADD-HOST-02 Party Emcee & Games Host PHP 200.
ADD-DESSERT-03 Assorted Dessert Station PHP 100.

form_data must use package_id, exact package_name, guest_count, estimated_total, selected_menu, and add-on IDs. Estimate is guest_count times price per guest plus flat add-ons. Default to the package's default guest count if none is given. For a child's birthday, the candy buffet is a relevant optional suggestion.`

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

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ai:${clientIp}`))
  const keyHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const response = await fetch(`${projectUrl}/rest/v1/rpc/consume_api_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key_hash: keyHash, request_limit: 30, window_seconds: 60 }),
  })
  return response.ok && await response.json() === true
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { message?: unknown; history?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected a JSON request body' }, 400)
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : ''
  if (!message) return jsonResponse({ error: 'Message is required' }, 400)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return jsonResponse({ error: 'AI service is not configured' }, 503)

  try {
    if (!await isWithinRateLimit(request)) return jsonResponse({ error: 'AI request limit reached or rate limiter unavailable' }, 429)
  } catch {
    return jsonResponse({ error: 'AI request limit could not be verified' }, 503)
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-4).flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const entry = item as { role?: unknown; content?: unknown }
        if (!['user', 'assistant'].includes(String(entry.role)) || typeof entry.content !== 'string') return []
        return [{ role: entry.role === 'assistant' ? 'model' : 'user', parts: [{ text: entry.content.slice(0, 1000) }] }]
      })
    : []

  try {
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [...history, { role: 'user', parts: [{ text: message }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    })

    if (!response.ok) return jsonResponse({ error: 'AI provider request failed' }, 502)

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return jsonResponse({ error: 'AI provider returned no response' }, 502)

    let result: { chat_reply?: unknown; form_data?: Record<string, unknown> | null }
    try {
      result = JSON.parse(text)
    } catch {
      return jsonResponse({ error: 'AI provider returned invalid JSON' }, 502)
    }

    const chatReply = typeof result.chat_reply === 'string' ? result.chat_reply.slice(0, 1500) : ''
    const rawFormData = result.form_data
    if (!chatReply) return jsonResponse({ error: 'AI provider returned an invalid response' }, 502)
    if (!rawFormData || typeof rawFormData !== 'object') {
      return jsonResponse({ chat_reply: chatReply, form_data: null, escalate: true })
    }

    const packageId = String(rawFormData.package_id || '') as keyof typeof packages
    const selectedPackage = packages[packageId]
    if (!selectedPackage) return jsonResponse({ error: 'AI provider selected an unknown package' }, 502)

    const countFromMessage = message.match(/\b(\d{1,4})\s*(?:guests?|people|persons?|pax|heads)\b/i)
    const requestedCount = Number(rawFormData.guest_count)
    const guestCount = Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.min(Math.floor(requestedCount), 1000)
      : countFromMessage ? Number(countFromMessage[1]) : selectedPackage.defaultPax
    const addonIds = Array.isArray(rawFormData.addons)
      ? [...new Set(rawFormData.addons.filter((id): id is keyof typeof addons => typeof id === 'string' && id in addons))]
      : []
    const estimatedTotal = guestCount * selectedPackage.pricePerHead + addonIds.reduce((total, id) => total + addons[id].price, 0)

    return jsonResponse({
      chat_reply: chatReply,
      form_data: {
        package_id: packageId,
        package_name: selectedPackage.name,
        guest_count: guestCount,
        estimated_total: estimatedTotal,
        selected_menu: selectedPackage.menu,
        addons: addonIds,
      },
      escalate: false,
    })
  } catch {
    return jsonResponse({ error: 'AI service is temporarily unavailable' }, 502)
  }
})
