declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

export {}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
const sha256 = async (value: string) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))

const getConfig = () => ({
  projectUrl: Deno.env.get('SUPABASE_URL'),
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
})

const databaseRequest = async (path: string, init?: RequestInit) => {
  const { projectUrl, serviceRoleKey } = getConfig()
  if (!projectUrl || !serviceRoleKey) throw new Error('Database connection is not configured')
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

// Authenticate caller: Must be an authenticated user with role = 'admin'
const verifyAdminUser = async (request: Request, body?: Record<string, unknown>): Promise<{ isAdmin: boolean; error?: string }> => {
  const authHeader = request.headers.get('authorization')
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const token = bearerToken || (typeof body?.token === 'string' ? body.token.trim() : '')
  const adminUserId = typeof body?.adminUserId === 'string' ? body.adminUserId.trim() : ''

  if (!token && !adminUserId) {
    return { isAdmin: false, error: 'Authentication required. Missing token or admin credentials.' }
  }

  try {
    const { projectUrl } = getConfig()
    if (!projectUrl) return { isAdmin: false, error: 'Database service unavailable' }

    // Case 1: Check session token in user_sessions if token is a standard hashed token
    if (token && token.length >= 20 && !token.startsWith('user-session-')) {
      const tokenHash = await sha256(token)
      const sessionsUrl = new URL(`${projectUrl}/rest/v1/user_sessions`)
      sessionsUrl.searchParams.set('token_hash', `eq.${tokenHash}`)
      sessionsUrl.searchParams.set('expires_at', `gt.${new Date().toISOString()}`)
      sessionsUrl.searchParams.set('revoked_at', 'is.null')
      sessionsUrl.searchParams.set('select', 'id,user_id')

      const sessionRes = await databaseRequest(sessionsUrl.toString().replace(`${projectUrl}/rest/v1/`, ''))
      if (sessionRes.ok) {
        const sessions = await sessionRes.json()
        if (sessions && sessions.length > 0) {
          const userId = sessions[0].user_id
          const userUrl = new URL(`${projectUrl}/rest/v1/users`)
          userUrl.searchParams.set('id', `eq.${userId}`)
          userUrl.searchParams.set('select', 'id,role')
          const userRes = await databaseRequest(userUrl.toString().replace(`${projectUrl}/rest/v1/`, ''))
          if (userRes.ok) {
            const users = await userRes.json()
            if (users && users[0]?.role === 'admin') {
              return { isAdmin: true }
            }
          }
        }
      }
    }

    // Case 2: Verification by user ID (from token `user-session-<uuid>` or adminUserId)
    const targetUserId = adminUserId || (token.startsWith('user-session-') ? token.replace('user-session-', '') : '')
    if (targetUserId) {
      const userUrl = new URL(`${projectUrl}/rest/v1/users`)
      userUrl.searchParams.set('id', `eq.${targetUserId}`)
      userUrl.searchParams.set('select', 'id,role')
      const userRes = await databaseRequest(userUrl.toString().replace(`${projectUrl}/rest/v1/`, ''))
      if (userRes.ok) {
        const users = await userRes.json()
        if (users && users[0]?.role === 'admin') {
          return { isAdmin: true }
        }
      }
    }

    return { isAdmin: false, error: 'Unauthorized: User does not possess administrator privileges.' }
  } catch (err: any) {
    return { isAdmin: false, error: err.message || 'Authentication check failed' }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // GET: Public or admin read of packages, menu items, addons
  if (request.method === 'GET') {
    try {
      const [packagesRes, menuRes, addonsRes] = await Promise.all([
        databaseRequest('packages?select=*&order=base_price.asc'),
        databaseRequest('menu_items?select=*&order=sort_order.asc'),
        databaseRequest('package_addons?select=*&order=price.asc'),
      ])

      const packages = packagesRes.ok ? await packagesRes.json() : []
      const menuItems = menuRes.ok ? await menuRes.json() : []
      const addons = addonsRes.ok ? await addonsRes.json() : []

      return jsonResponse({
        success: true,
        packages,
        menuItems,
        addons,
      })
    } catch (err: any) {
      return jsonResponse({ error: err.message || 'Failed to fetch catalog' }, 500)
    }
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected valid JSON in request body' }, 400)
  }

  // Verify Admin authorization for all mutations
  const auth = await verifyAdminUser(request, body)
  if (!auth.isAdmin) {
    return jsonResponse({ error: auth.error || 'Admin authentication required' }, 403)
  }

  const action = body.action

  try {
    // -------------------------------------------------------------------------
    // ACTION: save_package
    // -------------------------------------------------------------------------
    if (action === 'save_package') {
      const pkg = body.package
      if (!pkg || !pkg.id || !pkg.name) {
        return jsonResponse({ error: 'Package ID and name are required' }, 400)
      }

      const tiers = Array.isArray(pkg.tiers) ? pkg.tiers : []
      const basePrice = Number(pkg.basePrice ?? tiers[0]?.price ?? 0)
      const defaultPax = Number(pkg.defaultPax ?? tiers[0]?.pax ?? 50)
      const pricePerHead = pkg.pricePerHead !== undefined && pkg.pricePerHead !== null ? Number(pkg.pricePerHead) : null

      const details = {
        inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
        entertainment: Array.isArray(pkg.entertainment) ? pkg.entertainment : [],
        freebies: Array.isArray(pkg.freebies) ? pkg.freebies : [],
        service_area: pkg.details?.service_area || 'Within City of Baliwag area',
        food_buffer_pax: Number(pkg.details?.food_buffer_pax || 10),
      }

      const payload = {
        id: String(pkg.id).trim(),
        name: String(pkg.name).trim(),
        ideal_for: String(pkg.bestFor || pkg.description || '').trim(),
        included_menu: details.inclusions,
        default_pax: defaultPax,
        price_per_head: pricePerHead,
        currency: 'PHP',
        base_price: basePrice,
        tier_prices: tiers,
        details,
      }

      const res = await databaseRequest('packages', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return jsonResponse({ error: `Failed to save package: ${errorText}` }, 500)
      }

      const saved = await res.json()
      return jsonResponse({ success: true, package: saved[0] || payload })
    }

    // -------------------------------------------------------------------------
    // ACTION: delete_package
    // -------------------------------------------------------------------------
    if (action === 'delete_package') {
      const packageId = body.packageId
      if (!packageId) return jsonResponse({ error: 'packageId is required' }, 400)

      const res = await databaseRequest(`packages?id=eq.${encodeURIComponent(packageId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      })

      if (!res.ok) {
        return jsonResponse({ error: 'Failed to delete package' }, 500)
      }
      return jsonResponse({ success: true, deletedId: packageId })
    }

    // -------------------------------------------------------------------------
    // ACTION: save_menu_item
    // -------------------------------------------------------------------------
    if (action === 'save_menu_item') {
      const item = body.menuItem
      if (!item || !item.name || !item.category) {
        return jsonResponse({ error: 'Menu item name and category (main, pasta, drink) are required' }, 400)
      }

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

      const res = await databaseRequest('menu_items', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return jsonResponse({ error: `Failed to save menu item: ${errorText}` }, 500)
      }

      const saved = await res.json()
      return jsonResponse({ success: true, menuItem: saved[0] || payload })
    }

    // -------------------------------------------------------------------------
    // ACTION: toggle_menu_item_active
    // -------------------------------------------------------------------------
    if (action === 'toggle_menu_item_active') {
      const itemId = body.itemId
      const active = Boolean(body.active)
      if (!itemId) return jsonResponse({ error: 'itemId is required' }, 400)

      const res = await databaseRequest(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ active, updated_at: new Date().toISOString() }),
      })

      if (!res.ok) {
        return jsonResponse({ error: 'Failed to update item availability' }, 500)
      }

      const updated = await res.json()
      return jsonResponse({ success: true, menuItem: updated[0] })
    }

    // -------------------------------------------------------------------------
    // ACTION: delete_menu_item
    // -------------------------------------------------------------------------
    if (action === 'delete_menu_item') {
      const itemId = body.itemId
      if (!itemId) return jsonResponse({ error: 'itemId is required' }, 400)

      const res = await databaseRequest(`menu_items?id=eq.${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      })

      if (!res.ok) {
        return jsonResponse({ error: 'Failed to delete menu item' }, 500)
      }
      return jsonResponse({ success: true, deletedId: itemId })
    }

    // -------------------------------------------------------------------------
    // ACTION: save_addon
    // -------------------------------------------------------------------------
    if (action === 'save_addon') {
      const addon = body.addon
      if (!addon || !addon.name || addon.price === undefined) {
        return jsonResponse({ error: 'Add-on name and price are required' }, 400)
      }

      const id = addon.id || `ADD-${addon.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString().slice(-2)}`
      const payload = {
        id: String(id).trim(),
        name: String(addon.name).trim(),
        price: Number(addon.price) || 0,
        currency: 'PHP',
        rate_type: addon.rateType === 'per_head' ? 'per_head' : 'flat',
        description: addon.description ? String(addon.description).trim() : null,
      }

      const res = await databaseRequest('package_addons', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        return jsonResponse({ error: `Failed to save add-on: ${errorText}` }, 500)
      }

      const saved = await res.json()
      return jsonResponse({ success: true, addon: saved[0] || payload })
    }

    // -------------------------------------------------------------------------
    // ACTION: delete_addon
    // -------------------------------------------------------------------------
    if (action === 'delete_addon') {
      const addonId = body.addonId
      if (!addonId) return jsonResponse({ error: 'addonId is required' }, 400)

      const res = await databaseRequest(`package_addons?id=eq.${encodeURIComponent(addonId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
      })

      if (!res.ok) {
        return jsonResponse({ error: 'Failed to delete add-on' }, 500)
      }
      return jsonResponse({ success: true, deletedId: addonId })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'Catalog admin operation failed' }, 500)
  }
})
