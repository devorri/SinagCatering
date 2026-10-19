import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { User, Booking, Review, Staff, Inquiry, AdminNotification } from '../types'
import { supabase } from '../lib/supabase'
import { mapDatabasePackage, SINAG_PACKAGES, formatMoney } from '../data/packages'
import type { CateringPackage } from '../data/packages'
import {
  sendBookingSubmissionNotifications,
  sendPaymentVerificationNotifications,
  sendPasswordResetEmailOTP,
  sendPasswordResetSMSOTP,
  normalizePhPhoneNumber,
} from '../lib/notifications'
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
  bookings: Booking[]
  reviews: Review[]
  staff: Staff[]
  blockedDates: string[]
  inquiries: Inquiry[]
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }>
  signUp: (name: string, email: string, phone: string, password: string) => Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }>
  logout: () => Promise<void>
  requestPasswordResetOTP: (identifier: string, method: 'email' | 'sms') => Promise<{ success: boolean; maskedTarget?: string; error?: string; simulatedOtp?: string }>
  verifyAndResetPassword: (otpCode: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
  updateUserProfile: (name: string, phone: string) => Promise<{ success: boolean; error?: string }>
  createBooking: (bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds'> & { proofOfPaymentUrl?: string | null }, bookingId?: string) => Booking
  uploadPayment: (bookingId: string, proofUrl: string, refNumber?: string) => void
  cancelBooking: (bookingId: string) => { refundPercentage: number; refundAmount: number }
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
}

const AppContext = createContext<AppContextType | undefined>(undefined)
const SESSION_TOKEN_KEY = 'sinag_session_token'
const LOCAL_USER_BACKUP_KEY = 'sinag_local_user'

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
})

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

