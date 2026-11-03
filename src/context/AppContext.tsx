import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type {
  User,
  Booking,
  Review,
  Staff,
  Inquiry,
  AdminNotification,
  MenuItem,
  CateringAddon,
  ClientNotification,
  CustomerAccount,
} from '../types'
import { supabase } from '../lib/supabase'
import { mapDatabasePackage, formatMoney, STORAGE_FILES_BASE } from '../data/packages'
import type { CateringPackage } from '../data/packages'
import {
  mapDbMenuItem,
  mapDbAddon,
  apiCatalogRequest,
} from '../lib/catalog'
import {
  sendBookingSubmissionNotifications,
  sendPaymentVerificationNotifications,
  sendPasswordResetEmailOTP,
  sendPasswordResetSMSOTP,
  normalizePhPhoneNumber,
  sendSemaphoreSMS,
  sendTransactionalEmail,
} from '../lib/notifications'
import {
  ADMIN_ALERT_PHONE,
  EVENT_REMINDER_DAYS,
  RESERVATION_FEE,
  RESERVE_HOLD_MS,
  computeRefundQuote,
  daysUntilEvent,
  getPaymentTerm,
  isBookingOccupyingDate,
  isHoldExpired,
  isReserveHold,
} from '../lib/bookingRules'
import { TERMS_VERSION, getLocalTermsAcceptance, setLocalTermsAcceptance } from '../lib/terms'
import { playNotificationSound } from '../lib/sound'
import { getPasswordValidationError } from '../components/PasswordStrengthIndicator'

