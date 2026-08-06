import { createClient } from '@supabase/supabase-js'

export type CateringInquiry = {
  customer_name: string
  email: string
  phone: string
  event_type: string
  event_date: string | null
  guest_count: number
  package_name: string
  venue_location: string
  notes: string
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null

export async function createInquiry(inquiry: CateringInquiry) {
  if (!supabase) {
    const stored = JSON.parse(localStorage.getItem('sinag-preview-inquiries') ?? '[]')
    localStorage.setItem(
      'sinag-preview-inquiries',
      JSON.stringify([{ ...inquiry, created_at: new Date().toISOString() }, ...stored]),
    )
    return { error: null, preview: true }
  }

  const { error } = await supabase.from('catering_inquiries').insert(inquiry)

  return {
    error: error?.message ?? null,
    preview: false,
  }
}
