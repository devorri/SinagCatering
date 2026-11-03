import type { Booking } from '../types'

/** 48-hour window for the "Reserve Only" temporary date hold. */
export const RESERVE_HOLD_HOURS = 48
export const RESERVE_HOLD_MS = RESERVE_HOLD_HOURS * 60 * 60 * 1000

/** Reservation fee for a "Reserve Only" hold (credited to the package total). */
export const RESERVATION_FEE = 2000

/** Days before the event when the automated reminder fires. */
export const EVENT_REMINDER_DAYS = 7

/** Admin mobile number for SMS alerts (override with VITE_ADMIN_PHONE). */
export const ADMIN_ALERT_PHONE =
  (import.meta.env.VITE_ADMIN_PHONE as string | undefined)?.trim() || '09287144597'

export type PaymentTerm = 'full' | 'downpayment' | 'reserve'

export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  full: '100% Full Payment Upfront',
  downpayment: '50% Downpayment',
  reserve: 'Reserve Only (₱2,000 Reservation Fee)',
}

export const CANCELLATION_REASONS = [
  'Change of Event Date / Schedule Conflict',
  'Budget Constraints / Financial Reasons',
  'Found Alternative Service / Catering',
  'Emergency',
  'Others (Please specify)',
] as const

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]
export const OTHER_CANCELLATION_REASON: CancellationReason = 'Others (Please specify)'

/** Today's date in the business timezone (Asia/Manila) as YYYY-MM-DD. */
export const manilaToday = (now: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Whole calendar days from today (Manila) until a YYYY-MM-DD date. */
export const daysUntilEvent = (eventDate: string, now: Date = new Date()): number => {
  const today = manilaToday(now)
  const a = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)))
  const [y, m, d] = eventDate.split('-').map(Number)
  if (!y || !m || !d) return 0
  const b = Date.UTC(y, m - 1, d)
  return Math.round((b - a) / 86400000)
}

export const addDaysToDateStr = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export const getPaymentTerm = (b: Pick<Booking, 'paymentTerm'>): PaymentTerm => b.paymentTerm ?? 'downpayment'

/** A reserve-only booking that has not yet received any payment proof. */
export const isReserveHold = (b: Booking): boolean =>
  getPaymentTerm(b) === 'reserve' && b.bookingStatus === 'pending' && b.paymentStatus === 'unpaid'

export const getHoldExpiry = (b: Booking): number | null => {
  if (getPaymentTerm(b) !== 'reserve') return null
  if (b.holdExpiresAt) {
    const t = new Date(b.holdExpiresAt).getTime()
    if (!Number.isNaN(t)) return t
  }
  const created = new Date(b.createdAt).getTime()
  return Number.isNaN(created) ? null : created + RESERVE_HOLD_MS
}

export const isHoldExpired = (b: Booking, now: number = Date.now()): boolean => {
  if (!isReserveHold(b)) return false
  const exp = getHoldExpiry(b)
  return exp !== null && exp <= now
}

export const getHoldRemainingMs = (b: Booking, now: number = Date.now()): number => {
  const exp = getHoldExpiry(b)
  return exp === null ? 0 : Math.max(0, exp - now)
}

export const formatCountdown = (ms: number): string => {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** True when this booking currently occupies its event date on the calendar. */
export const isBookingOccupyingDate = (b: Booking, now: number = Date.now()): boolean => {
  if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit') return false
  if (isHoldExpired(b, now)) return false
  return true
}

/** Calendar state of a date contributed by a booking. */
export const getBookingCalendarState = (b: Booking, now: number = Date.now()): 'reserved' | 'hold' | 'pending' | null => {
  if (!isBookingOccupyingDate(b, now)) return null
  if (isReserveHold(b)) return 'hold'
  const term = getPaymentTerm(b)
  if (b.bookingStatus === 'confirmed' || b.bookingStatus === 'approved' || b.bookingStatus === 'completed') return 'reserved'
  if (term === 'full' || term === 'downpayment') return 'reserved'
  return 'pending'
}

/** Amount the client has actually paid / submitted for this booking. */
export const getAmountPaid = (b: Booking): number => {
  if (b.paymentStatus === 'fully_paid') return b.totalPrice
  if (b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'partially_paid' || b.paymentStatus === 'pending_verification') {
    return Math.min(b.totalPrice, b.downpaymentAmount || Math.round(b.totalPrice * 0.5))
  }
  return 0
}

export const getRemainingBalance = (b: Booking): number => {
  if (b.paymentStatus === 'fully_paid') return 0
  if (b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'partially_paid') {
    return Math.max(0, b.totalPrice - (b.downpaymentAmount || Math.round(b.totalPrice * 0.5)))
  }
  return b.totalPrice
}

export interface RefundQuote {
  daysBefore: number
  refundPercentage: number
  tierLabel: string
  amountPaid: number
  refundAmount: number
  refundable: boolean
}

/**
 * Cancellation policy:
 *  - 30 days or more before the event → 100% refund
 *  - 14 to 29 days before the event   → 50% refund
 *  - less than 14 days                → no refund
 * Refund is computed on what the client has actually paid.
 */
export const computeRefundQuote = (b: Booking, now: Date = new Date()): RefundQuote => {
  const daysBefore = daysUntilEvent(b.eventDate, now)
  const refundPercentage = daysBefore >= 30 ? 100 : daysBefore >= 14 ? 50 : 0
  const tierLabel =
    refundPercentage === 100
      ? '100% Refund (30+ days before event)'
      : refundPercentage === 50
      ? '50% Refund (14–29 days before event)'
      : 'No Refund (less than 14 days before event)'
  const amountPaid = getAmountPaid(b)
  const refundAmount = Math.round(amountPaid * (refundPercentage / 100))
  return { daysBefore, refundPercentage, tierLabel, amountPaid, refundAmount, refundable: refundAmount > 0 }
}

/** Human status label shown in both portals. */
export const getBookingStatusLabel = (b: Booking, now: number = Date.now()): string => {
  if (b.bookingStatus === 'cancelled') {
    if (b.refundStatus === 'pending') return 'Cancelled – Refund Pending'
    if (b.refundStatus === 'processed') return 'Cancelled – Refunded'
    return 'Cancelled'
  }
  if (b.bookingStatus === 'forfeit') return isReserveHoldForfeit(b) ? 'Forfeit – Hold Expired' : 'Forfeited'
  if (isReserveHold(b)) return isHoldExpired(b, now) ? 'Hold Expired' : 'Temporary Hold'
  return b.bookingStatus.charAt(0).toUpperCase() + b.bookingStatus.slice(1)
}

const isReserveHoldForfeit = (b: Booking) => getPaymentTerm(b) === 'reserve' && b.paymentStatus === 'unpaid'

export const getPaymentStatusLabel = (b: Booking): string => {
  switch (b.paymentStatus) {
    case 'fully_paid':
      return 'Fully Paid'
    case 'downpayment_paid':
      return '50% Paid'
    case 'partially_paid':
      return getPaymentTerm(b) === 'reserve' ? 'Reservation Fee Paid' : 'Partially Paid'
    case 'pending_verification':
      return 'Pending Verification'
    default:
      return getPaymentTerm(b) === 'reserve' ? 'Unpaid – Hold' : 'Unpaid'
  }
}

/** YYYY-MM key and label used by the admin monthly breakdown. */
export const monthKey = (dateStr: string) => dateStr.slice(0, 7)
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