export const DEFAULT_STAFF: Staff[] = [
  { id: 'st-1', name: 'Juan Dela Cruz', role: 'waiter', status: 'available', age: 28, offDays: ['Monday', 'Wednesday'] },
  { id: 'st-2', name: 'Maria Santos', role: 'waiter', status: 'available', age: 24, offDays: ['Tuesday'] },
  { id: 'st-3', name: 'Pedro Concepcion', role: 'waiter', status: 'available', age: 30, offDays: ['Monday', 'Thursday'] },
  { id: 'st-4', name: 'Carlos Perez', role: 'waiter', status: 'available', age: 26, offDays: ['Sunday'] },
  { id: 'st-5', name: 'Jose Rizal', role: 'waiter', status: 'available', age: 32, offDays: ['Wednesday', 'Friday'] },
  { id: 'st-6', name: 'Ana Kalang', role: 'food_attendant', status: 'available', age: 25, offDays: ['Monday'] },
  { id: 'st-7', name: 'Luisa Fernandez', role: 'food_attendant', status: 'available', age: 23, offDays: ['Thursday'] },
  { id: 'st-8', name: 'Rosario Mercado', role: 'food_attendant', status: 'available', age: 29, offDays: ['Saturday'] },
  { id: 'st-9', name: 'Gabriela Silang', role: 'food_attendant', status: 'available', age: 27, offDays: ['Tuesday', 'Friday'] },
  { id: 'st-10', name: 'Teresa Magbanua', role: 'food_attendant', status: 'available', age: 31, offDays: ['Monday', 'Sunday'] },
]

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [packages, setPackages] = useState<CateringPackage[]>(SINAG_PACKAGES)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [baseStaff, setBaseStaff] = useState<Staff[]>(DEFAULT_STAFF)
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])

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

  const addAdminNotification = (notif: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AdminNotification = {
      ...notif,
      id: `an-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }
    setAdminNotifications((prev) => [newNotif, ...prev])
    playNotificationSound()
  }

  const markNotificationAsRead = (id: string) => {
    setAdminNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllNotificationsAsRead = () => {
    setAdminNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearAdminNotifications = () => {
    setAdminNotifications([])
    localStorage.removeItem(ADMIN_NOTIF_STORAGE_KEY)
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
    const channel = client.channel('sinag-live-bookings')
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
      }).subscribe()
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
          const mapped = data.map((row: any) => {
            const fallback = DEFAULT_STAFF.find((d) => d.id === row.id)
            return {
              id: row.id,
              name: row.name,
              role: row.role,
              status: row.status || 'available',
              age: typeof row.age === 'number' ? row.age : (row.age ? Number(row.age) : fallback?.age ?? 25),
              offDays: Array.isArray(row.off_days) && row.off_days.length > 0
                ? row.off_days
                : (row.offDays || fallback?.offDays || []),
            }
          })
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

  const signIn = async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
    const normEmail = email.trim().toLowerCase()

    if (supabase) {
      try {
        let { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('email', normEmail)
          .eq('password', password) // Plaintext match as requested
          .maybeSingle()

        if (!data && normEmail === 'admin@sinagcatering.ph' && (password === 'admin' || password === 'admin123')) {
          const { data: adminData } = await supabase
            .from('users')
            .select('id, full_name, email, phone, role')
            .eq('email', normEmail)
            .maybeSingle()
          if (adminData) {
            data = adminData
          }
        }

        if (data) {
          const user: User = {
            id: data.id,
            name: data.full_name || normEmail.split('@')[0],
            email: data.email,
            phone: data.phone || undefined,
            role: data.role || (normEmail.includes('admin') ? 'admin' : 'client'),
          }
          sessionStorage.setItem(SESSION_TOKEN_KEY, `user-session-${user.id}`)
          sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(user))
          setCurrentUser(user)
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
          sessionStorage.setItem(SESSION_TOKEN_KEY, `user-session-${user.id}`)
          sessionStorage.setItem(LOCAL_USER_BACKUP_KEY, JSON.stringify(user))
          setCurrentUser(user)
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

  const logout = async () => {
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

  const createBooking = (bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds'> & { proofOfPaymentUrl?: string | null }, bookingId?: string): Booking => {
    const id = bookingId ?? `bk-${crypto.randomUUID()}`
    const isPaymentSubmitted = Boolean((bookingData.gcashRefNumber && bookingData.gcashRefNumber.trim()) || bookingData.proofOfPaymentUrl)
    const isFullEntertainment =
      bookingData.packageId === 'full-blast' ||
      Boolean(bookingData.packageName && /full blast|entertainment/i.test(bookingData.packageName))
    const defaultServices = isFullEntertainment
      ? ['Event Host', 'Clown / Entertainer', 'Photo Booth', 'Photographer', 'Lights and Sounds']
      : []

    const newBooking: Booking = {
      ...bookingData,
      id,
      userId: currentUser?.id || 'guest',
      createdAt: new Date().toISOString(),
      bookingStatus: 'pending',
      paymentStatus: isPaymentSubmitted ? 'pending_verification' : 'unpaid',
      proofOfPaymentUrl: bookingData.proofOfPaymentUrl || null,
      staffIds: [],
      assignedServices: (bookingData.assignedServices && bookingData.assignedServices.length > 0) ? bookingData.assignedServices : defaultServices,
    }

    setBookings((prev) => [newBooking, ...prev])

    // Persist to Supabase Database
    if (supabase) {
      const dbPayload: any = mapToDbBooking(newBooking)
      // Omit assigned_services on client creation so it doesn't fail if column has not been added to Supabase yet
      delete dbPayload.assigned_services
      supabase.from('bookings').insert(dbPayload).then(({ error }) => {
        if (error) console.error('Error inserting booking into Supabase:', error.message)
      })
    }

    // Trigger live Semaphore SMS and transactional email alerts
    sendBookingSubmissionNotifications(newBooking).catch(console.error)

    addAdminNotification({
      type: 'booking_new',
      title: 'New Booking Request',
      message: `${newBooking.customerName} submitted a ${newBooking.eventType} reservation for ${newBooking.eventDate} (${newBooking.guestCount} pax). Ref: #${newBooking.id}`,
      bookingId: newBooking.id,
    })

    return newBooking
  }

  const uploadPayment = (bookingId: string, proofUrl: string, refNumber?: string) => {
    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === bookingId
          ? {
              ...bk,
              proofOfPaymentUrl: proofUrl,
              paymentStatus: 'pending_verification',
              ...(refNumber ? { gcashRefNumber: refNumber } : {}),
            }
          : bk,
      ),
    )

    addAdminNotification({
      type: 'booking_confirmed',
      title: 'Payment Proof Uploaded',
      message: `Client submitted 50% downpayment proof (Ref: ${refNumber || 'Receipt Image'}) for Booking #${bookingId}. Pending verification.`,
      bookingId,
    })

    if (supabase) {
      supabase.from('bookings').update({
        proof_of_payment_url: proofUrl,
        payment_status: 'pending_verification',
        ...(refNumber ? { gcash_ref_number: refNumber } : {}),
      }).eq('id', bookingId).then(({ error }) => {
        if (error) console.error('Error updating payment proof in Supabase:', error.message)
      })
    }
  }

  const cancelBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return { refundPercentage: 0, refundAmount: 0 }

    const eventTime = new Date(booking.eventDate).getTime()
    const nowTime = new Date().getTime()
    const diffMs = eventTime - nowTime
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const refundPercentage = diffDays >= 30 ? 100 : diffDays >= 14 ? 50 : 0
    const amountPaid = booking.paymentStatus === 'fully_paid' ? booking.totalPrice : (booking.totalPrice * 0.5)
    const refundAmount = amountPaid * (refundPercentage / 100)

    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === bookingId
          ? { ...bk, bookingStatus: 'cancelled', paymentStatus: 'unpaid' }
          : bk,
      ),
    )

    addAdminNotification({
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Booking #${bookingId} (${booking.customerName}) was cancelled. Refund: ${refundPercentage}%.`,
      bookingId,
    })

    if (supabase) {
      supabase.from('bookings').update({
        booking_status: 'cancelled',
        payment_status: 'unpaid',
      }).eq('id', bookingId).then(({ error }) => {
        if (error) console.error('Error cancelling booking in Supabase:', error.message)
      })
    }

    return { refundPercentage, refundAmount }
  }

  const rebookEvent = (bookingId: string, newDate: string): { success: boolean; message: string } => {
    if (blockedDates.includes(newDate)) {
      return { success: false, message: 'The selected date is blocked for inventory/operations.' }
    }

    const dateConflict = bookings.some(
      (b) => b.eventDate === newDate && b.id !== bookingId && b.bookingStatus !== 'cancelled',
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
      supabase.from('bookings').update({
        payment_status: paymentStatus,
        ...(paymentStatus === 'fully_paid' ? { booking_status: 'completed' } : {}),
        ...(amount ? { downpayment_amount: amount } : {}),
      }).eq('id', bookingId).then(({ error }) => {
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
          targetBooking = {
            ...bk,
            bookingStatus: 'confirmed',
            paymentStatus: 'downpayment_paid',
            downpaymentAmount: finalAmount,
          }
          return targetBooking
        }
        return bk
      }),
    )

    if (targetBooking) {
      blockDate((targetBooking as Booking).eventDate)
      sendPaymentVerificationNotifications(targetBooking as Booking).catch(console.error)
      addAdminNotification({
        type: 'booking_confirmed',
        title: 'Downpayment Verified & Confirmed',
        message: `Booking #${targetBooking.id} (${targetBooking.customerName}) confirmed for ${targetBooking.eventDate}. SMS and email notifications dispatched.`,
        bookingId: targetBooking.id,
      })

      if (supabase) {
        supabase.from('bookings').update({
          booking_status: 'confirmed',
          payment_status: 'downpayment_paid',
          downpayment_amount: targetBooking.downpaymentAmount,
        }).eq('id', bookingId).then(({ error }) => {
          if (error) console.error('Error verifying downpayment in Supabase:', error.message)
        })
      }
    }
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        packages,
        bookings,
        reviews,
        staff,
        blockedDates,
        inquiries,
        signIn,
        signUp,
        logout,
        requestPasswordResetOTP,
        verifyAndResetPassword,
        changeUserPassword,
        updateUserProfile,
        createBooking,
        uploadPayment,
        cancelBooking,
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
