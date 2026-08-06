import React, { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User, Booking, Review, Staff, Inquiry } from '../types'

interface AppContextType {
  currentUser: User | null
  bookings: Booking[]
  reviews: Review[]
  staff: Staff[]
  blockedDates: string[]
  inquiries: Inquiry[]
  login: (email: string, name: string, role: 'client' | 'admin') => User
  logout: () => void
  createBooking: (bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds' | 'proofOfPaymentUrl'>) => Booking
  uploadPayment: (bookingId: string, proofUrl: string) => void
  cancelBooking: (bookingId: string) => { refundPercentage: number; refundAmount: number }
  rebookEvent: (bookingId: string, newDate: string) => { success: boolean; message: string }
  addReview: (rating: number, comment: string, imageUrl: string | null) => void
  replyReview: (reviewId: string, reply: string) => void
  deleteReview: (reviewId: string) => void
  allocateStaff: (bookingId: string, staffIds: string[]) => void
  blockDate: (date: string) => void
  unblockDate: (date: string) => void
  respondInquiry: (inquiryId: string, replyText: string) => void
  createInquiryDirect: (name: string, email: string, message: string) => void
  updateBookingStatus: (bookingId: string, bookingStatus: Booking['bookingStatus'], paymentStatus?: Booking['paymentStatus']) => void
  updatePaymentStatus: (bookingId: string, paymentStatus: Booking['paymentStatus'], amount?: number) => void
  notifyUsers: (emails: string[], subject: string, message: string) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

const DEFAULT_STAFF: Staff[] = [
  { id: 'st-1', name: 'Juan Dela Cruz', role: 'waiter', status: 'available' },
  { id: 'st-2', name: 'Maria Santos', role: 'waiter', status: 'available' },
  { id: 'st-3', name: 'Pedro Concepcion', role: 'waiter', status: 'available' },
  { id: 'st-4', name: 'Carlos Perez', role: 'waiter', status: 'available' },
  { id: 'st-5', name: 'Jose Rizal', role: 'waiter', status: 'available' },
  { id: 'st-6', name: 'Ana Kalang', role: 'food_attendant', status: 'available' },
  { id: 'st-7', name: 'Luisa Fernandez', role: 'food_attendant', status: 'available' },
  { id: 'st-8', name: 'Miguel Lopez', role: 'food_attendant', status: 'available' },
  { id: 'st-9', name: 'Sofia Loren', role: 'food_attendant', status: 'available' },
  { id: 'st-10', name: 'Gabriela Silang', role: 'food_attendant', status: 'available' },
]

const DEFAULT_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    userName: 'Maria Santos',
    rating: 5,
    comment: 'The Sinag Signature package was absolutely outstanding! The Lechon Belly carving station wowed our guests, and the seafood paella was cooked to perfection. Highly recommended for weddings!',
    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=500&auto=format&fit=crop&q=60',
    date: '2026-05-18',
    reply: 'Thank you Maria! We are thrilled to hear that the Lechon Belly and Seafood Paella made your wedding feast memorable. It was our pleasure to serve you!',
  },
  {
    id: 'rev-2',
    userName: 'Juan Dela Cruz',
    rating: 5,
    comment: 'Booked the Fiesta Table for my son’s baptism. Food was delivered warm, generous portions, and the beef caldereta was super tender. Guest count exceeded and excess head fee was very fair.',
    imageUrl: null,
    date: '2026-05-28',
    reply: null,
  },
  {
    id: 'rev-3',
    userName: 'Dr. Evelyn Castro',
    rating: 4,
    comment: 'Excellent service during our corporate seminar. They accommodated our custom requests (swapped Pork for Chicken and added extra side dishes). The waiters were professional and polite.',
    imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=500&auto=format&fit=crop&q=60',
    date: '2026-06-02',
    reply: 'We appreciate the feedback, Dr. Castro! Glad our menu customization and service met your corporate event needs.',
  },
]

