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

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const sha256 = async (value: string) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))

const config = () => ({
  projectUrl: Deno.env.get('SUPABASE_URL'),
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
})

const databaseRequest = async (path: string, init?: RequestInit) => {
  const { projectUrl, serviceRoleKey } = config()
  if (!projectUrl || !serviceRoleKey) throw new Error('Server database is not configured')
  return fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}

const rateLimit = async (request: Request, action: 'login' | 'register', email: string) => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor?.split(',').map((part) => part.trim()).at(-1)
  const { projectUrl, serviceRoleKey } = config()
  if (!clientIp || !projectUrl || !serviceRoleKey) return false
  const keyHash = await sha256(`table-auth:${action}:${clientIp}:${email}`)
  const result = await fetch(`${projectUrl}/rest/v1/rpc/consume_api_rate_limit`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key_hash: keyHash,
      request_limit: action === 'login' ? 10 : 3,
      window_seconds: 900,
    }),
  })
  return result.ok && await result.json() === true
}

const safeUser = (row: Record<string, unknown>) => ({
  id: row.id,
  email: row.email,
  name: row.full_name,
  phone: row.phone,
  role: row.role,
})

const issueSession = async (userId: string) => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const tokenHash = await sha256(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
  const result = await databaseRequest('user_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt }),
  })
  if (!result.ok) throw new Error('Could not create a session')
  return token
}

const getBearerToken = (request: Request, body: Record<string, unknown>) => {
  const header = request.headers.get('authorization')
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1]
  return token || (typeof body.token === 'string' ? body.token : '')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return response({ error: 'Expected a JSON request body' }, 400)
  }

  const { projectUrl, serviceRoleKey } = config()
  if (!projectUrl || !serviceRoleKey) return response({ error: 'Account service is not configured.' }, 503)

  const action = body.action
  if (action === 'register' || action === 'login') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 256) {
      return response({ error: 'Enter a valid email and a password with at least 8 characters.' }, 400)
    }

    try {
      if (!await rateLimit(request, action, email)) return response({ error: 'Too many account requests. Try again later.' }, 429)

      const usersUrl = new URL(`${config().projectUrl}/rest/v1/users`)
      usersUrl.searchParams.set('email', `eq.${email}`)
      usersUrl.searchParams.set('select', 'id,email,full_name,phone,role,password')
      const lookup = await databaseRequest(usersUrl.toString().replace(`${config().projectUrl}/rest/v1/`, ''))
      if (!lookup.ok) return response({ error: 'Account service is unavailable.' }, 503)
      const users = await lookup.json()
      let user = users[0] as Record<string, unknown> | undefined

      if (action === 'register') {
        if (user) return response({ error: 'An account with this email already exists.' }, 409)
        const fullName = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : ''
        const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 32) : ''
        if (!fullName) return response({ error: 'Full name is required.' }, 400)
        const insert = await databaseRequest('users', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ email, full_name: fullName, phone: phone || null, password, role: 'client' }),
        })
        if (!insert.ok) return response({ error: 'Could not create account.' }, 503)
        const createdUsers = await insert.json()
        user = createdUsers[0]
      } else if (!user || typeof user.password !== 'string' || password !== user.password) {
        return response({ error: 'Email or password is incorrect.' }, 401)
      }

      if (!user) return response({ error: 'Account could not be loaded.' }, 503)
      const token = await issueSession(String(user.id))
      return response({ user: safeUser(user), token })
    } catch {
      return response({ error: 'Account service is temporarily unavailable.' }, 503)
    }
  }

  if (action === 'session' || action === 'logout') {
    const token = getBearerToken(request, body)
    if (token.length < 32 || token.length > 256) return response({ error: 'Sign-in required.' }, 401)
    const tokenHash = await sha256(token)
    const sessionsUrl = new URL(`${config().projectUrl}/rest/v1/user_sessions`)
    sessionsUrl.searchParams.set('token_hash', `eq.${tokenHash}`)
    sessionsUrl.searchParams.set('expires_at', `gt.${new Date().toISOString()}`)
    sessionsUrl.searchParams.set('revoked_at', 'is.null')
    sessionsUrl.searchParams.set('select', 'id,user_id')
    try {
      const sessionResponse = await databaseRequest(sessionsUrl.toString().replace(`${config().projectUrl}/rest/v1/`, ''))
      const sessions = sessionResponse.ok ? await sessionResponse.json() : []
      const session = sessions[0]
      if (!session) return response({ error: 'Session expired. Sign in again.' }, 401)

      if (action === 'logout') {
        await databaseRequest(`user_sessions?id=eq.${session.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        })
        return response({ success: true })
      }

      const userUrl = new URL(`${config().projectUrl}/rest/v1/users`)
      userUrl.searchParams.set('id', `eq.${session.user_id}`)
      userUrl.searchParams.set('select', 'id,email,full_name,phone,role')
      const userResponse = await databaseRequest(userUrl.toString().replace(`${config().projectUrl}/rest/v1/`, ''))
      const users = userResponse.ok ? await userResponse.json() : []
      if (!users[0]) return response({ error: 'Account no longer exists.' }, 401)
      return response({ user: safeUser(users[0]) })
    } catch {
      return response({ error: 'Session service is temporarily unavailable.' }, 503)
    }
  }

  return response({ error: 'Unknown account action.' }, 400)
})
