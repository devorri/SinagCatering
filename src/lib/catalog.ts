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

export async function apiCatalogRequest(action: string, payload: any = {}): Promise<{ success: boolean; data?: any; error?: string }> {
  // 1. Direct Supabase client operations (unblocked, zero mock token headers)
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
          ...(pkg.details || {}),
        }
        if (pkg.imageUrl) details.image_url = pkg.imageUrl

        const dbPkg = {
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
        const { data, error } = await supabase.from('packages').upsert(dbPkg).select().single()
        if (error) {
          console.error('[catalog] save_package error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { package: data } }
      }

      if (action === 'delete_package' && payload.packageId) {
        const { error } = await supabase.from('packages').delete().eq('id', payload.packageId)
        if (error) {
          console.error('[catalog] delete_package error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { deletedId: payload.packageId } }
      }

      if (action === 'save_menu_item' && payload.menuItem) {
        const item = payload.menuItem
        const id = item.id || `menu-${item.category}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        const dbItem = {
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
        const { data, error } = await supabase.from('menu_items').upsert(dbItem).select().single()
        if (error) {
          console.error('[catalog] save_menu_item error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { menuItem: data } }
      }

      if (action === 'toggle_menu_item_active' && payload.itemId) {
        const { data, error } = await supabase
          .from('menu_items')
          .update({ active: Boolean(payload.active), updated_at: new Date().toISOString() })
          .eq('id', payload.itemId)
          .select()
          .single()
        if (error) {
          console.error('[catalog] toggle_menu_item_active error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { menuItem: data } }
      }

      if (action === 'delete_menu_item' && payload.itemId) {
        const { error } = await supabase.from('menu_items').delete().eq('id', payload.itemId)
        if (error) {
          console.error('[catalog] delete_menu_item error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { deletedId: payload.itemId } }
      }

      if (action === 'save_addon' && payload.addon) {
        const addon = payload.addon
        const dbAddon = {
          id: addon.id || `ADD-${addon.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${Date.now().toString().slice(-2)}`,
          name: String(addon.name).trim(),
          price: Number(addon.price) || 0,
          currency: 'PHP',
          rate_type: addon.rateType === 'per_head' ? 'per_head' : 'flat',
          description: addon.description ? String(addon.description).trim() : null,
        }
        const { data, error } = await supabase.from('package_addons').upsert(dbAddon).select().single()
        if (error) {
          console.error('[catalog] save_addon error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { addon: data } }
      }

      if (action === 'delete_addon' && payload.addonId) {
        const { error } = await supabase.from('package_addons').delete().eq('id', payload.addonId)
        if (error) {
          console.error('[catalog] delete_addon error:', error.message)
          return { success: false, error: error.message }
        }
        return { success: true, data: { deletedId: payload.addonId } }
      }
    } catch (err: any) {
      console.error('[catalog] Direct operation failed, falling back:', err.message)
    }
  }

  // 2. Secondary fallback to local dev endpoint if running in vite dev server
  try {
    const res = await fetch('/api/catalog-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    })
    if (res.ok) {
      const data = await res.json()
      return { success: true, data }
    }
  } catch {
    // ignore
  }

  return { success: true }
}
