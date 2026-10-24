import { supabase } from './supabase'
import type { CateringAddon } from '../data/packages'
import type { MenuItem } from '../types'
import {
  MAIN_DISHES,
  PASTA_DISHES,
  DISH_DETAILS,
  DRINK_OPTIONS,
  DRINK_DETAILS,
} from '../data/packages'

export const FALLBACK_MENU_ITEMS: MenuItem[] = [
  ...MAIN_DISHES.map((name, idx) => ({
    id: `menu-main-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name,
    category: 'main' as const,
    description: DISH_DETAILS[name]?.description || '',
    imageUrl: DISH_DETAILS[name]?.image || null,
    tag: DISH_DETAILS[name]?.tag || 'Main Dish',
    active: true,
    sortOrder: (idx + 1) * 10,
  })),
  ...PASTA_DISHES.map((name, idx) => ({
    id: `menu-pasta-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name,
    category: 'pasta' as const,
    description: DISH_DETAILS[name]?.description || '',
    imageUrl: DISH_DETAILS[name]?.image || null,
    tag: DISH_DETAILS[name]?.tag || 'Pasta',
    active: true,
    sortOrder: (idx + 1) * 10,
  })),
  ...DRINK_OPTIONS.map((name, idx) => ({
    id: `menu-drink-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name,
    category: 'drink' as const,
    description: DRINK_DETAILS[name]?.description || '',
    imageUrl: DRINK_DETAILS[name]?.image || null,
    tag: DRINK_DETAILS[name]?.tag || 'Beverage',
    color: DRINK_DETAILS[name]?.color || null,
    accentColor: DRINK_DETAILS[name]?.accentColor || null,
    active: true,
    sortOrder: (idx + 1) * 10,
  })),
]

export const mapDbMenuItem = (row: any): MenuItem => ({
  id: row.id,
  name: row.name,
  category: row.category,
  description: row.description || '',
  imageUrl: row.image_url || null,
  tag: row.tag || null,
  color: row.color || null,
  accentColor: row.accent_color || null,
  active: row.active !== false,
  sortOrder: Number(row.sort_order) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const mapDbAddon = (row: any): CateringAddon => ({
  id: row.id,
  name: row.name,
  price: Number(row.price) || 0,
  currency: 'PHP',
  rateType: row.rate_type === 'per_head' ? 'per_head' : 'flat',
  description: row.description || undefined,
})

const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('sinag_session_token') || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export async function apiCatalogRequest(action: string, payload: any = {}): Promise<{ success: boolean; data?: any; error?: string }> {
  const headers = getAuthHeaders()
  const rawUser = sessionStorage.getItem('sinag_local_user')
  let adminUserId = ''
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser)
      if (parsed.role === 'admin') adminUserId = parsed.id
    } catch {
      // ignore
    }
  }

  const bodyData = {
    action,
    adminUserId,
    ...payload,
  }

  // 1. Try local dev endpoint first if running on local vite dev server
  try {
    const res = await fetch('/api/catalog-admin', {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    })
    if (res.ok) {
      const data = await res.json()
      return { success: true, data }
    }
  } catch {
    // Local endpoint not responding; proceed to Supabase function or direct
  }

  // 2. Try Supabase Edge Function catalog-admin
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseAnon) {
    try {
      const edgeRes = await fetch(`${supabaseUrl}/functions/v1/catalog-admin`, {
        method: 'POST',
        headers: {
          ...headers,
          apikey: supabaseAnon,
        },
        body: JSON.stringify(bodyData),
      })
      if (edgeRes.ok) {
        const data = await edgeRes.json()
        return { success: true, data }
      }
    } catch {
      // Edge function failed or not deployed; fallback to direct DB if authenticated
    }
  }

  // 3. Fallback to Supabase client directly
  if (supabase) {
    try {
      if (action === 'save_package' && payload.package) {
        const pkg = payload.package
        const tiers = Array.isArray(pkg.tiers) ? pkg.tiers : []
        const details = {
          inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
          entertainment: Array.isArray(pkg.entertainment) ? pkg.entertainment : [],
          freebies: Array.isArray(pkg.freebies) ? pkg.freebies : [],
          image_url: pkg.imageUrl || pkg.details?.image_url || '',
          service_area: pkg.details?.service_area || 'Within City of Baliwag area',
          food_buffer_pax: Number(pkg.details?.food_buffer_pax || 10),
        }
        const dbPkg = {
          id: pkg.id,
          name: pkg.name,
          ideal_for: pkg.bestFor || pkg.description || '',
          included_menu: details.inclusions,
          default_pax: pkg.defaultPax || tiers[0]?.pax || 50,
          price_per_head: pkg.pricePerHead ?? null,
          currency: 'PHP',
          base_price: pkg.basePrice ?? tiers[0]?.price ?? 0,
          tier_prices: tiers,
          details,
        }
        const { data, error } = await supabase.from('packages').upsert(dbPkg).select().single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: { package: data } }
      }

      if (action === 'delete_package' && payload.packageId) {
        const { error } = await supabase.from('packages').delete().eq('id', payload.packageId)
        if (error) return { success: false, error: error.message }
        return { success: true, data: { deletedId: payload.packageId } }
      }

      if (action === 'save_menu_item' && payload.menuItem) {
        const item = payload.menuItem
        const dbItem = {
          id: item.id || `menu-${item.category}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: item.name,
          category: item.category,
          description: item.description || '',
          image_url: item.imageUrl || null,
          tag: item.tag || null,
          color: item.color || null,
          accent_color: item.accentColor || null,
          active: item.active !== false,
          sort_order: item.sortOrder || 0,
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase.from('menu_items').upsert(dbItem).select().single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: { menuItem: data } }
      }

      if (action === 'toggle_menu_item_active' && payload.itemId) {
        const { data, error } = await supabase
          .from('menu_items')
          .update({ active: Boolean(payload.active), updated_at: new Date().toISOString() })
          .eq('id', payload.itemId)
          .select()
          .single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: { menuItem: data } }
      }

      if (action === 'delete_menu_item' && payload.itemId) {
        const { error } = await supabase.from('menu_items').delete().eq('id', payload.itemId)
        if (error) return { success: false, error: error.message }
        return { success: true, data: { deletedId: payload.itemId } }
      }

      if (action === 'save_addon' && payload.addon) {
        const addon = payload.addon
        const dbAddon = {
          id: addon.id || `ADD-${addon.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString().slice(-2)}`,
          name: addon.name,
          price: Number(addon.price) || 0,
          currency: 'PHP',
          rate_type: addon.rateType === 'per_head' ? 'per_head' : 'flat',
          description: addon.description || null,
        }
        const { data, error } = await supabase.from('package_addons').upsert(dbAddon).select().single()
        if (error) return { success: false, error: error.message }
        return { success: true, data: { addon: data } }
      }

      if (action === 'delete_addon' && payload.addonId) {
        const { error } = await supabase.from('package_addons').delete().eq('id', payload.addonId)
        if (error) return { success: false, error: error.message }
        return { success: true, data: { deletedId: payload.addonId } }
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Database update failed' }
    }
  }

  return { success: false, error: 'Catalog endpoint unavailable' }
}
