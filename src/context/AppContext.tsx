import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { User, Booking, Review, Staff, Inquiry } from '../types'
import { supabase } from '../lib/supabase'
import {
  sendBookingSubmissionNotifications,
  sendPaymentVerificationNotifications,
} from '../lib/notifications'

interface AppContextType {
  currentUser: User | null
  bookings: Booking[]
  reviews: Review[]
  staff: Staff[]
  blockedDates: string[]
  inquiries: Inquiry[]
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }>
  signUp: (name: string, email: string, phone: string, password: string) => Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }>
  logout: () => Promise<void>
  createBooking: (bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds' | 'proofOfPaymentUrl'>, bookingId?: string) => Booking
  uploadPayment: (bookingId: string, proofUrl: string, refNumber?: string) => void
  cancelBooking: (bookingId: string) => { refundPercentage: number; refundAmount: number }
  rebookEvent: (bookingId: string, newDate: string) => { success: boolean; message: string }
  addReview: (rating: number, comment: string, imageUrl: string | null) => void
  replyReview: (reviewId: string, reply: string) => void
  deleteReview: (reviewId: string) => void
  allocateStaff: (bookingId: string, staffIds: string[], assignedServices?: string[]) => void
  blockDate: (date: string) => void
  unblockDate: (date: string) => void
  respondInquiry: (inquiryId: string, replyText: string) => void
  createInquiryDirect: (name: string, email: string, message: string) => void
  updateBookingStatus: (bookingId: string, bookingStatus: Booking['bookingStatus'], paymentStatus?: Booking['paymentStatus']) => void
  updatePaymentStatus: (bookingId: string, paymentStatus: Booking['paymentStatus'], amount?: number) => void
  verifyDownpaymentBooking: (bookingId: string, verifiedAmount?: number) => void
  notifyUsers: (emails: string[], subject: string, message: string) => void
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
  assignedServices: Array.isArray(row.assigned_services) ? row.assigned_services : [],
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [baseStaff, setBaseStaff] = useState<Staff[]>([])
  const [blockedDates, setBlockedDates] = useState<string[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])

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
        if (!error && data) {
          setBaseStaff(data)
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
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, phone, role')
          .eq('email', normEmail)
          .eq('password', password) // Plaintext match as requested
          .maybeSingle()

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

  const createBooking = (bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds' | 'proofOfPaymentUrl'>, bookingId?: string): Booking => {
    const id = bookingId ?? `bk-${crypto.randomUUID()}`
    const isPaymentSubmitted = Boolean(bookingData.gcashRefNumber && bookingData.gcashRefNumber.trim())
    const newBooking: Booking = {
      ...bookingData,
      id,
      userId: currentUser?.id || 'guest',
      createdAt: new Date().toISOString(),
      bookingStatus: 'pending',
      paymentStatus: isPaymentSubmitted ? 'pending_verification' : 'unpaid',
      proofOfPaymentUrl: null,
      staffIds: [],
      assignedServices: [],
    }

    setBookings((prev) => [newBooking, ...prev])

    // Persist to Supabase Database
    if (supabase) {
      supabase.from('bookings').insert(mapToDbBooking(newBooking)).then(({ error }) => {
        if (error) console.error('Error inserting booking into Supabase:', error.message)
      })
    }

    // Trigger live Semaphore SMS and transactional email alerts
    sendBookingSubmissionNotifications(newBooking).catch(console.error)

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
      supabase.from('bookings').update({ staff_ids: staffIds, assigned_services: assignedServices }).eq('id', bookingId).then(({ error }) => {
        if (error) console.error('Error allocating staff in Supabase:', error.message)
      })
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
        if (paymentStatus === 'fully_paid') updated.bookingStatus = 'completed'
        if (paymentStatus === 'downpayment_paid') {
          updated.downpaymentAmount = amount ?? bk.downpaymentAmount ?? bk.totalPrice * 0.5
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
    setBookings((prev) =>
      prev.map((bk) => {
        if (bk.id === bookingId) {
          const updated: Booking = { ...bk, bookingStatus }
          if (paymentStatus) {
            updated.paymentStatus = paymentStatus
          } else {
            if (bookingStatus === 'confirmed' && bk.paymentStatus === 'pending_verification') {
              updated.paymentStatus = 'partially_paid'
            }
          }
          return updated
        }
        return bk
      }),
    )

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
        bookings,
        reviews,
        staff,
        blockedDates,
        inquiries,
        signIn,
        signUp,
        logout,
        createBooking,
        uploadPayment,
        cancelBooking,
        rebookEvent,
        addReview,
        replyReview,
        deleteReview,
        allocateStaff,
        blockDate,
        unblockDate,
        respondInquiry,
        createInquiryDirect,
        updateBookingStatus,
        updatePaymentStatus,
        verifyDownpaymentBooking,
        notifyUsers,
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
