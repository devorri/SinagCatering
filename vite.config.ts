import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

function apiServerPlugin(): Plugin {
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

        // 3. Dispatch Semaphore SMS
        if (url === '/api/sms/send' && req.method === 'POST') {
          try {
            const body = await readJsonBody()
            const apiKey = process.env.VITE_SEMAPHORE_API_KEY || 'f18fe7eb9f2f4b5477776b98d8b55565'
            // Unregistered custom sender names are filtered/dropped by Philippine carrier firewalls.
            // Semaphore default pool 'SEMAPHORE' delivers reliably to all Philippine mobile networks.
            let effectiveSender = (process.env.VITE_SEMAPHORE_SENDER_NAME || '').trim()
            if (!effectiveSender || effectiveSender.toLowerCase() === 'sinagscater') {
              effectiveSender = 'SEMAPHORE'
            }

            const phone = (body.recipientPhone || '').replace(/[^0-9+]/g, '')
            const message = (body.message || '').trim()

            if (!phone || !message) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Phone and message are required' }))
              return
            }

            // Semaphore requires standard format (e.g. 09171234567)
            let formattedPhone = phone
            if (formattedPhone.startsWith('+63')) formattedPhone = '0' + formattedPhone.slice(3)
            else if (formattedPhone.startsWith('63') && formattedPhone.length === 12) formattedPhone = '0' + formattedPhone.slice(2)

            const paramsObj: Record<string, string> = {
              apikey: apiKey,
              number: formattedPhone,
              message,
            }
            if (effectiveSender) {
              paramsObj.sendername = effectiveSender
            }

            const params = new URLSearchParams(paramsObj)

            const semRes = await fetch('https://api.semaphore.co/api/v4/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString(),
            })

            const semData = await semRes.json()
            const success = semRes.ok && Array.isArray(semData) && semData.some((item: any) => item.status === 'Queued' || item.status === 'Pending')
            const firstMsg = Array.isArray(semData) ? semData[0] : null

            res.statusCode = (success || semRes.ok) ? 200 : 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: Boolean(success || semRes.ok),
              data: semData,
              message_id: firstMsg?.message_id,
              network: firstMsg?.network,
              status: firstMsg?.status || (success ? 'Queued' : 'Failed'),
            }))
            return
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'Internal error' }))
            return
          }
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiServerPlugin()],
})

