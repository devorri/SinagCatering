export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: 'client' | 'admin'
}

export interface AddOnItem {
  extraMainCount: number
  extraPastaCount: number
  extraDessertCount: number
  selectedAddonIds?: string[]
  selectedMainDishes?: string[]
  selectedPastaDishes?: string[]
  extraMainDishes?: string[]
  extraPastaDishes?: string[]
}

export interface Booking {
  id: string
  userId: string
  customerName: string
  email: string
  phone: string
  eventType: string
  customEventType?: string
  eventDate: string
  guestCount: number
  packageName: string
  packageId?: string
  currency?: 'PHP'
  basePrice: number
  extraPaxFee: number
  addOns: AddOnItem
  totalPrice: number
  downpaymentAmount?: number
  bookingStatus: 'pending' | 'approved' | 'confirmed' | 'completed' | 'cancelled' | 'forfeit'
  paymentStatus: 'unpaid' | 'pending_verification' | 'partially_paid' | 'downpayment_paid' | 'fully_paid'
  paymentMethod?: 'qrph' | 'gcash' | 'maya' | 'bank_transfer' | 'paymongo'
  gcashRefNumber?: string
  proofOfPaymentUrl: string | null
  staffIds: string[]
  assignedServices?: string[]
  notes: string
  createdAt: string
}

export interface Review {
  id: string
  userName: string
  rating: number
  comment: string
  imageUrl: string | null
  date: string
  reply: string | null
}

export interface Staff {
  id: string
  name: string
  role: 'waiter' | 'food_attendant'
  status: 'available' | 'busy'
  age?: number
  offDays?: string[]
}

export interface Inquiry {
  id: string
  customerName: string
  email: string
  message: string
  replied: boolean
  replyText: string | null
  date: string
}

export interface NotificationLog {
  id: string
  type: 'sms' | 'email'
  recipient: string
  subject?: string
  message: string
  status: 'sent' | 'failed' | 'simulated'
  timestamp: string
  provider: 'Semaphore' | 'Email'
  referenceId?: string
}

export interface AdminNotification {
  id: string
  type: 'booking_new' | 'booking_confirmed' | 'booking_completed' | 'booking_cancelled' | 'inquiry_new' | 'review_new'
  title: string
  message: string
  bookingId?: string
  timestamp: string
  read: boolean
}

