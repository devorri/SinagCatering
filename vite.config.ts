import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function apiServerPlugin(env: Record<string, string> = {}): Plugin {
  return {
    name: 'sinag-api-endpoints',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        // Helper to parse JSON body
        const readJsonBody = async (): Promise<any> => {
          return new Promise((resolve) => {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              try { resolve(JSON.parse(body)) } catch { resolve({}) }
            })
          })
        }

        // 1. Create PayMongo Checkout Session
        if (url === '/api/paymongo/create-checkout' && req.method === 'POST') {
          try {
            const body = await readJsonBody()
            const secretKey = process.env.VITE_PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET_KEY || 'sk_test_c45YuqZKv46a1C22BDm5VbDB'
            const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64')

            const amountMinor = Math.round((body.amount || 17500) * 100) // minor unit (cents)
            const origin = req.headers.origin || 'http://localhost:5173'
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

            const pmData: any = await pmRes.json()
            if (!pmRes.ok) {
              res.statusCode = pmRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: pmData?.errors?.[0]?.detail || 'PayMongo checkout failed' }))
              return
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              checkout_url: pmData.data?.attributes?.checkout_url,
              checkout_session_id: pmData.data?.id,
            }))
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Internal error' }))
            return
          }
        }

        // 2. Verify PayMongo Checkout Session
        if (url === '/api/paymongo/verify-payment' && req.method === 'POST') {
          try {
            const body = await readJsonBody()
            const secretKey = process.env.VITE_PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET_KEY || 'sk_test_c45YuqZKv46a1C22BDm5VbDB'
            const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64')

            const sessionId = body.checkoutSessionId

            if (!sessionId) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'checkoutSessionId is required' }))
              return
            }

            const pmRes = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`, {
              headers: { Authorization: authHeader },
            })
            const pmData: any = await pmRes.json()
            if (!pmRes.ok) {
              res.statusCode = pmRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'PayMongo verification failed' }))
              return
            }

            const attributes = pmData.data?.attributes
            const payments = Array.isArray(attributes?.payments) ? attributes.payments : []
            const paidPayment = payments.find((p: any) => p.attributes?.status === 'paid')
            const isPaid = Boolean(paidPayment) || attributes?.status === 'paid'

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              paid: isPaid,
              status: attributes?.status || (isPaid ? 'paid' : 'unpaid'),
              amount_paid: paidPayment ? paidPayment.attributes.amount / 100 : 0,
              payment_id: paidPayment?.id || null,
            }))
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Internal error' }))
            return
          }
        }

        // 2b. Generate Real PayMongo QR Ph Dynamic Code (In-App Embedding)
        if (url === '/api/paymongo/generate-qrph' && req.method === 'POST') {
          try {
            const body = await readJsonBody()
            const secretKey = process.env.VITE_PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET_KEY || 'sk_test_c45YuqZKv46a1C22BDm5VbDB'
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
            const piData: any = await piRes.json()
            if (!piRes.ok) {
              res.statusCode = piRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: piData?.errors?.[0]?.detail || 'Failed to create payment intent' }))
              return
            }

            const piId = piData.data?.id
            const clientKey = piData.data?.attributes?.client_key

            // Step 2: Create Payment Method of type qrph
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
            const pmData: any = await pmRes.json()
            if (!pmRes.ok) {
              res.statusCode = pmRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: pmData?.errors?.[0]?.detail || 'Failed to create QR Ph payment method' }))
              return
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
            const attachData: any = await attachRes.json()
            if (!attachRes.ok) {
              res.statusCode = attachRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: attachData?.errors?.[0]?.detail || 'Failed to attach QR Ph payment method' }))
              return
            }

            const nextAction = attachData.data?.attributes?.next_action
            const qrImageUrl = nextAction?.code?.image_url
            const expiresAt = nextAction?.code?.expires_at

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              payment_intent_id: piId,
              client_key: clientKey,
              qr_image: qrImageUrl,
              expires_at: expiresAt,
            }))
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Internal QR Ph error' }))
            return
          }
        }

        // 2c. Check Payment Intent Status
        if (url === '/api/paymongo/check-payment-intent' && req.method === 'POST') {
          try {
            const body = await readJsonBody()
            const secretKey = process.env.VITE_PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET_KEY || 'sk_test_c45YuqZKv46a1C22BDm5VbDB'
            const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64')
            const piId = body.paymentIntentId

            if (!piId) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'paymentIntentId is required' }))
              return
            }

            const checkRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${encodeURIComponent(piId)}`, {
              headers: { Authorization: authHeader },
            })
            const checkData: any = await checkRes.json()
            if (!checkRes.ok) {
              res.statusCode = checkRes.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Failed to check payment status' }))
              return
            }

            const status = checkData.data?.attributes?.status
            const isPaid = status === 'succeeded'
            const payments = checkData.data?.attributes?.payments || []

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              status,
              paid: isPaid,
              payments,
            }))
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Internal check error' }))
            return
          }
        }

        // 3. Dispatch Semaphore SMS
        if (url === '/api/sms/send' && req.method === 'POST') {
          try {
            const body = await readJsonBody()
            const apiKey = env.VITE_SEMAPHORE_API_KEY || process.env.VITE_SEMAPHORE_API_KEY || 'f18fe7eb9f2f4b5477776b98d8b55565'

            const rawPhone = (body.recipientPhone || '').toString()
            const phoneDigits = rawPhone.replace(/[^0-9]/g, '')
            const message = (body.message || '').trim()

            if (!phoneDigits || !message) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Phone and message are required' }))
              return
            }

            // Normalize Philippine mobile numbers to international format (639XXXXXXXXX)
            let formattedPhone = phoneDigits
            if (formattedPhone.startsWith('09') && formattedPhone.length === 11) {
              formattedPhone = '63' + formattedPhone.slice(1)
            } else if (formattedPhone.startsWith('9') && formattedPhone.length === 10) {
              formattedPhone = '63' + formattedPhone
            }

            const sendToSemaphore = async (sender?: string) => {
              const paramsObj: Record<string, string> = {
                apikey: apiKey,
                number: formattedPhone,
                message,
              }
              if (sender && sender !== 'SEMAPHORE') {
                paramsObj.sendername = sender
              }
              const params = new URLSearchParams(paramsObj)
              const semRes = await fetch('https://api.semaphore.co/api/v4/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
              })
            const semData: any = await semRes.json().catch(() => null)
            return { semRes, semData }
          }

          // Attempt with configured sender name
          const rawSender = (env.VITE_SEMAPHORE_SENDER_NAME || process.env.VITE_SEMAPHORE_SENDER_NAME || '').trim()
          let { semRes, semData } = await sendToSemaphore(rawSender)

          // If rejected due to invalid senderName, automatically fallback without sendername
          const hasSenderError = Array.isArray(semData) && semData.some((item: any) => item?.senderName)
          if (!semRes.ok && hasSenderError) {
            const retry = await sendToSemaphore(undefined)
            semRes = retry.semRes
            semData = retry.semData
          }

          const semItems = Array.isArray(semData) ? semData : (semData && typeof semData === 'object' && semData.message_id ? [semData] : [])
          const firstMsg = semItems[0] || (typeof semData === 'object' ? semData : null)
          const success = semRes.ok && Boolean(firstMsg?.message_id || firstMsg?.status === 'Pending' || firstMsg?.status === 'Queued')

          if (success) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              data: semData,
              message_id: firstMsg?.message_id,
              network: firstMsg?.network,
              status: firstMsg?.status || 'Pending',
            }))
          } else {
            const errMsg = Array.isArray(semData) && semData[0]?.senderName
              ? semData[0].senderName
              : (semData?.error || (typeof semData === 'string' ? semData : 'Semaphore rejected message delivery'))
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: false,
              error: errMsg,
              data: semData,
            }))
          }
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Internal error' }))
            return
          }
        }

        // 4. Catalog Admin Management Endpoint
        if (url === '/api/catalog-admin') {
          const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wldhvmbcvjbnwkgiafpg.supabase.co'
          const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
          const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey

          if (req.method === 'GET') {
            try {
              const [pkgRes, menuRes, addonRes] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/packages?select=*&order=base_price.asc`, {
                  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
                }),
                fetch(`${supabaseUrl}/rest/v1/menu_items?select=*&order=sort_order.asc`, {
                  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
                }),
                fetch(`${supabaseUrl}/rest/v1/package_addons?select=*&order=price.asc`, {
                  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
                }),
              ])
              const packages = pkgRes.ok ? await pkgRes.json() : []
              const menuItems = menuRes.ok ? await menuRes.json() : []
              const addons = addonRes.ok ? await addonRes.json() : []

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, packages, menuItems, addons }))
              return
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message || 'Failed to fetch catalog' }))
              return
            }
          }

          if (req.method === 'POST') {
            try {
              const body = await readJsonBody()
              const action = body.action

              const dbFetch = async (path: string, options: any = {}) => {
                const customHeaders = { ...(options.headers || {}) }
                delete customHeaders['Authorization']
                delete customHeaders['authorization']
                delete customHeaders['apikey']
                return fetch(`${supabaseUrl}/rest/v1/${path}`, {
                  ...options,
                  headers: {
                    'Content-Type': 'application/json',
                    ...customHeaders,
                    apikey: serviceKey,
                    Authorization: `Bearer ${serviceKey}`,
                  },
                })
              }

              if (action === 'save_package') {
                const pkg = body.package
                if (!pkg || !pkg.id || !pkg.name) {
                  res.statusCode = 400
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Package ID and name are required' }))
                  return
                }
                const tiers = Array.isArray(pkg.tiers) ? pkg.tiers : []
                const details = {
                  inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
                  entertainment: Array.isArray(pkg.entertainment) ? pkg.entertainment : [],
                  freebies: Array.isArray(pkg.freebies) ? pkg.freebies : [],
                  image_url: pkg.imageUrl || pkg.details?.image_url || '',
                  service_area: pkg.details?.service_area || 'Within City of Baliwag area',
                  food_buffer_pax: Number(pkg.details?.food_buffer_pax || 10),
                  ...(pkg.details || {}),
                }
                if (pkg.imageUrl) details.image_url = pkg.imageUrl

                const payload = {
                  id: String(pkg.id).trim(),
                  name: String(pkg.name).trim(),
                  ideal_for: String(pkg.bestFor || pkg.description || '').trim(),
                  included_menu: details.inclusions,
                  default_pax: Number(pkg.defaultPax ?? tiers[0]?.pax ?? 50),
                  price_per_head: pkg.pricePerHead !== undefined && pkg.pricePerHead !== null ? Number(pkg.pricePerHead) : null,
                  currency: 'PHP',
                  base_price: Number(pkg.basePrice ?? tiers[0]?.price ?? 0),
                  tier_prices: tiers,
                  details,
                }
                const r = await dbFetch('packages', {
                  method: 'POST',
                  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
                  body: JSON.stringify(payload),
                })
                const saved: any = r.ok ? await r.json() : [payload]
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, package: saved[0] || payload }))
                return
              }

              if (action === 'delete_package') {
                const packageId = body.packageId
                await dbFetch(`packages?id=eq.${encodeURIComponent(packageId)}`, {
                  method: 'DELETE',
                })
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, deletedId: packageId }))
                return
              }

              if (action === 'save_menu_item') {
                const item = body.menuItem
                const id = item.id || `menu-${item.category}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
                const payload = {
                  id: String(id).trim(),
                  name: String(item.name).trim(),
                  category: item.category,
                  description: String(item.description || '').trim(),
                  image_url: item.imageUrl || item.image_url || null,
                  tag: item.tag || null,
                  color: item.color || null,
                  accent_color: item.accentColor || item.accent_color || null,
                  active: item.active !== false,
                  sort_order: Number(item.sortOrder ?? item.sort_order ?? 0),
                  updated_at: new Date().toISOString(),
                }
                const r = await dbFetch('menu_items', {
                  method: 'POST',
                  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
                  body: JSON.stringify(payload),
                })
                const saved: any = r.ok ? await r.json() : [payload]
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, menuItem: saved[0] || payload }))
                return
              }

              if (action === 'toggle_menu_item_active') {
                const itemId = body.itemId
                const active = Boolean(body.active)
                const r = await dbFetch(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
                  method: 'PATCH',
                  headers: { Prefer: 'return=representation' },
                  body: JSON.stringify({ active, updated_at: new Date().toISOString() }),
                })
                const updated: any = r.ok ? await r.json() : [{ id: itemId, active }]
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, menuItem: updated[0] }))
                return
              }

              if (action === 'delete_menu_item') {
                const itemId = body.itemId
                await dbFetch(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
                  method: 'DELETE',
                })
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, deletedId: itemId }))
                return
              }

              if (action === 'save_addon') {
                const addon = body.addon
                const id = addon.id || `ADD-${addon.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString().slice(-2)}`
                const payload = {
                  id: String(id).trim(),
                  name: String(addon.name).trim(),
                  price: Number(addon.price) || 0,
                  currency: 'PHP',
                  rate_type: addon.rateType === 'per_head' ? 'per_head' : 'flat',
                  description: addon.description ? String(addon.description).trim() : null,
                }
                const r = await dbFetch('package_addons', {
                  method: 'POST',
                  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
                  body: JSON.stringify(payload),
                })
                const saved: any = r.ok ? await r.json() : [payload]
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, addon: saved[0] || payload }))
                return
              }

              if (action === 'delete_addon') {
                const addonId = body.addonId
                await dbFetch(`package_addons?id=eq.${encodeURIComponent(addonId)}`, {
                  method: 'DELETE',
                })
                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, deletedId: addonId }))
                return
              }

              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `Unknown action: ${action}` }))
              return
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message || 'Internal catalog error' }))
              return
            }
          }
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiServerPlugin(env)],
  }
})

