export interface User {
  id: string
  name: string
  email: string
  role: 'client' | 'admin'
}

export interface AddOnItem {
  extraMainCount: number
  extraPastaCount: number
  extraDessertCount: number
}

export interface Booking {
  id: string
  userId: string
  customerName: string
  email: string
  phone: string
  eventType: string
  eventDate: string
  guestCount: number
  packageName: string
  basePrice: number
  extraPaxFee: number
  addOns: AddOnItem
  totalPrice: number
  downpaymentAmount?: number
  bookingStatus: 'pending' | 'approved' | 'confirmed' | 'cancelled' | 'forfeit'
  paymentStatus: 'unpaid' | 'pending_verification' | 'partially_paid' | 'downpayment_paid' | 'fully_paid'
  proofOfPaymentUrl: string | null
  staffIds: string[]
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