const DEFAULT_INQUIRIES: Inquiry[] = [
  {
    id: 'inq-1',
    customerName: 'Leandro V.',
    email: 'leandro@email.com',
    message: 'Hello, do you cater in Malolos, Bulacan? And is there an extra out-of-town charge for Bulacan?',
    replied: true,
    replyText: 'Yes Leandro! We cater in Metro Manila and nearby provinces including Bulacan. For Bulacan events, we charge a modest out-of-town delivery fee depending on the exact municipality, which will be computed upon booking request approval.',
    date: '2026-06-08T14:30:00Z',
  },
  {
    id: 'inq-2',
    customerName: 'Sarah Jenkins',
    email: 'sarah.j@email.com',
    message: 'Can I choose standard packages but swap out Buko Pandan for Mango Float? What are the charges?',
    replied: false,
    replyText: null,
    date: '2026-06-08T18:45:00Z',
  },
]

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sinag_user')
    return saved ? JSON.parse(saved) : null
  })

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('sinag_bookings')
    if (saved) return JSON.parse(saved)

    // Seed bookings
    const now = new Date()
    const formatDate = (daysAhead: number) => {
      const d = new Date()
      d.setDate(now.getDate() + daysAhead)
      return d.toISOString().split('T')[0]
    }

    const seeds: Booking[] = [
      {
        id: 'bk-1001',
        userId: 'usr-client1',
        customerName: 'Maria Santos',
        email: 'maria@email.com',
        phone: '+63 917 123 4567',
        eventType: 'Wedding',
        eventDate: formatDate(21), // 3 weeks ahead
        guestCount: 150,
        packageName: 'Sinag Signature',
        basePrice: 880,
        extraPaxFee: 0,
        addOns: { extraMainCount: 1, extraPastaCount: 0, extraDessertCount: 1 },
        totalPrice: 150 * 880 + 150 * 100 + 150 * 50, // 880 base + 100 extra main + 50 extra dessert
        bookingStatus: 'confirmed',
        paymentStatus: 'partially_paid', // paid downpayment
        proofOfPaymentUrl: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=500&auto=format&fit=crop&q=60', // mock GCash screenshot
        staffIds: ['st-1', 'st-2', 'st-3', 'st-6', 'st-7', 'st-8'], // 3 waiters, 3 attendants
        notes: 'Wants cream-colored tablecloths and elegant rustic flower styling.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'bk-1002',
        userId: 'usr-client2',
        customerName: 'Juan Dela Cruz',
        email: 'juan@email.com',
        phone: '+63 918 765 4321',
        eventType: 'Birthday',
        eventDate: formatDate(10), // 10 days ahead (pending approval / verification)
        guestCount: 80,
        packageName: 'Fiesta Table',
        basePrice: 620,
        extraPaxFee: 0,
        addOns: { extraMainCount: 0, extraPastaCount: 1, extraDessertCount: 0 },
        totalPrice: 80 * 620 + 80 * 80, // base 620 + extra pasta 80
        bookingStatus: 'pending',
        paymentStatus: 'pending_verification',
        proofOfPaymentUrl: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=500&auto=format&fit=crop&q=60',
        staffIds: [],
        notes: 'Celebration of 60th birthday. Needs low-back chairs for seniors.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'bk-1003',
        userId: 'usr-client1',
        customerName: 'Maria Santos',
        email: 'maria@email.com',
        phone: '+63 917 123 4567',
        eventType: 'Private dinner',
        eventDate: formatDate(40), // > 1 month ahead
        guestCount: 30,
        packageName: 'Handaan Classic',
        basePrice: 420,
        extraPaxFee: 0,
        addOns: { extraMainCount: 0, extraPastaCount: 0, extraDessertCount: 0 },
        totalPrice: 30 * 420,
        bookingStatus: 'pending',
        paymentStatus: 'unpaid',
        proofOfPaymentUrl: null,
        staffIds: [],
        notes: 'Family gathering. Spicy food preferred.',
        createdAt: new Date().toISOString(),
      },
    ]
    return seeds
  })

  const [reviews, setReviews] = useState<Review[]>(() => {
    const saved = localStorage.getItem('sinag_reviews')
    return saved ? JSON.parse(saved) : DEFAULT_REVIEWS
  })

  const [staff, setStaff] = useState<Staff[]>(() => {
    const saved = localStorage.getItem('sinag_staff')
    return saved ? JSON.parse(saved) : DEFAULT_STAFF
  })

  const [blockedDates, setBlockedDates] = useState<string[]>(() => {
    const saved = localStorage.getItem('sinag_blocked_dates')
    return saved ? JSON.parse(saved) : ['2026-06-25']
  })

  const [inquiries, setInquiries] = useState<Inquiry[]>(() => {
    const saved = localStorage.getItem('sinag_inquiries')
    return saved ? JSON.parse(saved) : DEFAULT_INQUIRIES
  })

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('sinag_user', currentUser ? JSON.stringify(currentUser) : '')
  }, [currentUser])

  useEffect(() => {
    localStorage.setItem('sinag_bookings', JSON.stringify(bookings))
  }, [bookings])

  useEffect(() => {
    localStorage.setItem('sinag_reviews', JSON.stringify(reviews))
  }, [reviews])

  useEffect(() => {
    localStorage.setItem('sinag_staff', JSON.stringify(staff))
  }, [staff])

  useEffect(() => {
    localStorage.setItem('sinag_blocked_dates', JSON.stringify(blockedDates))
  }, [blockedDates])

  useEffect(() => {
    localStorage.setItem('sinag_inquiries', JSON.stringify(inquiries))
  }, [inquiries])

  // Update staff available status based on bookings (mock schedule)
  useEffect(() => {
    setStaff((prevStaff) => {
      // Find all busy staff (assigned to future active confirmed bookings)
      const busyStaffIds = new Set<string>()
      bookings.forEach((booking) => {
        if (booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'approved') {
          booking.staffIds.forEach((id) => busyStaffIds.add(id))
        }
      })
      return prevStaff.map((s) => ({
        ...s,
        status: busyStaffIds.has(s.id) ? 'busy' : 'available',
      }))
    })
  }, [bookings])

  const login = (email: string, name: string, role: 'client' | 'admin'): User => {
    const id = role === 'admin' ? 'usr-admin' : `usr-${Math.random().toString(36).substr(2, 9)}`
    const user: User = { id, name, email, role }
    setCurrentUser(user)
    return user
  }

  const logout = () => {
    setCurrentUser(null)
  }

  const createBooking = (bookingData: Omit<Booking, 'id' | 'userId' | 'createdAt' | 'bookingStatus' | 'paymentStatus' | 'staffIds' | 'proofOfPaymentUrl'>): Booking => {
    const id = `bk-${Math.floor(1000 + Math.random() * 9000)}`
    const newBooking: Booking = {
      ...bookingData,
      id,
      userId: currentUser?.id || 'guest',
      createdAt: new Date().toISOString(),
      bookingStatus: 'pending',
      paymentStatus: 'unpaid',
      proofOfPaymentUrl: null,
      staffIds: [],
    }

    setBookings((prev) => [newBooking, ...prev])
    return newBooking
  }

  const uploadPayment = (bookingId: string, proofUrl: string) => {
    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === bookingId
          ? { ...bk, proofOfPaymentUrl: proofUrl, paymentStatus: 'pending_verification' }
          : bk,
      ),
    )
  }

  const cancelBooking = (bookingId: string) => {
    const booking = bookings.find((b) => b.id === bookingId)
    if (!booking) return { refundPercentage: 0, refundAmount: 0 }

    // Refund policy terms:
    // - 1 month or more: 100% refund
    // - 2-4 weeks: 50% refund
    // - < 2 weeks: non-refundable
    const eventTime = new Date(booking.eventDate).getTime()
    const nowTime = new Date().getTime()
    const diffMs = eventTime - nowTime
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    let refundPercentage = 0
    if (diffDays >= 30) {
      refundPercentage = 100
    } else if (diffDays >= 14) {
      refundPercentage = 50
    } else {
      refundPercentage = 0
    }

    // Downpayment is 50% of total price. So refund is calculated based on what they already paid
    // But since it's mock, we assume they paid 50% if status is partially_paid or fully_paid.
    const amountPaid = booking.paymentStatus === 'fully_paid' ? booking.totalPrice : (booking.totalPrice * 0.5)
    const refundAmount = amountPaid * (refundPercentage / 100)

    setBookings((prev) =>
      prev.map((bk) =>
        bk.id === bookingId
          ? { ...bk, bookingStatus: 'cancelled', paymentStatus: 'unpaid' }
          : bk,
      ),
    )

    return { refundPercentage, refundAmount }
  }

  const rebookEvent = (bookingId: string, newDate: string): { success: boolean; message: string } => {
    // Check if newDate is blocked or already booked (conflicting)
    if (blockedDates.includes(newDate)) {
      return { success: false, message: 'The selected date is blocked for inventory/operations.' }
    }

    const dateConflict = bookings.some(
      (b) => b.eventDate === newDate && b.id !== bookingId && b.bookingStatus !== 'cancelled',
    )
    if (dateConflict) {
      return { success: false, message: 'This date is already fully reserved. Please pick another date.' }
    }

    // Rule: must book/rebook at least 1 week in advance
    const eventTime = new Date(newDate).getTime()
    const nowTime = new Date().getTime()
    const diffDays = Math.ceil((eventTime - nowTime) / (1000 * 60 * 60 * 24))
    if (diffDays < 7) {
      return { success: false, message: 'Rebooking must be scheduled at least 1 week before the event.' }
    }

    setBookings((prev) =>
      prev.map((bk) => (bk.id === bookingId ? { ...bk, eventDate: newDate, bookingStatus: 'pending' } : bk)),
    )

    return { success: true, message: 'Event successfully rebooked! Status returned to Pending for verification.' }
  }

  const addReview = (rating: number, comment: string, imageUrl: string | null) => {
    const newReview: Review = {
      id: `rev-${Math.floor(1000 + Math.random() * 9000)}`,
      userName: currentUser?.name || 'Anonymous',
      rating,
      comment,
      imageUrl,
      date: new Date().toISOString().split('T')[0],
      reply: null,
    }
    setReviews((prev) => [newReview, ...prev])
  }

  const replyReview = (reviewId: string, reply: string) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, reply } : r)))
  }

  const deleteReview = (reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId))
  }

  const allocateStaff = (bookingId: string, staffIds: string[]) => {
    setBookings((prev) => prev.map((bk) => (bk.id === bookingId ? { ...bk, staffIds } : bk)))
  }

  const blockDate = (date: string) => {
    if (!blockedDates.includes(date)) {
      setBlockedDates((prev) => [...prev, date])
    }
  }

  const unblockDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((d) => d !== date))
  }

  const respondInquiry = (inquiryId: string, replyText: string) => {
    setInquiries((prev) =>
      prev.map((inq) => (inq.id === inquiryId ? { ...inq, replied: true, replyText } : inq)),
    )
  }

  const createInquiryDirect = (name: string, email: string, message: string) => {
    const newInq: Inquiry = {
      id: `inq-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: name,
      email,
      message,
      replied: false,
      replyText: null,
      date: new Date().toISOString(),
    }
    setInquiries((prev) => [newInq, ...prev])
  }

  const updatePaymentStatus = (bookingId: string, paymentStatus: Booking['paymentStatus'], amount?: number) => {
    setBookings((prev) =>
      prev.map((bk) => {
        if (bk.id !== bookingId) return bk
        const updated: Booking = { ...bk, paymentStatus }
        if (paymentStatus === 'downpayment_paid') {
          updated.downpaymentAmount = amount ?? bk.downpaymentAmount ?? bk.totalPrice * 0.5
        }
        return updated
      }),
    )
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
            // Auto-align payment status based on booking status
            if (bookingStatus === 'confirmed' && bk.paymentStatus === 'pending_verification') {
              updated.paymentStatus = 'partially_paid' // Downpayment confirmed
            }
          }
          return updated
        }
        return bk
      }),
    )
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
        login,
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
        notifyUsers,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