export const maskEmail = (email: string): string => {
  const parts = email.split('@')
  if (parts.length !== 2) return email
  const name = parts[0]
  const domain = parts[1]
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`
  }
  return `${name[0]}${name[1]}***${name[name.length - 1]}@${domain}`
}

export const maskPhone = (phone: string): string => {
  const clean = phone.replace(/[^0-9]/g, '')
  if (clean.length < 10) return phone
  if (clean.startsWith('63') && clean.length === 12) {
    return `+63 ${clean.slice(2, 5)} ••• ${clean.slice(-4)}`
  }
  if (clean.startsWith('09') && clean.length === 11) {
    return `${clean.slice(0, 4)} ••• ${clean.slice(-4)}`
  }
  return `${clean.slice(0, 4)} ••• ${clean.slice(-4)}`
}

interface AppContextType {
  currentUser: User | null
  packages: CateringPackage[]
  menuItems: MenuItem[]
  addons: CateringAddon[]
  bookings: Booking[]
  reviews: Review[]
  staff: Staff[]
  blockedDates: string[]
  inquiries: Inquiry[]
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }>
  signUp: (name: string, email: string, phone: string, password: string) => Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }>
  logout: () => Promise<void>
  signInWithGoogle: (returnView?: 'client' | 'booking') => Promise<{ error: string | null }>
  googleAuth: { status: 'idle' | 'redirecting' | 'finishing' | 'error'; message: string }
  clearGoogleAuthMessage: () => void
  requestPasswordResetOTP: (identifier: string, method: 'email' | 'sms') => Promise<{ success: boolean; maskedTarget?: string; error?: string; simulatedOtp?: string }>
  verifyAndResetPassword: (otpCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  updateUserProfile: (name: string, phone: string) => Promise<{ success: boolean; error?: string }>
  createBooking: (
    bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds'> & { proofOfPaymentUrl?: string | null },
    bookingId?: string,
    options?: { paidOnline?: boolean },
  ) => Booking
  uploadPayment: (
    bookingId: string,
    proofUrl: string,
    refNumber?: string,
    options?: { amount?: number; paymentTerm?: 'downpayment' | 'full' | 'reserve' },
  ) => void
  cancelBooking: (
    bookingId: string,
    reason: string,
    notes?: string,
  ) => { refundPercentage: number; refundAmount: number; refundStatus: 'pending' | 'not_applicable' }
  markRefundProcessed: (bookingId: string) => void
  clientNotifications: ClientNotification[]
  markClientNotificationRead: (id: string) => void
  markAllClientNotificationsRead: () => void
  needsTermsAcceptance: boolean
  acceptTerms: () => Promise<void>
  fetchCustomers: () => Promise<CustomerAccount[]>
  rebookEvent: (bookingId: string, newDate: string) => { success: boolean; message: string }
  addReview: (rating: number, comment: string, imageUrl: string | null) => void
  replyReview: (reviewId: string, reply: string) => void
  deleteReview: (reviewId: string) => void
  allocateStaff: (bookingId: string, staffIds: string[], assignedServices?: string[]) => void
  addStaff: (staffData: Omit<Staff, 'id' | 'status'>) => Promise<Staff>
  removeStaff: (staffId: string) => Promise<void>
  blockDate: (date: string) => void
  unblockDate: (date: string) => void
  respondInquiry: (inquiryId: string, replyText: string) => void
  createInquiryDirect: (name: string, email: string, message: string) => void
  updateBookingStatus: (bookingId: string, bookingStatus: Booking['bookingStatus'], paymentStatus?: Booking['paymentStatus']) => void
  updatePaymentStatus: (bookingId: string, paymentStatus: Booking['paymentStatus'], amount?: number) => void
  verifyDownpaymentBooking: (bookingId: string, verifiedAmount?: number) => void
  notifyUsers: (emails: string[], subject: string, message: string) => void
  adminNotifications: AdminNotification[]
  markNotificationAsRead: (id: string) => void
  markAllNotificationsAsRead: () => void
  clearAdminNotifications: () => void
  addAdminNotification: (notif: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => void
  playNotificationSound: () => void
  savePackage: (pkg: CateringPackage) => Promise<{ success: boolean; error?: string }>
  deletePackage: (packageId: string) => Promise<{ success: boolean; error?: string }>
  saveMenuItem: (item: Partial<MenuItem> & { name: string; category: 'main' | 'pasta' | 'drink' }) => Promise<{ success: boolean; error?: string }>
  toggleMenuItemActive: (itemId: string, active: boolean) => Promise<{ success: boolean; error?: string }>
  deleteMenuItem: (itemId: string) => Promise<{ success: boolean; error?: string }>
  saveAddon: (addon: Partial<CateringAddon> & { name: string; price: number }) => Promise<{ success: boolean; error?: string }>
  deleteAddon: (addonId: string) => Promise<{ success: boolean; error?: string }>
  refreshCatalog: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)
const SESSION_TOKEN_KEY = 'sinag_session_token'
const LOCAL_USER_BACKUP_KEY = 'sinag_local_user'
const OAUTH_PENDING_KEY = 'sinag_oauth_return_view'

const mapDbBooking = (row: any): Booking => ({
  id: row.id,
  userId: row.user_id || 'guest',
  customerName: row.customer_name,
  email: row.email,
  phone: row.phone,
  eventType: row.event_type,
  customEventType: row.custom_event_type,
  eventDate: row.event_date,
  guestCount: Number(row.guest_count) || 50,
  packageName: row.package_name,
  packageId: row.package_id,
  currency: 'PHP',
  basePrice: Number(row.base_price) || 0,
  extraPaxFee: Number(row.extra_pax_fee) || 0,
  addOns: typeof row.add_ons === 'object' && row.add_ons
    ? row.add_ons
    : { extraMainCount: 0, extraPastaCount: 0, extraDessertCount: 0 },
  totalPrice: Number(row.total_price) || 0,
  downpaymentAmount: Number(row.downpayment_amount) || 0,
  paymentTerm: row.payment_term === 'reserve' || row.payment_term === 'full' || row.payment_term === 'downpayment'
    ? (row.payment_term === 'downpayment' && Number(row.total_price) > 0 && Number(row.downpayment_amount) >= Number(row.total_price) ? 'full' : row.payment_term)
    : (Number(row.downpayment_amount) >= Number(row.total_price) && Number(row.total_price) > 0) || (row.notes && /100% full payment/i.test(row.notes))
    ? 'full'
    : row.notes && /RESERVE ONLY/i.test(row.notes)
    ? 'reserve'
    : 'downpayment',
  holdExpiresAt: row.hold_expires_at ?? null,
  cancellationReason: row.cancellation_reason ?? null,
  cancellationNotes: row.cancellation_notes ?? null,
  refundPercentage: row.refund_percentage === null || row.refund_percentage === undefined ? null : Number(row.refund_percentage),
  refundAmount: row.refund_amount === null || row.refund_amount === undefined ? null : Number(row.refund_amount),
  refundStatus: row.refund_status || 'none',
  cancelledAt: row.cancelled_at ?? null,
  refundProcessedAt: row.refund_processed_at ?? null,
  reminderSentAt: row.reminder_sent_at ?? null,
  bookingStatus: row.booking_status || 'pending',
  paymentStatus: row.payment_status || 'unpaid',
  paymentMethod: row.payment_method,
  gcashRefNumber: row.gcash_ref_number,
  proofOfPaymentUrl: row.proof_of_payment_url,
  staffIds: Array.isArray(row.staff_ids) ? row.staff_ids : [],
  assignedServices: Array.isArray(row.assigned_services) && row.assigned_services.length > 0
    ? row.assigned_services
    : (row.package_id === 'full-blast' || (row.package_name && /full blast|entertainment/i.test(row.package_name))
      ? ['Event Host', 'Clown / Entertainer', 'Photo Booth', 'Photographer', 'Lights and Sounds']
      : []),
  notes: row.notes || '',
  createdAt: row.created_at || new Date().toISOString(),
})

const mapToDbBooking = (b: Booking) => ({
  id: b.id,
  user_id: b.userId,
  customer_name: b.customerName,
  email: b.email,
  phone: b.phone,
  event_type: b.eventType,
  custom_event_type: b.customEventType || null,
  event_date: b.eventDate,
  guest_count: b.guestCount,
  package_name: b.packageName,
  package_id: b.packageId || null,
  currency: 'PHP',
  base_price: b.basePrice,
  extra_pax_fee: b.extraPaxFee,
  add_ons: b.addOns,
  total_price: b.totalPrice,
  downpayment_amount: b.downpaymentAmount,
  booking_status: b.bookingStatus,
  payment_status: b.paymentStatus,
  payment_method: b.paymentMethod,
  gcash_ref_number: b.gcashRefNumber || null,
  proof_of_payment_url: b.proofOfPaymentUrl || null,
  staff_ids: b.staffIds,
  assigned_services: b.assignedServices || [],
  notes: b.notes,
  created_at: b.createdAt,
  updated_at: new Date().toISOString(),
  payment_term: b.paymentTerm || 'downpayment',
  hold_expires_at: b.holdExpiresAt || null,
  cancellation_reason: b.cancellationReason || null,
  cancellation_notes: b.cancellationNotes || null,
  refund_percentage: b.refundPercentage ?? null,
  refund_amount: b.refundAmount ?? null,
  refund_status: b.refundStatus || 'none',
  cancelled_at: b.cancelledAt || null,
  refund_processed_at: b.refundProcessedAt || null,
  reminder_sent_at: b.reminderSentAt || null,
})

// ---------------------------------------------------------------------------
// Revision 6 schema fallback: if the 20261104_revision_6.sql migration has not
// been applied yet, writes are retried without the new columns so the app
// keeps working (new data is kept in memory / localStorage only).
// ---------------------------------------------------------------------------
const REV6_BOOKING_COLUMNS = [
  'payment_term',
  'hold_expires_at',
  'cancellation_reason',
  'cancellation_notes',
  'refund_percentage',
  'refund_amount',
  'refund_status',
  'cancelled_at',
  'refund_processed_at',
  'reminder_sent_at',
]
let rev6BookingColumnsMissing = false
let notificationsTableMissing = false

type DbError = { message?: string; code?: string; details?: string } | null

const isMissingColumnError = (err: DbError) => {
  if (!err) return false
  const msg = `${err.message || ''} ${err.details || ''}`
  return err.code === 'PGRST204' || err.code === '42703' || (/column/i.test(msg) && /(does not exist|could not find|schema cache)/i.test(msg))
}

const isMissingTableError = (err: DbError) => {
  if (!err) return false
  const msg = `${err.message || ''}`
  return err.code === '42P01' || err.code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg)
}

const stripRev6Columns = <T extends Record<string, unknown>>(payload: T): Partial<T> => {
  const copy: Record<string, unknown> = { ...payload }
  REV6_BOOKING_COLUMNS.forEach((col) => delete copy[col])
  return copy as Partial<T>
}

/** Runs a bookings write, retrying without revision-6 columns when they don't exist yet. */
const writeBookingRow = async (
  payload: Record<string, unknown>,
  run: (row: Record<string, unknown>) => PromiseLike<{ error: DbError }>,
): Promise<DbError> => {
  const hasRev6 = REV6_BOOKING_COLUMNS.some((c) => c in payload)
  const first = rev6BookingColumnsMissing ? stripRev6Columns(payload) : payload
  if (rev6BookingColumnsMissing && Object.keys(first).length === 0) return null
  const { error } = await run(first)
  if (error && hasRev6 && !rev6BookingColumnsMissing && isMissingColumnError(error)) {
    rev6BookingColumnsMissing = true
    console.warn('Revision 6 booking columns missing — run supabase/migrations/20261104_revision_6.sql. Retrying without them.')
    const stripped = stripRev6Columns(payload)
    if (Object.keys(stripped).length === 0) return null
    const retry = await run(stripped)
    return retry.error
  }
  return error
}

const mapDbClientNotification = (row: any): ClientNotification => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  bookingId: row.booking_id || undefined,
  recipientEmail: row.recipient_email || '',
  userId: row.user_id || undefined,
  timestamp: row.created_at || new Date().toISOString(),
  read: Boolean(row.read),
})

const mapDbAdminNotification = (row: any): AdminNotification => ({
  id: row.id,
  type: row.type,
  title: row.title,
  message: row.message,
  bookingId: row.booking_id || undefined,
  timestamp: row.created_at || new Date().toISOString(),
  read: Boolean(row.read),
})

const CLIENT_NOTIF_STORAGE_PREFIX = 'sinag_client_notifications_'
const readLocalClientNotifs = (email: string): ClientNotification[] => {
  try {
    const raw = localStorage.getItem(`${CLIENT_NOTIF_STORAGE_PREFIX}${email.toLowerCase()}`)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
const writeLocalClientNotifs = (email: string, list: ClientNotification[]) => {
  try {
    localStorage.setItem(`${CLIENT_NOTIF_STORAGE_PREFIX}${email.toLowerCase()}`, JSON.stringify(list.slice(0, 100)))
  } catch {
    // ignore
  }
}

const mergeById = <T extends { id: string; timestamp: string }>(a: T[], b: T[]): T[] => {
  const map = new Map<string, T>()
  ;[...a, ...b].forEach((n) => {
    const existing = map.get(n.id)
    // a "read" flag from either copy wins
    map.set(n.id, existing ? { ...existing, ...n, read: (existing as any).read || (n as any).read } : n)
  })
  return [...map.values()].sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
}

const mapDbReview = (r: any): Review => ({
  id: r.id,
  userName: r.user_name,
  rating: Number(r.rating) || 5,
  comment: r.comment,
  imageUrl: r.image_url,
  date: r.date,
  reply: r.reply,
})

const mapDbInquiry = (i: any): Inquiry => ({
  id: i.id,
  customerName: i.customer_name,
  email: i.email,
  message: i.notes || i.message || '',
  replied: Boolean(i.replied),
  replyText: i.reply_text,
  date: i.created_at || new Date().toISOString(),
})

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const PACKAGES_STORAGE_KEY = 'sinag_catalog_packages'
  const MENU_ITEMS_STORAGE_KEY = 'sinag_catalog_menu_items'
  const ADDONS_STORAGE_KEY = 'sinag_catalog_addons'

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const currentUserRef = React.useRef<User | null>(null)
  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])
  const [packages, setPackages] = useState<CateringPackage[]>(() => {
    try {
      const stored = localStorage.getItem(PACKAGES_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: any) => {
            if (!p.imageUrl && p.id === 'budget-basic') {
              return { ...p, imageUrl: `${STORAGE_FILES_BASE}/packages/pkg_budget_basic.jpg` }
            }
            if (!p.imageUrl && p.id === 'budget-entertainment') {
              return { ...p, imageUrl: `${STORAGE_FILES_BASE}/packages/pkg_budget_entertainment.jpg` }
            }
            if (!p.imageUrl && p.id === 'full-blast') {
              return { ...p, imageUrl: `${STORAGE_FILES_BASE}/packages/pkg_full_blast.jpg` }
            }
            return p
          })
        }
      }
    } catch {}
    return []
  })
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const stored = localStorage.getItem(MENU_ITEMS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => {
            if (m.imageUrl && m.imageUrl.startsWith('/gallery/')) {
              const filename = m.imageUrl.split('/').pop()
              return { ...m, imageUrl: `${STORAGE_FILES_BASE}/menu/${filename}` }
            }
            return m
          })
        }
      }
    } catch {}
    return []
  })
  const [addons, setAddons] = useState<CateringAddon[]>(() => {
    try {
      const stored = localStorage.getItem(ADDONS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return []
  })
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [baseStaff, setBaseStaff] = useState<Staff[]>([])
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])

  // Persist catalog changes to localStorage
  useEffect(() => {
    try {
      if (packages.length > 0) localStorage.setItem(PACKAGES_STORAGE_KEY, JSON.stringify(packages))
    } catch {}
  }, [packages])

  useEffect(() => {
    try {
      if (menuItems.length > 0) localStorage.setItem(MENU_ITEMS_STORAGE_KEY, JSON.stringify(menuItems))
    } catch {}
  }, [menuItems])

  useEffect(() => {
    try {
      if (addons.length > 0) localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(addons))
    } catch {}
  }, [addons])

  const ADMIN_NOTIF_STORAGE_KEY = 'sinag_admin_notifications'
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_NOTIF_STORAGE_KEY)
      if (stored) return JSON.parse(stored)
    } catch {
      // fallback
    }
    return []
  })

  // Save admin notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_NOTIF_STORAGE_KEY, JSON.stringify(adminNotifications))
    } catch {
      // ignore
    }
  }, [adminNotifications])

  // ---------------------------------------------------------------------------
  // In-app notifications (persisted to public.notifications when available)
  // ---------------------------------------------------------------------------
  const insertNotificationRow = (row: Record<string, unknown>) => {
    if (!supabase || notificationsTableMissing) return
    void supabase
      .from('notifications')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) {
          if (isMissingTableError(error)) notificationsTableMissing = true
          console.warn('Could not save notification:', error.message)
        }
      })
  }

  const addAdminNotification = (
    notif: Omit<AdminNotification, 'id' | 'timestamp' | 'read'> & { id?: string },
  ) => {
    const newNotif: AdminNotification = {
      ...notif,
      id: notif.id || `an-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setAdminNotifications((prev) => (prev.some((n) => n.id === newNotif.id) ? prev : [newNotif, ...prev]))
    playNotificationSound()
    insertNotificationRow({
      id: newNotif.id,
      audience: 'admin',
      booking_id: newNotif.bookingId || null,
      type: newNotif.type,
      title: newNotif.title,
      message: newNotif.message,
      read: false,
      created_at: newNotif.timestamp,
    })
  }

  const markNotificationAsRead = (id: string) => {
    setAdminNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    if (supabase && !notificationsTableMissing) {
      void supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {})
    }
  }

  const markAllNotificationsAsRead = () => {
    setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (supabase && !notificationsTableMissing) {
      void supabase.from('notifications').update({ read: true }).eq('audience', 'admin').eq('read', false).then(() => {})
    }
  }

  const clearAdminNotifications = () => {
    setAdminNotifications([])
    localStorage.removeItem(ADMIN_NOTIF_STORAGE_KEY)
    if (supabase && !notificationsTableMissing) {
      void supabase.from('notifications').delete().eq('audience', 'admin').then(() => {})
    }
  }

  // Client notification feed (for the signed-in client). The feed is the merge
  // of the local cache and what was loaded from / pushed to the database.
  const [clientNotifStore, setClientNotifStore] = useState<{ email: string; list: ClientNotification[] }>({ email: '', list: [] })
  const activeClientEmail = currentUser && currentUser.role === 'client' ? currentUser.email.toLowerCase().trim() : ''
  const clientNotifications = useMemo(() => {
    if (!activeClientEmail) return []
    const fromStore = clientNotifStore.email === activeClientEmail ? clientNotifStore.list : []
    return mergeById(readLocalClientNotifs(activeClientEmail), fromStore)
  }, [activeClientEmail, clientNotifStore])
  const setClientNotifications = (updater: (prev: ClientNotification[]) => ClientNotification[]) => {
    const email = currentUserRef.current?.email.toLowerCase().trim() || ''
    if (!email) return
    setClientNotifStore((prev) => {
      const base = mergeById(readLocalClientNotifs(email), prev.email === email ? prev.list : [])
      return { email, list: updater(base) }
    })
  }

  const pushClientNotification = (
    notif: Omit<ClientNotification, 'id' | 'timestamp' | 'read'> & { id?: string },
  ) => {
    const newNotif: ClientNotification = {
      ...notif,
      id: notif.id || `cn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    const email = newNotif.recipientEmail.toLowerCase().trim()
    if (email) {
      const local = readLocalClientNotifs(email)
      if (!local.some((n) => n.id === newNotif.id)) writeLocalClientNotifs(email, [newNotif, ...local])
    }
    if (currentUserRef.current && currentUserRef.current.email.toLowerCase().trim() === email) {
      setClientNotifications((prev) => (prev.some((n) => n.id === newNotif.id) ? prev : [newNotif, ...prev]))
    }
    insertNotificationRow({
      id: newNotif.id,
      audience: 'client',
      user_id: newNotif.userId || null,
      recipient_email: email,
      booking_id: newNotif.bookingId || null,
      type: newNotif.type,
      title: newNotif.title,
      message: newNotif.message,
      read: false,
      created_at: newNotif.timestamp,
    })
  }

  const markClientNotificationRead = (id: string) => {
    setClientNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      if (currentUserRef.current) writeLocalClientNotifs(currentUserRef.current.email, next)
      return next
    })
    if (supabase && !notificationsTableMissing) {
      void supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {})
    }
  }

  const markAllClientNotificationsRead = () => {
    const email = currentUserRef.current?.email.toLowerCase().trim()
    setClientNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      if (email) writeLocalClientNotifs(email, next)
      return next
    })
    if (email && supabase && !notificationsTableMissing) {
      void supabase.from('notifications').update({ read: true }).eq('audience', 'client').eq('recipient_email', email).eq('read', false).then(() => {})
    }
  }

  // Seed initial notification history from bookings if storage is empty
  useEffect(() => {
    if (adminNotifications.length === 0 && bookings.length > 0) {
      const seedNotifs: AdminNotification[] = []
      bookings.slice(0, 15).forEach((b) => {
        if (b.bookingStatus === 'completed' || b.paymentStatus === 'fully_paid') {
          seedNotifs.push({
            id: `an-comp-${b.id}`,
            type: 'booking_completed',
            title: 'Booking Completed & Settled',
            message: `Event for ${b.customerName} on ${b.eventDate} marked as Completed. Full payment settled.`,
            bookingId: b.id,
            timestamp: b.createdAt || new Date().toISOString(),
            read: true,
          })
        } else if (b.bookingStatus === 'confirmed' || b.paymentStatus === 'downpayment_paid') {
          seedNotifs.push({
            id: `an-conf-${b.id}`,
            type: 'booking_confirmed',
            title: 'Downpayment Verified & Confirmed',
            message: `Booking #${b.id} for ${b.customerName} (${b.eventDate}) is verified and locked on the calendar.`,
            bookingId: b.id,
            timestamp: b.createdAt || new Date().toISOString(),
            read: true,
          })
        } else {
          seedNotifs.push({
            id: `an-new-${b.id}`,
            type: 'booking_new',
            title: 'New Booking Request',
            message: `${b.customerName} requested a ${b.eventType} reservation for ${b.eventDate} (${b.guestCount} pax). Ref: #${b.id}`,
            bookingId: b.id,
            timestamp: b.createdAt || new Date().toISOString(),
            read: false,
          })
        }
      })
      setAdminNotifications(seedNotifs)
    }
  }, [bookings])

  // 1. Session Restoration
  useEffect(() => {
    const raw = sessionStorage.getItem(LOCAL_USER_BACKUP_KEY)
    if (raw) {
      try {
        setCurrentUser(JSON.parse(raw))
      } catch {
        sessionStorage.removeItem(LOCAL_USER_BACKUP_KEY)
      }
    }
    if (!supabase) return
    const client = supabase
    const channel = client.channel('sinag-live-catalog')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        playNotificationSound()
        client.from('bookings').select('*').order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setBookings(data.map(mapDbBooking))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, () => {
        client.from('blocked_dates').select('date').then(({ data }) => {
          if (data) setBlockedDates(data.map((d: any) => d.date))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => {
        client.from('packages').select('*').order('base_price', { ascending: true }).then(({ data }) => {
          if (data) setPackages(data.map(mapDatabasePackage))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        client.from('menu_items').select('*').order('sort_order', { ascending: true }).then(({ data }) => {
          if (data) setMenuItems(data.map(mapDbMenuItem))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'package_addons' }, () => {
        client.from('package_addons').select('*').order('price', { ascending: true }).then(({ data }) => {
          if (data) setAddons(data.map(mapDbAddon))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
        client.from('staff').select('*').then(({ data }) => {
          if (data) {
            setBaseStaff(data.map((row: any) => ({
              id: row.id,
              name: row.name,
              role: row.role,
              status: row.status || 'available',
              age: typeof row.age === 'number' ? row.age : (row.age ? Number(row.age) : 25),
              offDays: Array.isArray(row.off_days) && row.off_days.length > 0 ? row.off_days : (row.offDays || []),
            })))
          }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        client.from('reviews').select('*').order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setReviews(data.map(mapDbReview))
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catering_inquiries' }, () => {
        client.from('catering_inquiries').select('*').order('created_at', { ascending: false }).then(({ data }) => {
          if (data) setInquiries(data.map(mapDbInquiry))
        })
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [])

  // 2. Load DB data from Supabase
  useEffect(() => {
    if (!supabase) return

    // Fetch Bookings
    supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setBookings(data.map(mapDbBooking))
        }
      })

    // The package catalog is database-owned. No local/mock package fallback is used.
    supabase
      .from('packages')
      .select('*')
      .order('base_price', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setPackages(data.map(mapDatabasePackage))
      })

    // Fetch Managed Menu Items
    supabase
      .from('menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setMenuItems(data.map(mapDbMenuItem))
        }
      })

    // Fetch Managed Package Addons
    supabase
      .from('package_addons')
      .select('*')
      .order('price', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setAddons(data.map(mapDbAddon))
        }
      })

    // Fetch Reviews
    supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setReviews(data.map(mapDbReview))
        }
      })

    // Fetch Staff
    supabase
      .from('staff')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            name: row.name,
            role: row.role,
            status: row.status || 'available',
            age: typeof row.age === 'number' ? row.age : (row.age ? Number(row.age) : 25),
            offDays: Array.isArray(row.off_days) && row.off_days.length > 0
              ? row.off_days
              : (row.offDays || []),
          }))
          setBaseStaff(mapped)
        }
      })

    // Fetch Blocked Dates
    supabase
      .from('blocked_dates')
      .select('date')
      .then(({ data, error }) => {
        if (!error && data) {
          setBlockedDates(data.map((d: any) => d.date))
        }
      })

    // Fetch Catering Inquiries
    supabase
      .from('catering_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setInquiries(data.map(mapDbInquiry))
        }
      })
  }, [])

  // ---------------------------------------------------------------------------
  // Notification feeds: initial load + realtime for the signed-in user
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return
    const client = supabase
    const email = currentUser.email.toLowerCase().trim()

    if (!client) return
    let cancelled = false

    if (currentUser.role === 'admin') {
      client
        .from('notifications')
        .select('*')
        .eq('audience', 'admin')
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            if (isMissingTableError(error)) notificationsTableMissing = true
            return
          }
          if (data) setAdminNotifications((prev) => mergeById(prev, data.map(mapDbAdminNotification)))
        })
    } else {
      client
        .from('notifications')
        .select('*')
        .eq('audience', 'client')
        .ilike('recipient_email', email)
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) {
            if (isMissingTableError(error)) notificationsTableMissing = true
            return
          }
          if (data) {
            setClientNotifications((prev) => {
              const merged = mergeById(prev, data.map(mapDbClientNotification))
              writeLocalClientNotifs(email, merged)
              return merged
            })
          }
        })
    }

    const channel = client
      .channel(`sinag-notifications-${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
        const row = payload?.new
        if (!row) return
        if (row.audience === 'admin' && currentUser.role === 'admin') {
          const n = mapDbAdminNotification(row)
          setAdminNotifications((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev
            playNotificationSound()
            return [n, ...prev]
          })
        } else if (row.audience === 'client' && currentUser.role === 'client' && String(row.recipient_email || '').toLowerCase() === email) {
          const n = mapDbClientNotification(row)
          setClientNotifications((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev
            playNotificationSound()
            const next = [n, ...prev]
            writeLocalClientNotifs(email, next)
            return next
          })
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      client.removeChannel(channel)
    }
  }, [currentUser?.id, currentUser?.role, currentUser?.email])

  // ---------------------------------------------------------------------------
  // Terms & Conditions gate (clients must scroll + accept once per version)
  // ---------------------------------------------------------------------------
  const [termsCheck, setTermsCheck] = useState<{ userId: string; status: 'accepted' | 'required' } | null>(null)
  const termsStatus: 'unknown' | 'accepted' | 'required' =
    !currentUser || currentUser.role !== 'client'
      ? 'accepted'
      : getLocalTermsAcceptance(currentUser.id)
      ? 'accepted'
      : termsCheck && termsCheck.userId === currentUser.id
      ? termsCheck.status
      : !supabase
      ? 'required'
      : 'unknown'

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'client' || !supabase) return
    if (getLocalTermsAcceptance(currentUser.id)) return
    const userId = currentUser.id
    let cancelled = false
    supabase
      .from('users')
      .select('terms_accepted_at, terms_version')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data) {
          // Column not migrated yet or user row not found: rely on the local record
          setTermsCheck({ userId, status: getLocalTermsAcceptance(userId) ? 'accepted' : 'required' })
          return
        }
        const accepted = Boolean(data.terms_accepted_at) && data.terms_version === TERMS_VERSION
        if (accepted) setLocalTermsAcceptance(userId)
        setTermsCheck({ userId, status: accepted ? 'accepted' : 'required' })
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.role])

  const acceptTerms = async () => {
    const user = currentUserRef.current
    if (!user) return
    setLocalTermsAcceptance(user.id)
    setTermsCheck({ userId: user.id, status: 'accepted' })
    const acceptedAt = new Date().toISOString()
    const updatedUser: User = { ...user, termsAcceptedAt: acceptedAt, termsVersion: TERMS_VERSION }
    setCurrentUser(updatedUser)
    sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(updatedUser))
    if (supabase) {
      const { error } = await supabase
        .from('users')
        .update({ terms_accepted_at: acceptedAt, terms_version: TERMS_VERSION })
        .eq('id', user.id)
      if (error) console.warn('Terms acceptance saved locally only:', error.message)
    }
  }

  const needsTermsAcceptance = Boolean(currentUser && currentUser.role === 'client' && termsStatus === 'required')

  // ---------------------------------------------------------------------------
  // Customer directory for the admin "Customers" tab
  // ---------------------------------------------------------------------------
  const fetchCustomers = async (): Promise<CustomerAccount[]> => {
    const fromBookings = (): CustomerAccount[] => {
      const map = new Map<string, CustomerAccount>()
      bookings.forEach((b) => {
        const key = b.email.toLowerCase().trim()
        if (!key || map.has(key)) return
        map.set(key, { id: b.userId && b.userId !== 'guest' ? b.userId : key, name: b.customerName, email: b.email, phone: b.phone, createdAt: b.createdAt, isGuest: true })
      })
      return [...map.values()]
    }
    if (!supabase) return fromBookings()
    const full = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, created_at, auth_provider, terms_accepted_at')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
    let rows: any[] | null = full.data
    if (full.error) {
      const basic = await supabase
        .from('users')
        .select('id, full_name, email, phone, role, created_at')
        .eq('role', 'client')
        .order('created_at', { ascending: false })
      rows = basic.error ? null : basic.data
    }
    if (!rows) return fromBookings()
    const accounts: CustomerAccount[] = rows.map((r) => ({
      id: r.id,
      name: r.full_name,
      email: r.email,
      phone: r.phone || undefined,
      createdAt: r.created_at,
      authProvider: r.auth_provider === 'google' ? 'google' : 'email',
      termsAcceptedAt: r.terms_accepted_at ?? null,
    }))
    // Include guests who booked without a registered account
    const known = new Set(accounts.map((a) => a.email.toLowerCase().trim()))
    fromBookings().forEach((g) => {
      if (!known.has(g.email.toLowerCase().trim())) accounts.push(g)
    })
    return accounts
  }

  // Derive staff status based on active confirmed bookings
  const staff = useMemo<Staff[]>(() => {
    const busyStaffIds = new Set<string>()
    bookings.forEach((booking) => {
      if (booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'approved') {
        booking.staffIds.forEach((id) => busyStaffIds.add(id))
      }
    })
    return baseStaff.map((s) => ({
      ...s,
      status: busyStaffIds.has(s.id) ? 'busy' : 'available',
    }))
  }, [baseStaff, bookings])

  const signIn = async (identifier: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    const rawInput = identifier.trim()
    const normInput = rawInput.toLowerCase()

    if (supabase) {
      try {
        let query = supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('password', password)

        if (normInput.includes('@')) {
          query = query.eq('email', normInput)
        } else {
          query = query.or(`email.ilike.${normInput},email.ilike.${normInput}@example.com,full_name.ilike.${normInput}`)
        }

        let { data, error } = await query.limit(1).maybeSingle()

        if (!data) {
          if (normInput === 'admin' || normInput === 'admin@sinagcatering.ph' || normInput === 'admin@example.com') {
            const { data: adminData } = await supabase
              .from('users')
              .select('id, full_name, email, phone, role')
              .eq('password', password)
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle()
            if (adminData) data = adminData
          } else if (normInput === 'ama' || normInput === 'ama@example.com') {
            const { data: amaData } = await supabase
              .from('users')
              .select('id, full_name, email, phone, role')
              .eq('password', password)
              .or('email.eq.ama@example.com,full_name.eq.Ama')
              .limit(1)
              .maybeSingle()
            if (amaData) data = amaData
          }
        }

        if (data) {
          const user: User = {
            id: data.id,
            name: data.full_name || rawInput.split('@')[0],
            email: data.email,
            phone: data.phone || undefined,
            role: data.role || (data.email?.toLowerCase().includes('admin') ? 'admin' : 'client'),
          }
          const sessionToken = `session_${user.id}_${Date.now()}`
          sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
          sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(user))
          setCurrentUser(user)

          // Persist session to database
          if (supabase) {
            void supabase.from('user_sessions').insert({
              user_id: user.id,
              token_hash: sessionToken,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
          }

          return { user, error: null }
        }

        if (error) {
          console.warn('Supabase auth query error:', error.message)
        } else {
          return { user: null, error: 'Invalid email or password.' }
        }
      } catch (err: any) {
        console.warn('Login request error:', err)
      }
    }

    return { user: null, error: 'Unable to connect to user database.' }
  }

  const signUp = async (name: string, email: string, phone: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    const normEmail = email.trim().toLowerCase()
    // Public registration is always client-only. Administrator accounts must be
    // provisioned securely outside the public portal.
    const role: User['role'] = 'client'

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .insert({
            full_name: name.trim(),
            email: normEmail,
            phone: phone.trim(),
            password: password, // Plaintext as requested
            role,
          })
          .select('id, full_name, email, phone, role')
          .single()

        if (data) {
          const user: User = {
            id: data.id,
            name: data.full_name,
            email: data.email,
            phone: data.phone || undefined,
            role: data.role,
          }
          const sessionToken = `session_${user.id}_${Date.now()}`
          sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
          sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(user))
          setCurrentUser(user)

          // Persist session to database
          if (supabase) {
            void supabase.from('user_sessions').insert({
              user_id: user.id,
              token_hash: sessionToken,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
          }

          return { user, error: null }
        }

        if (error) {
          return { user: null, error: error.message }
        }
      } catch (err: any) {
        console.warn('Registration request error:', err)
      }
    }

    return { user: null, error: 'Unable to complete registration.' }
  }


  // ---------------------------------------------------------------------------
  // Google sign-in / sign-up (Supabase Auth OAuth → app users table)
  // ---------------------------------------------------------------------------
  const [googleAuth, setGoogleAuth] = useState<{ status: 'idle' | 'redirecting' | 'finishing' | 'error'; message: string }>(() => {
    if (typeof window === 'undefined') return { status: 'idle', message: '' }
    const params = new URLSearchParams(window.location.search)
    if (params.get('error_description')) {
      return { status: 'error', message: `Google sign-in was cancelled or failed: ${params.get('error_description')}` }
    }
    if (params.get('code') && sessionStorage.getItem(OAUTH_PENDING_KEY)) {
      return { status: 'finishing', message: 'Finishing Google sign-in…' }
    }
    return { status: 'idle', message: '' }
  })
  const googleLinkInFlightRef = React.useRef(false)

  const clearGoogleAuthMessage = () => setGoogleAuth({ status: 'idle', message: '' })

  const signInWithGoogle = async (returnView: 'client' | 'booking' = 'client'): Promise<{ error: string | null }> => {
    if (!supabase) return { error: 'Google sign-in is unavailable: the database is not configured.' }
    sessionStorage.setItem(OAUTH_PENDING_KEY, returnView)
    setGoogleAuth({ status: 'redirecting', message: 'Redirecting to Google…' })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      sessionStorage.removeItem(OAUTH_PENDING_KEY)
      const message = /provider is not enabled|Unsupported provider/i.test(error.message)
        ? 'Google sign-in is not enabled yet in Supabase (Authentication → Providers → Google).'
        : error.message
      setGoogleAuth({ status: 'error', message })
      return { error: message }
    }
    return { error: null }
  }

  const stripOAuthParamsFromUrl = () => {
    const url = new URL(window.location.href)
    let changed = false
    ;['code', 'error', 'error_code', 'error_description', 'state'].forEach((k) => {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k)
        changed = true
      }
    })
    if (changed) window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  // Turns a verified Google identity into an app user (existing account by
  // email, or a brand-new client account) and starts the normal app session.
  const completeGoogleLogin = async (authUser: { email?: string | null; user_metadata?: Record<string, unknown> }) => {
    const client = supabase
    if (!client || googleLinkInFlightRef.current) return
    googleLinkInFlightRef.current = true
    try {
      const email = (authUser.email || '').trim().toLowerCase()
      if (!email) throw new Error('Your Google account did not share an email address.')
      const meta = authUser.user_metadata || {}
      const fullName = String(meta.full_name || meta.name || email.split('@')[0]).trim().slice(0, 120)

      let { data: row, error } = await client
        .from('users')
        .select('id, full_name, email, phone, role')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(error.message)

      if (!row) {
        const inserted = await client
          .from('users')
          .insert({
            full_name: fullName || 'Sinag Client',
            email,
            phone: null,
            // Google accounts never sign in with a password; this random value
            // cannot be guessed. "Forgot password" can still set a real one later.
            password: `google-oauth:${crypto.randomUUID()}:${crypto.randomUUID()}`,
            role: 'client',
            auth_provider: 'google',
          })
          .select('id, full_name, email, phone, role')
          .single()
        if (inserted.error) throw new Error(inserted.error.message)
        row = inserted.data
      }

      const user: User = {
        id: row.id,
        name: row.full_name || fullName,
        email: row.email,
        phone: row.phone || undefined,
        role: row.role === 'admin' ? 'admin' : 'client',
        authProvider: 'google',
      }
      const sessionToken = `session_${user.id}_${Date.now()}`
      sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken)
      sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(user))
      setCurrentUser(user)
      void client.from('user_sessions').insert({
        user_id: user.id,
        token_hash: sessionToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      setGoogleAuth({ status: 'idle', message: '' })
    } catch (err) {
      sessionStorage.removeItem(OAUTH_PENDING_KEY)
      setGoogleAuth({
        status: 'error',
        message: `Google sign-in failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      // The Supabase Auth session was only needed to verify the Google account.
      await client.auth.signOut({ scope: 'local' }).catch(() => {})
      stripOAuthParamsFromUrl()
      googleLinkInFlightRef.current = false
    }
  }

  useEffect(() => {
    const client = supabase
    if (!client) return
    if (new URLSearchParams(window.location.search).get('error_description')) {
      sessionStorage.removeItem(OAUTH_PENDING_KEY)
      stripOAuthParamsFromUrl()
    }
    const handle = (session: { user?: { email?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null) => {
      const authUser = session?.user
      if (!authUser) return
      const provider = String(authUser.app_metadata?.provider || '')
      if (provider !== 'google' && !sessionStorage.getItem(OAUTH_PENDING_KEY)) return
      // Defer: Supabase recommends not awaiting other client calls inside the callback
      window.setTimeout(() => void completeGoogleLogin(authUser), 0)
    }
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => handle(session))
    return () => sub.subscription.unsubscribe()
  }, [])

  const logout = async () => {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (token && supabase) {
      void supabase.from('user_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', token)
    }
    sessionStorage.removeItem(SESSION_TOKEN_KEY)
    sessionStorage.removeItem(LOCAL_USER_BACKUP_KEY)
    setCurrentUser(null)
  }

  const requestPasswordResetOTP = async (
    identifier: string,
    method: 'email' | 'sms',
  ): Promise<{ success: boolean; maskedTarget?: string; error?: string; simulatedOtp?: string }> => {
    let targetUser: { id: string; email: string; phone?: string; full_name?: string } | null = null

    if (method === 'email') {
      const cleanEmail = identifier.trim().toLowerCase()
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address format (e.g. name@domain.com).' }
      }
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, email, phone, full_name')
            .ilike('email', cleanEmail)
            .maybeSingle()
          if (!error && data) targetUser = data
        } catch (err) {
          console.warn('Error querying user by email:', err)
        }
      }
      if (!targetUser && cleanEmail === 'admin@sinagcatering.ph') {
        targetUser = { id: 'admin-seed-id', email: 'admin@sinagcatering.ph', phone: '0928 714 4597', full_name: 'Executive Admin' }
      }
      if (!targetUser && currentUser && currentUser.email.toLowerCase() === cleanEmail) {
        targetUser = { id: currentUser.id, email: currentUser.email, phone: currentUser.phone, full_name: currentUser.name }
      }
      if (!targetUser) {
        return { success: false, error: 'No registered account found with this email address. Please double-check spelling.' }
      }
    } else {
      const cleanDigits = identifier.replace(/[^0-9]/g, '')
      if (cleanDigits.length < 10) {
        return { success: false, error: 'Please provide a valid Philippine mobile number (e.g. 0928 714 4597).' }
      }
      const normInputPhone = normalizePhPhoneNumber(identifier)
      if (supabase) {
        try {
          const { data } = await supabase.from('users').select('id, email, phone, full_name')
          if (data && data.length > 0) {
            targetUser = data.find((u: any) => u.phone && normalizePhPhoneNumber(u.phone) === normInputPhone) || null
          }
        } catch (err) {
          console.warn('Error querying user by phone:', err)
        }
      }
      if (!targetUser && (normInputPhone.endsWith('9287144597') || normInputPhone.includes('9287144597'))) {
        targetUser = { id: 'admin-seed-id', email: 'admin@sinagcatering.ph', phone: '0928 714 4597', full_name: 'Executive Admin' }
      }
      if (!targetUser && currentUser && currentUser.phone && normalizePhPhoneNumber(currentUser.phone) === normInputPhone) {
        targetUser = { id: currentUser.id, email: currentUser.email, phone: currentUser.phone, full_name: currentUser.name }
      }
      if (!targetUser) {
        return { success: false, error: 'No registered account found with this mobile number.' }
      }
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const sessionData = {
      userId: targetUser.id,
      email: targetUser.email,
      phone: targetUser.phone || identifier,
      otp: otpCode,
      expiresAt: Date.now() + 15 * 60 * 1000,
      method,
    }
    sessionStorage.setItem('sinag_pwd_reset_session', JSON.stringify(sessionData))

    let sendRes: { success: boolean; simulated?: boolean; error?: string }
    if (method === 'email') {
      sendRes = await sendPasswordResetEmailOTP(targetUser.email, otpCode)
    } else {
      sendRes = await sendPasswordResetSMSOTP(targetUser.phone || identifier, otpCode)
    }

    const maskedTarget = method === 'email'
      ? maskEmail(targetUser.email)
      : maskPhone(targetUser.phone || identifier)

    return {
      success: true,
      maskedTarget,
      simulatedOtp: sendRes.simulated ? otpCode : undefined,
    }
  }

  const verifyAndResetPassword = async (
    otpInput: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const raw = sessionStorage.getItem('sinag_pwd_reset_session')
    if (!raw) {
      return { success: false, error: 'Reset session expired or not found. Please request a new OTP.' }
    }
    let sessionData: any
    try {
      sessionData = JSON.parse(raw)
    } catch {
      return { success: false, error: 'Invalid session state. Please request a new OTP.' }
    }

    if (Date.now() > sessionData.expiresAt) {
      return { success: false, error: 'This OTP has expired (15-minute window). Please request a new code.' }
    }

    if (sessionData.otp !== otpInput.trim()) {
      return { success: false, error: 'Incorrect 6-digit OTP passcode. Please check and try again.' }
    }

    const passwordError = getPasswordValidationError(newPassword)
    if (passwordError) {
      return { success: false, error: passwordError }
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ password: newPassword, updated_at: new Date().toISOString() })
          .eq('id', sessionData.userId)
        if (error) {
          console.error('Supabase password reset update error:', error)
          return { success: false, error: error.message }
        }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to update password in database.' }
      }
    }

    sessionStorage.removeItem('sinag_pwd_reset_session')
    return { success: true }
  }

  const changeUserPassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'You must be signed in to change your password.' }

    const passwordError = getPasswordValidationError(newPassword)
    if (passwordError) return { success: false, error: passwordError }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, password')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (error) return { success: false, error: error.message }
        if (data && data.password !== currentPassword) {
          return { success: false, error: 'Current password does not match. Please verify your current password.' }
        }

        const { error: updateErr } = await supabase
          .from('users')
          .update({ password: newPassword, updated_at: new Date().toISOString() })
          .eq('id', currentUser.id)

        if (updateErr) return { success: false, error: updateErr.message }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to update password.' }
      }
    }

    return { success: true }
  }

  const updateUserProfile = async (
    name: string,
    phone: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'You must be signed in to update your profile.' }

    const cleanName = name.trim()
    const cleanPhone = phone.trim()
    if (!cleanName || cleanName.length < 2) return { success: false, error: 'Please enter a valid full name.' }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('users')
          .update({
            full_name: cleanName,
            phone: cleanPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUser.id)
        if (error) return { success: false, error: error.message }
      } catch (err: any) {
        return { success: false, error: err.message || 'Failed to update profile.' }
      }
    }

    const updated: User = {
      ...currentUser,
      name: cleanName,
      phone: cleanPhone || undefined,
    }
    setCurrentUser(updated)
    sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(updated))
    return { success: true }
  }

  const createBooking = (
    bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds'> & { proofOfPaymentUrl?: string | null },
    bookingId?: string,
    options?: { paidOnline?: boolean },
  ): Booking => {
    const id = bookingId ?? `bk-${crypto.randomUUID()}`
    const nowIso = new Date().toISOString()
    const term = bookingData.paymentTerm ?? 'downpayment'
    const isPaymentSubmitted = Boolean((bookingData.gcashRefNumber && bookingData.gcashRefNumber.trim()) || bookingData.proofOfPaymentUrl)
    const isFullEntertainment =
      bookingData.packageId === 'full-blast' ||
      Boolean(bookingData.packageName && /full blast|entertainment/i.test(bookingData.packageName))
    const defaultServices = isFullEntertainment
      ? ['Event Host', 'Clown / Entertainer', 'Photo Booth', 'Photographer', 'Lights and Sounds']
      : []

    const paidOnline = Boolean(options?.paidOnline)
    const paymentStatus: Booking['paymentStatus'] = paidOnline
      ? (term === 'full' ? 'fully_paid' : term === 'reserve' ? 'partially_paid' : 'downpayment_paid')
      : isPaymentSubmitted
      ? 'pending_verification'
      : 'unpaid'

    const newBooking: Booking = {
      ...bookingData,
      id,
      userId: currentUser?.id || 'guest',
      createdAt: nowIso,
      paymentTerm: term,
      holdExpiresAt: term === 'reserve' ? new Date(Date.now() + RESERVE_HOLD_MS).toISOString() : null,
      bookingStatus: paidOnline ? 'confirmed' : 'pending',
      paymentStatus,
      proofOfPaymentUrl: bookingData.proofOfPaymentUrl || null,
      staffIds: [],
      assignedServices: (bookingData.assignedServices && bookingData.assignedServices.length > 0) ? bookingData.assignedServices : defaultServices,
      refundStatus: 'none',
    }

    setBookings((prev) => [newBooking, ...prev])

    // Persist to Supabase Database
    if (supabase) {
      const client = supabase
      const dbPayload = mapToDbBooking(newBooking)
      void writeBookingRow(dbPayload, (row) => client.from('bookings').insert(row)).then((error) => {
        if (error) console.error('Error inserting booking into Supabase:', error.message)
      })
    }

    // Trigger live Semaphore SMS and transactional email alerts
    sendBookingSubmissionNotifications(newBooking).catch(console.error)

    if (term === 'reserve' && paymentStatus === 'unpaid') {
      addAdminNotification({
        type: 'hold_created',
        title: 'New 48-Hour Temporary Hold',
        message: `${newBooking.customerName} placed a Reserve Only hold on ${newBooking.eventDate} (${newBooking.eventType}, ${newBooking.guestCount} pax). Ref: #${newBooking.id}. Auto-expires in 48 hours without payment.`,
        bookingId: newBooking.id,
      })
      pushClientNotification({
        id: `nt-hold-${newBooking.id}`,
        type: 'hold_created',
        title: 'Your date is temporarily held!',
        message: `Booking ${newBooking.id} on ${newBooking.eventDate} is held for 48 hours. Please pay the ${formatMoney(newBooking.downpaymentAmount || RESERVATION_FEE, 'PHP')} reservation fee within 2 days (48 hours) to lock in your reservation, or your booking will automatically expire.`,
        bookingId: newBooking.id,
        recipientEmail: newBooking.email,
        userId: currentUser?.id,
      })
    } else {
      addAdminNotification({
        type: 'booking_new',
        title: paidOnline ? 'New Booking Paid Online' : 'New Booking Request',
        message: `${newBooking.customerName} submitted a ${newBooking.eventType} reservation for ${newBooking.eventDate} (${newBooking.guestCount} pax). Ref: #${newBooking.id}`,
        bookingId: newBooking.id,
      })
      pushClientNotification({
        id: `nt-new-${newBooking.id}`,
        type: paidOnline ? 'payment_confirmed' : 'booking_update',
        title: paidOnline ? 'Payment received – date reserved' : 'Reservation submitted',
        message: paidOnline
          ? `Your online payment for booking ${newBooking.id} (${newBooking.eventDate}) was received. Your date is locked.`
          : `Your ${term === 'full' ? '100% full payment' : term === 'reserve' ? 'reservation-fee' : '50% downpayment'} booking for ${newBooking.eventDate} is locked on our calendar. ${isPaymentSubmitted ? 'Your payment proof is pending verification.' : 'You can upload your payment receipt anytime from My Bookings.'}`,
        bookingId: newBooking.id,
        recipientEmail: newBooking.email,
        userId: currentUser?.id,
      })
    }

    return newBooking
  }

  const uploadPayment = (
    bookingId: string,
    proofUrl: string,
    refNumber?: string,
    options?: { amount?: number; paymentTerm?: 'downpayment' | 'full' | 'reserve' },
  ) => {
    const target = bookings.find((b) => b.id === bookingId)
    const nextTerm = options?.paymentTerm ?? (target ? getPaymentTerm(target) : undefined)
    const nextAmount = options?.amount

    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === bookingId
          ? {
              ...bk,
              proofOfPaymentUrl: proofUrl,
              paymentStatus: bk.paymentStatus === 'downpayment_paid' || bk.paymentStatus === 'partially_paid' ? bk.paymentStatus : 'pending_verification',
              ...(refNumber ? { gcashRefNumber: refNumber } : {}),
              ...(nextTerm && bk.paymentStatus !== 'downpayment_paid' && bk.paymentStatus !== 'partially_paid' ? { paymentTerm: nextTerm } : {}),
              ...(nextAmount && bk.paymentStatus !== 'downpayment_paid' && bk.paymentStatus !== 'partially_paid' ? { downpaymentAmount: nextAmount } : {}),
            }
          : bk,
      ),
    )

    const isBalancePayment = target?.paymentStatus === 'downpayment_paid' || target?.paymentStatus === 'partially_paid'
    addAdminNotification({
      type: 'payment_uploaded',
      title: isBalancePayment ? 'Balance Payment Receipt Uploaded' : 'Payment Proof Uploaded',
      message: `${target?.customerName || 'Client'} uploaded a payment receipt${nextAmount ? ` for ${formatMoney(nextAmount, 'PHP')}` : ''} (Ref: ${refNumber || 'Receipt Image'}) for Booking #${bookingId}. Pending verification.`,
      bookingId,
    })
    if (target) {
      pushClientNotification({
        type: 'payment_submitted',
        title: 'Payment receipt received',
        message: `We received your payment receipt for booking ${bookingId}. Our team will verify it shortly.`,
        bookingId,
        recipientEmail: target.email,
        userId: currentUser?.id,
      })
    }

    if (supabase) {
      const client = supabase
      const payload: Record<string, unknown> = {
        proof_of_payment_url: proofUrl,
        ...(refNumber ? { gcash_ref_number: refNumber } : {}),
      }
      if (!isBalancePayment) {
        payload.payment_status = 'pending_verification'
        if (nextAmount) payload.downpayment_amount = nextAmount
        if (nextTerm) payload.payment_term = nextTerm
      }
      void writeBookingRow(payload, (row) => client.from('bookings').update(row).eq('id', bookingId)).then((error) => {
        if (error) console.error('Error updating payment proof in Supabase:', error.message)
      })
    }
  }

  const cancelBooking = (bookingId: string, reason: string, notes?: string) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return { refundPercentage: 0, refundAmount: 0, refundStatus: 'not_applicable' as const }

    const quote = computeRefundQuote(booking)
    const refundStatus: 'pending' | 'not_applicable' = quote.refundable ? 'pending' : 'not_applicable'
    const cancelledAt = new Date().toISOString()
    const cleanNotes = notes?.trim() || null

    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === bookingId
          ? {
              ...bk,
              bookingStatus: 'cancelled',
              cancellationReason: reason,
              cancellationNotes: cleanNotes,
              refundPercentage: quote.refundPercentage,
              refundAmount: quote.refundAmount,
              refundStatus,
              cancelledAt,
            }
          : bk,
      ),
    )

    const amountText = formatMoney(quote.refundAmount, booking.currency)
    addAdminNotification({
      type: 'refund_request',
      title: quote.refundable ? 'New Refund Request / Cancellation' : 'Booking Cancelled (No Refund Due)',
      message: quote.refundable
        ? `${booking.customerName} cancelled booking ${bookingId}. Requested manual refund of ${amountText} based on ${quote.tierLabel}. Reason: ${reason}${cleanNotes ? ` – ${cleanNotes}` : ''}.`
        : `${booking.customerName} cancelled booking ${bookingId}. No refund applies (${quote.tierLabel}). Reason: ${reason}${cleanNotes ? ` – ${cleanNotes}` : ''}.`,
      bookingId,
    })

    pushClientNotification({
      type: 'refund_requested',
      title: quote.refundable ? 'Cancellation & refund request received' : 'Booking cancelled',
      message: quote.refundable
        ? `Booking ${bookingId} was cancelled. Your refund request of ${amountText} (${quote.tierLabel}) was sent to Sinag Catering for manual review and payout.`
        : `Booking ${bookingId} was cancelled. Under our cancellation policy no refund applies (${quote.tierLabel}).`,
      bookingId,
      recipientEmail: booking.email,
      userId: currentUser?.id,
    })

    const adminSms = quote.refundable
      ? `SINAG ALERT: Booking ${bookingId} cancelled by ${booking.customerName}. Manual refund request of ${amountText} logged. Check admin panel.`
      : `SINAG ALERT: Booking ${bookingId} cancelled by ${booking.customerName}. No refund due (${quote.refundPercentage}% tier). Check admin panel.`
    sendSemaphoreSMS(ADMIN_ALERT_PHONE, adminSms, bookingId).catch(console.error)

    // Release the date on the live calendar
    if (blockedDates.includes(booking.eventDate)) unblockDate(booking.eventDate)

    if (supabase) {
      const client = supabase
      void writeBookingRow(
        {
          booking_status: 'cancelled',
          cancellation_reason: reason,
          cancellation_notes: cleanNotes,
          refund_percentage: quote.refundPercentage,
          refund_amount: quote.refundAmount,
          refund_status: refundStatus,
          cancelled_at: cancelledAt,
        },
        (row) => client.from('bookings').update(row).eq('id', bookingId),
      ).then((error) => {
        if (error) console.error('Error cancelling booking in Supabase:', error.message)
      })
    }

    return { refundPercentage: quote.refundPercentage, refundAmount: quote.refundAmount, refundStatus }
  }

  const markRefundProcessed = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return
    const processedAt = new Date().toISOString()
    setBookings((prev) =>
      prev.map((bk) => (bk.id === bookingId ? { ...bk, refundStatus: 'processed', refundProcessedAt: processedAt } : bk)),
    )
    const amountText = formatMoney(booking.refundAmount || 0, booking.currency)
    pushClientNotification({
      type: 'refund_processed',
      title: 'Refund processed',
      message: `Your refund of ${amountText} for cancelled booking ${bookingId} has been processed by Sinag Catering.`,
      bookingId,
      recipientEmail: booking.email,
    })
    sendSemaphoreSMS(
      booking.phone,
      `Sinag Catering: Your refund of ${amountText} for booking ${bookingId} has been processed. Salamat po!`,
      bookingId,
    ).catch(console.error)
    if (supabase) {
      const client = supabase
      void writeBookingRow(
        { refund_status: 'processed', refund_processed_at: processedAt },
        (row) => client.from('bookings').update(row).eq('id', bookingId),
      ).then((error) => {
        if (error) console.error('Error marking refund processed:', error.message)
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 48-hour hold expiry (timestamp check; the DB function / Netlify scheduled
  // function do the same server-side so holds expire even when nobody is online)
  // ---------------------------------------------------------------------------
  const expiringHoldsRef = React.useRef(new Set<string>())
  useEffect(() => {
    const sweep = () => {
      const now = Date.now()
      const expired = bookings.filter((b) => isHoldExpired(b, now) && !expiringHoldsRef.current.has(b.id))
      if (expired.length === 0) return
      expired.forEach((b) => expiringHoldsRef.current.add(b.id))
      const expiredIds = new Set(expired.map((b) => b.id))
      setBookings((prev) => prev.map((bk) => (expiredIds.has(bk.id) ? { ...bk, bookingStatus: 'forfeit' } : bk)))

      expired.forEach((b) => {
        const notify = () => {
          addAdminNotification({
            id: `nt-exp-a-${b.id}`,
            type: 'hold_expired',
            title: 'Temporary Hold Expired',
            message: `${b.customerName}'s 48-hour hold (${b.id}) on ${b.eventDate} expired without payment and was forfeited. Date released to the calendar.`,
            bookingId: b.id,
          })
          pushClientNotification({
            id: `nt-exp-c-${b.id}`,
            type: 'hold_expired',
            title: 'Temporary Hold Expired',
            message: `Your 48-hour temporary hold for booking ${b.id} on ${b.eventDate} expired because no payment was uploaded. The date has been released.`,
            bookingId: b.id,
            recipientEmail: b.email,
            userId: b.userId,
          })
        }
        if (!supabase) {
          notify()
          return
        }
        // Guarded update: only the first browser to flip the row sends alerts
        void supabase
          .from('bookings')
          .update({ booking_status: 'forfeit' })
          .eq('id', b.id)
          .eq('booking_status', 'pending')
          .eq('payment_status', 'unpaid')
          .select('id')
          .then(({ data, error }) => {
            if (error) {
              console.warn('Hold expiry update failed:', error.message)
              return
            }
            if (data && data.length > 0) notify()
          })
      })
    }
    sweep()
    const timer = window.setInterval(sweep, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [bookings])

  // ---------------------------------------------------------------------------
  // Automated 1-week event reminder (client SMS + email + in-app, admin in-app)
  // ---------------------------------------------------------------------------
  const reminderInFlightRef = React.useRef(new Set<string>())
  useEffect(() => {
    if (!currentUser || bookings.length === 0) return
    const REMINDER_LOCAL_KEY = 'sinag_event_reminders_sent'
    const readSent = (): string[] => {
      try {
        return JSON.parse(localStorage.getItem(REMINDER_LOCAL_KEY) || '[]')
      } catch {
        return []
      }
    }
    const markSentLocal = (id: string) => {
      try {
        localStorage.setItem(REMINDER_LOCAL_KEY, JSON.stringify([...new Set([...readSent(), id])]))
      } catch {
        // ignore
      }
    }

    const due = bookings.filter((b) => {
      if (b.reminderSentAt) return false
      if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit' || b.bookingStatus === 'completed') return false
      if (isReserveHold(b)) return false
      const days = daysUntilEvent(b.eventDate)
      return days >= 0 && days <= EVENT_REMINDER_DAYS
    })
    // Clients only process their own bookings; admins process all
    const scoped = currentUser.role === 'admin'
      ? due
      : due.filter((b) => b.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim())

    scoped.forEach((b) => {
      if (reminderInFlightRef.current.has(b.id) || readSent().includes(b.id)) return
      reminderInFlightRef.current.add(b.id)
      const sentAt = new Date().toISOString()

      const dispatch = () => {
        markSentLocal(b.id)
        setBookings((prev) => prev.map((bk) => (bk.id === b.id ? { ...bk, reminderSentAt: sentAt } : bk)))
        const clientText = `Sinag Catering Reminder: Your event is coming up in 1 week! Booking Reference: ${b.id} on ${b.eventDate}. We are excited to serve you. Check your portal for full details.`
        sendSemaphoreSMS(b.phone, clientText, b.id).catch(console.error)
        sendTransactionalEmail(b.email, `Sinag Catering Reminder: Your event is in 1 week (#${b.id})`, clientText, b.id).catch(console.error)
        pushClientNotification({
          id: `nt-rem-c-${b.id}`,
          type: 'event_reminder',
          title: 'Your event is 1 week away!',
          message: clientText,
          bookingId: b.id,
          recipientEmail: b.email,
          userId: b.userId,
        })
        addAdminNotification({
          id: `nt-rem-a-${b.id}`,
          type: 'event_reminder',
          title: 'Upcoming Event Alert',
          message: `Upcoming Event Alert: Booking ${b.id} (${b.customerName}) is scheduled in 7 days on ${b.eventDate}. Please coordinate final preparations.`,
          bookingId: b.id,
        })
      }

      if (!supabase) {
        dispatch()
        return
      }
      // Claim the reminder atomically so it is only sent once across sessions
      void supabase
        .from('bookings')
        .update({ reminder_sent_at: sentAt })
        .eq('id', b.id)
        .is('reminder_sent_at', null)
        .select('id')
        .then(({ data, error }) => {
          if (error) {
            // Column not migrated: only the admin session sends (once per browser)
            if (isMissingColumnError(error) && currentUser.role === 'admin') dispatch()
            return
          }
          if (data && data.length > 0) dispatch()
        })
    })
  }, [bookings, currentUser?.id, currentUser?.role])

  const rebookEvent = (bookingId: string, newDate: string): { success: boolean; message: string } => {
    if (blockedDates.includes(newDate)) {
      return { success: false, message: 'The selected date is blocked for inventory/operations.' }
    }

    const dateConflict = bookings.some(
      (b) => b.eventDate === newDate && b.id !== bookingId && isBookingOccupyingDate(b),
    )
    if (dateConflict) {
      return { success: false, message: 'This date is already fully reserved. Please pick another date.' }
    }

    const eventTime = new Date(newDate).getTime()
    const nowTime = new Date().getTime()
    const diffDays = Math.ceil((eventTime - nowTime) / (1000 * 60 * 60 * 24))
    if (diffDays < 14) {
      return { success: false, message: 'Rebooking must be scheduled at least 14 days before the event.' }
    }

    setBookings((prev) =>
      prev.map((bk) => (bk.id === bookingId ? { ...bk, eventDate: newDate, bookingStatus: 'pending' } : bk)),
    )

    if (supabase) {
      supabase.from('bookings').update({
        event_date: newDate,
        booking_status: 'pending',
      }).eq('id', bookingId).then(({ error }) => {
        if (error) console.error('Error rebooking in Supabase:', error.message)
      })
    }

    return { success: true, message: 'Event successfully rebooked! Status returned to Pending for verification.' }
  }

  const addReview = (rating: number, comment: string, imageUrl: string | null) => {
    const newReview: Review = {
      id: `rev-${Date.now()}`,
      userName: currentUser?.name || 'Anonymous',
      rating,
      comment,
      imageUrl,
      date: new Date().toISOString().split('T')[0],
      reply: null,
    }
    setReviews((prev) => [newReview, ...prev])

    if (supabase) {
      supabase.from('reviews').insert({
        id: newReview.id,
        user_name: newReview.userName,
        rating: newReview.rating,
        comment: newReview.comment,
        image_url: newReview.imageUrl,
        date: newReview.date,
        reply: null,
      }).then(({ error }) => {
        if (error) console.error('Error adding review in Supabase:', error.message)
      })
    }
  }

  const replyReview = (reviewId: string, reply: string) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, reply } : r)))

    if (supabase) {
      supabase.from('reviews').update({ reply }).eq('id', reviewId).then(({ error }) => {
        if (error) console.error('Error replying review in Supabase:', error.message)
      })
    }
  }

  const deleteReview = (reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId))

    if (supabase) {
      supabase.from('reviews').delete().eq('id', reviewId).then(({ error }) => {
        if (error) console.error('Error deleting review in Supabase:', error.message)
      })
    }
  }

  const allocateStaff = (bookingId: string, staffIds: string[], assignedServices: string[] = []) => {
    setBookings((prev) => prev.map((bk) => (bk.id === bookingId ? { ...bk, staffIds, assignedServices } : bk)))

    if (supabase) {
      const client = supabase
      client.from('bookings').update({ staff_ids: staffIds, assigned_services: assignedServices }).eq('id', bookingId).then(({ error }) => {
        if (error) {
          // Fallback if assigned_services column has not been added to Supabase yet
          client.from('bookings').update({ staff_ids: staffIds }).eq('id', bookingId)
        }
      })
    }
  }

  const addStaff = async (staffData: Omit<Staff, 'id' | 'status'>): Promise<Staff> => {
    const newStaff: Staff = {
      ...staffData,
      id: `st-${Date.now()}`,
      status: 'available',
    }
    setBaseStaff((prev) => [...prev, newStaff])

    if (supabase) {
      const dbPayload: any = {
        id: newStaff.id,
        name: newStaff.name,
        role: newStaff.role,
        status: newStaff.status,
        age: newStaff.age,
        off_days: newStaff.offDays || [],
      }
      const { error } = await supabase.from('staff').insert(dbPayload)
      if (error) {
        // Fallback without age/off_days if schema not migrated
        await supabase.from('staff').insert({
          id: newStaff.id,
          name: newStaff.name,
          role: newStaff.role,
          status: newStaff.status,
        })
      }
    }
    return newStaff
  }

  const removeStaff = async (staffId: string): Promise<void> => {
    setBaseStaff((prev) => prev.filter((s) => s.id !== staffId))
    if (supabase) {
      const { error } = await supabase.from('staff').delete().eq('id', staffId)
      if (error) console.error('Error deleting staff from Supabase:', error.message)
    }
  }

  const blockDate = (date: string) => {
    if (!blockedDates.includes(date)) {
      setBlockedDates((prev) => [...prev, date])
      if (supabase) {
        supabase.from('blocked_dates').insert({ date, reason: 'Management reservation / inventory lock' }).then(({ error }) => {
          if (error) console.error('Error blocking date in Supabase:', error.message)
        })
      }
    }
  }

  const unblockDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((d) => d !== date))
    if (supabase) {
      supabase.from('blocked_dates').delete().eq('date', date).then(({ error }) => {
        if (error) console.error('Error unblocking date in Supabase:', error.message)
      })
    }
  }

  const respondInquiry = (inquiryId: string, replyText: string) => {
    setInquiries((prev) =>
      prev.map((inq) => (inq.id === inquiryId ? { ...inq, replied: true, replyText } : inq)),
    )
    if (supabase) {
      supabase.from('catering_inquiries').update({ replied: true, reply_text: replyText }).eq('id', inquiryId).then(({ error }) => {
        if (error) console.error('Error responding inquiry in Supabase:', error.message)
      })
    }
  }

  const createInquiryDirect = (name: string, email: string, message: string) => {
    const newInq: Inquiry = {
      id: `inq-${Date.now()}`,
      customerName: name,
      email,
      message,
      replied: false,
      replyText: null,
      date: new Date().toISOString(),
    }
    setInquiries((prev) => [newInq, ...prev])

    addAdminNotification({
      type: 'inquiry_new',
      title: 'New Customer Inquiry',
      message: `${name} sent an inquiry: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`,
    })

    if (supabase) {
      supabase.from('catering_inquiries').insert({
        customer_name: name,
        email,
        phone: '0928 714 4597',
        event_type: 'General Inquiry',
        guest_count: 50,
        package_name: 'Inquiry',
        notes: message,
        replied: false,
      }).then(({ error }) => {
        if (error) console.error('Error creating inquiry in Supabase:', error.message)
      })
    }
  }

  const updatePaymentStatus = (bookingId: string, paymentStatus: Booking['paymentStatus'], amount?: number) => {
    setBookings((prev) =>
      prev.map((bk) => {
        if (bk.id !== bookingId) return bk
        const updated: Booking = { ...bk, paymentStatus }
        if (paymentStatus === 'fully_paid') {
          updated.bookingStatus = 'completed'
          addAdminNotification({
            type: 'booking_completed',
            title: 'Booking Completed & Fully Paid',
            message: `Booking #${bk.id} (${bk.customerName}) has completed full payment of ${formatMoney(bk.totalPrice, bk.currency)}. Reservation moved to Completed.`,
            bookingId: bk.id,
          })
        }
        if (paymentStatus === 'downpayment_paid' || paymentStatus === 'fully_paid') {
          if (getPaymentTerm(bk) === 'reserve') {
            updated.paymentTerm = paymentStatus === 'fully_paid' ? 'full' : 'downpayment'
            updated.holdExpiresAt = null
          }
          pushClientNotification({
            type: 'payment_confirmed',
            title: paymentStatus === 'fully_paid' ? 'Full payment confirmed' : 'Downpayment confirmed',
            message: paymentStatus === 'fully_paid'
              ? `Booking ${bk.id} (${bk.eventDate}) is now fully paid. Thank you!`
              : `Your downpayment for booking ${bk.id} (${bk.eventDate}) was confirmed. Your date is locked.`,
            bookingId: bk.id,
            recipientEmail: bk.email,
            userId: bk.userId,
          })
        }
        if (paymentStatus === 'downpayment_paid') {
          updated.downpaymentAmount = amount ?? bk.downpaymentAmount ?? bk.totalPrice * 0.5
          addAdminNotification({
            type: 'booking_confirmed',
            title: 'Downpayment Verified',
            message: `Downpayment of ${formatMoney(updated.downpaymentAmount, bk.currency)} verified for Booking #${bk.id} (${bk.customerName}).`,
            bookingId: bk.id,
          })
        }
        return updated
      }),
    )

    if (supabase) {
      const client = supabase
      const target = bookings.find((b) => b.id === bookingId)
      const wasReserve = target ? getPaymentTerm(target) === 'reserve' : false
      void writeBookingRow(
        {
          payment_status: paymentStatus,
          ...(paymentStatus === 'fully_paid' ? { booking_status: 'completed' } : {}),
          ...(amount ? { downpayment_amount: amount } : {}),
          ...(wasReserve && (paymentStatus === 'downpayment_paid' || paymentStatus === 'fully_paid')
            ? { payment_term: paymentStatus === 'fully_paid' ? 'full' : 'downpayment', hold_expires_at: null }
            : {}),
        },
        (row) => client.from('bookings').update(row).eq('id', bookingId),
      ).then((error) => {
        if (error) console.error('Error updating payment status in Supabase:', error.message)
      })
    }
  }

  const notifyUsers = (emails: string[], subject: string, message: string) => {
    console.log('notifyUsers:', { emails, subject, message })
  }

  const updateBookingStatus = (
    bookingId: string,
    bookingStatus: Booking['bookingStatus'],
    paymentStatus?: Booking['paymentStatus'],
  ) => {
    let targetBooking: Booking | undefined
    setBookings((prev) =>
      prev.map((bk) => {
        if (bk.id === bookingId) {
          const updated: Booking = { ...bk, bookingStatus }
          if (paymentStatus) {
            updated.paymentStatus = paymentStatus
          } else {
            if (bookingStatus === 'confirmed' && bk.paymentStatus === 'pending_verification') {
              updated.paymentStatus = 'downpayment_paid'
            }
          }
          targetBooking = updated
          return updated
        }
        return bk
      }),
    )

    if (targetBooking && bookingStatus === 'confirmed') {
      blockDate((targetBooking as Booking).eventDate)
      sendPaymentVerificationNotifications(targetBooking as Booking).catch(console.error)
      addAdminNotification({
        type: 'booking_confirmed',
        title: 'Booking Approved & Confirmed',
        message: `Booking #${targetBooking.id} (${targetBooking.customerName}) was confirmed for ${targetBooking.eventDate}.`,
        bookingId: targetBooking.id,
      })
    }

    if (supabase) {
      supabase.from('bookings').update({
        booking_status: bookingStatus,
        ...(paymentStatus ? { payment_status: paymentStatus } : {}),
      }).eq('id', bookingId).then(({ error }) => {
        if (error) console.error('Error updating booking status in Supabase:', error.message)
      })
    }
  }

  const verifyDownpaymentBooking = (bookingId: string, verifiedAmount?: number) => {
    let targetBooking: Booking | undefined
    setBookings((prev) =>
      prev.map((bk) => {
        if (bk.id === bookingId) {
          const finalAmount = verifiedAmount ?? bk.downpaymentAmount ?? bk.totalPrice * 0.5
          const isFull = finalAmount >= bk.totalPrice || (bk.paymentTerm === 'full' && verifiedAmount === undefined)
          // Anything below the 50% downpayment (e.g. the ₱2,000 reservation fee) is a partial payment
          const isPartial = !isFull && finalAmount < Math.round(bk.totalPrice * 0.5)
          targetBooking = {
            ...bk,
            bookingStatus: 'confirmed',
            paymentStatus: isFull ? 'fully_paid' : isPartial ? 'partially_paid' : 'downpayment_paid',
            downpaymentAmount: finalAmount,
            paymentTerm: isFull ? 'full' : isPartial ? (bk.paymentTerm ?? 'reserve') : 'downpayment',
            holdExpiresAt: null,
          }
          return targetBooking
        }
        return bk
      }),
    )

    if (targetBooking) {
      blockDate((targetBooking as Booking).eventDate)
      sendPaymentVerificationNotifications(targetBooking as Booking).catch(console.error)
      const isFull = (targetBooking as Booking).paymentStatus === 'fully_paid'
      const isFee = (targetBooking as Booking).paymentStatus === 'partially_paid'
      const payLabel = isFull ? 'full payment' : isFee ? 'reservation fee' : 'downpayment'
      addAdminNotification({
        type: 'booking_confirmed',
        title: isFull ? 'Full Payment Verified & Confirmed' : isFee ? 'Reservation Fee Verified & Confirmed' : 'Downpayment Verified & Confirmed',
        message: `Booking #${targetBooking.id} (${targetBooking.customerName}) confirmed for ${targetBooking.eventDate}. SMS and email notifications dispatched.`,
        bookingId: targetBooking.id,
      })
      const verified = targetBooking as Booking
      pushClientNotification({
        type: 'payment_confirmed',
        title: `${payLabel.charAt(0).toUpperCase()}${payLabel.slice(1)} verified – booking confirmed`,
        message: `Your ${payLabel} of ${formatMoney(verified.downpaymentAmount || 0, verified.currency)} for booking ${verified.id} was verified. Your date (${verified.eventDate}) is locked.`,
        bookingId: verified.id,
        recipientEmail: verified.email,
        userId: verified.userId,
      })

      if (supabase) {
        const client = supabase
        void writeBookingRow(
          {
            booking_status: 'confirmed',
            payment_status: verified.paymentStatus,
            downpayment_amount: verified.downpaymentAmount,
            payment_term: verified.paymentTerm,
            hold_expires_at: null,
          },
          (row) => client.from('bookings').update(row).eq('id', bookingId),
        ).then((error) => {
          if (error) console.error('Error verifying downpayment in Supabase:', error.message)
        })
      }
    }
  }

  const refreshCatalog = async () => {
    if (!supabase) return
    try {
      const [pkgRes, menuRes, addonRes] = await Promise.all([
        supabase.from('packages').select('*').order('base_price', { ascending: true }),
        supabase.from('menu_items').select('*').order('sort_order', { ascending: true }),
        supabase.from('package_addons').select('*').order('price', { ascending: true }),
      ])
      if (!pkgRes.error && pkgRes.data) {
        setPackages(pkgRes.data.map(mapDatabasePackage))
      }
      if (!menuRes.error && menuRes.data && menuRes.data.length > 0) {
        setMenuItems(menuRes.data.map(mapDbMenuItem))
      }
      if (!addonRes.error && addonRes.data && addonRes.data.length > 0) {
        setAddons(addonRes.data.map(mapDbAddon))
      }
    } catch (err) {
      console.error('Error refreshing catalog:', err)
    }
  }

  const savePackage = async (pkg: CateringPackage): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiCatalogRequest('save_package', { package: pkg })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to save package to database' }
      }
      setPackages((prev) => {
        const idx = prev.findIndex((p) => p.id === pkg.id)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = pkg
          return updated
        }
        return [...prev, pkg]
      })
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error saving package' }
    }
  }

  const deletePackage = async (packageId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiCatalogRequest('delete_package', { packageId })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to delete package' }
      }
      setPackages((prev) => prev.filter((p) => p.id !== packageId))
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error deleting package' }
    }
  }

  const saveMenuItem = async (item: Partial<MenuItem> & { name: string; category: 'main' | 'pasta' | 'drink' }): Promise<{ success: boolean; error?: string }> => {
    try {
      const fullItem: MenuItem = {
        id: item.id || `menu-${item.category}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: item.name.trim(),
        category: item.category,
        description: item.description || '',
        tag: item.tag,
        imageUrl: item.imageUrl,
        color: item.color || '#B45309',
        accentColor: item.accentColor || '#FEF3C7',
        active: item.active ?? true,
        sortOrder: item.sortOrder ?? 0,
      }
      const res = await apiCatalogRequest('save_menu_item', { menuItem: fullItem })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to save menu item to database' }
      }
      setMenuItems((prev) => {
        const idx = prev.findIndex((m) => m.id === fullItem.id || (m.name.toLowerCase() === fullItem.name.toLowerCase() && m.category === fullItem.category))
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = { ...prev[idx], ...fullItem }
          return updated
        }
        return [...prev, fullItem]
      })
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error saving menu item' }
    }
  }

  const toggleMenuItemActive = async (itemId: string, active: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiCatalogRequest('toggle_menu_item_active', { itemId, active })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to update item availability' }
      }
      setMenuItems((prev) => prev.map((m) => (m.id === itemId ? { ...m, active } : m)))
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error toggling menu item' }
    }
  }

  const deleteMenuItem = async (itemId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiCatalogRequest('delete_menu_item', { itemId })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to delete menu item' }
      }
      setMenuItems((prev) => prev.filter((m) => m.id !== itemId))
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error deleting menu item' }
    }
  }

  const saveAddon = async (addon: Partial<CateringAddon> & { name: string; price: number }): Promise<{ success: boolean; error?: string }> => {
    try {
      const fullAddon: CateringAddon = {
        id: addon.id || `addon-${Date.now().toString().slice(-4)}`,
        name: addon.name.trim(),
        price: Number(addon.price),
        currency: 'PHP',
        rateType: addon.rateType || 'flat',
        description: addon.description || '',
      }
      const res = await apiCatalogRequest('save_addon', { addon: fullAddon })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to save add-on' }
      }
      setAddons((prev) => {
        const idx = prev.findIndex((a) => a.id === fullAddon.id)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = { ...prev[idx], ...fullAddon }
          return updated
        }
        return [...prev, fullAddon]
      })
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error saving addon' }
    }
  }

  const deleteAddon = async (addonId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiCatalogRequest('delete_addon', { addonId })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to delete add-on' }
      }
      setAddons((prev) => prev.filter((a) => a.id !== addonId))
      await refreshCatalog()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error deleting addon' }
    }
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        packages,
        menuItems,
        addons,
        bookings,
        reviews,
        staff,
        blockedDates,
        inquiries,
        signIn,
        signUp,
        logout,
        signInWithGoogle,
        googleAuth,
        clearGoogleAuthMessage,
        requestPasswordResetOTP,
        verifyAndResetPassword,
        changeUserPassword,
        updateUserProfile,
        createBooking,
        uploadPayment,
        cancelBooking,
        markRefundProcessed,
        clientNotifications,
        markClientNotificationRead,
        markAllClientNotificationsRead,
        needsTermsAcceptance,
        acceptTerms,
        fetchCustomers,
        rebookEvent,
        addReview,
        replyReview,
        deleteReview,
        allocateStaff,
        addStaff,
        removeStaff,
        blockDate,
        unblockDate,
        respondInquiry,
        createInquiryDirect,
        updateBookingStatus,
        updatePaymentStatus,
        verifyDownpaymentBooking,
        notifyUsers,
        adminNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAdminNotifications,
        addAdminNotification,
        playNotificationSound,
        savePackage,
        deletePackage,
        saveMenuItem,
        toggleMenuItemActive,
        deleteMenuItem,
        saveAddon,
        deleteAddon,
        refreshCatalog,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
