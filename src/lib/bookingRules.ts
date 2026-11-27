import type { Booking } from '../types'

// ---------------------------------------------------------------------------
// Live business rules. Defaults below are replaced by the admin's Business
// Settings as soon as they load (see lib/businessSettings.ts). ES module
// exports are live bindings, so every importer sees the updated values.
// ---------------------------------------------------------------------------

/** Window for the "Reserve Only" temporary date hold. */
export let RESERVE_HOLD_HOURS = 48
export let RESERVE_HOLD_MS = RESERVE_HOLD_HOURS * 60 * 60 * 1000

/** Reservation fee for a "Reserve Only" hold (credited to the package total). */
export let RESERVATION_FEE = 2000

/** Days before the event when the automated reminder fires. */
export let EVENT_REMINDER_DAYS = 7

/** Admin mobile number for SMS alerts. */
export let ADMIN_ALERT_PHONE =
  (import.meta.env.VITE_ADMIN_PHONE as string | undefined)?.trim() || '09287144597'

/** Minimum days between booking and event. */
export let LEAD_TIME_DAYS = 14

/** Refund tiers: >= full days → 100%, >= partial days → partial %, otherwise 0%. */
export let REFUND_FULL_DAYS = 30
export let REFUND_PARTIAL_DAYS = 14
export let REFUND_PARTIAL_PERCENT = 50

/** Downpayment share of the total, in percent. */
export let DOWNPAYMENT_PERCENT = 50

export type PaymentTerm = 'full' | 'downpayment' | 'reserve'

const pesoLabel = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`

/** Labels are rebuilt whenever the settings change (same object, updated in place). */
export const PAYMENT_TERM_LABELS: Record<PaymentTerm, string> = {
  full: '100% Full Payment Upfront',
  downpayment: '50% Downpayment',
  reserve: 'Reserve Only (₱2,000 Reservation Fee)',
}

export const setBookingRules = (rules: {
  reserveHoldHours: number
  reservationFee: number
  reminderDays: number
  adminAlertPhone: string
  leadTimeDays: number
  refundFullDays: number
  refundPartialDays: number
  refundPartialPercent: number
  downpaymentPercent: number
}) => {
  RESERVE_HOLD_HOURS = rules.reserveHoldHours
  RESERVE_HOLD_MS = rules.reserveHoldHours * 60 * 60 * 1000
  RESERVATION_FEE = rules.reservationFee
  EVENT_REMINDER_DAYS = rules.reminderDays
  ADMIN_ALERT_PHONE = rules.adminAlertPhone.replace(/[^0-9+]/g, '') || ADMIN_ALERT_PHONE
  LEAD_TIME_DAYS = rules.leadTimeDays
  REFUND_FULL_DAYS = rules.refundFullDays
  REFUND_PARTIAL_DAYS = rules.refundPartialDays
  REFUND_PARTIAL_PERCENT = rules.refundPartialPercent
  DOWNPAYMENT_PERCENT = rules.downpaymentPercent
  PAYMENT_TERM_LABELS.downpayment = `${DOWNPAYMENT_PERCENT}% Downpayment`
  PAYMENT_TERM_LABELS.reserve = `Reserve Only (${pesoLabel(RESERVATION_FEE)} Reservation Fee)`
}

/** Downpayment for a total using the current percent. */
export const computeDownpayment = (total: number): number => Math.round(total * (DOWNPAYMENT_PERCENT / 100))

export const CANCELLATION_REASONS = [
  'Change of Event Date / Schedule Conflict',
  'Budget Constraints / Financial Reasons',
  'Found Alternative Service / Catering',
  'Emergency',
  'Others (Please specify)',
] as const

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]
export const OTHER_CANCELLATION_REASON: CancellationReason = 'Others (Please specify)'

// ---------------------------------------------------------------------------
// Demo Time Machine (Simulated Clock for Panel Presentations)
// ---------------------------------------------------------------------------
export const SIM_CLOCK_STORAGE_KEY = 'sinag_demo_simulated_now_ms'
export const SIM_CLOCK_EVENT = 'sinag-simulated-clock-change'

export const getSimulatedOffsetMs = (): number | null => {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(SIM_CLOCK_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export const getSimulatedNowMs = (): number => {
  return getSimulatedOffsetMs() ?? Date.now()
}

export const getSimulatedNowDate = (): Date => new Date(getSimulatedNowMs())

export const setSimulatedNowMs = (ms: number | null) => {
  try {
    if (typeof window === 'undefined') return
    if (ms === null || Number.isNaN(ms)) {
      localStorage.removeItem(SIM_CLOCK_STORAGE_KEY)
    } else {
      localStorage.setItem(SIM_CLOCK_STORAGE_KEY, String(ms))
    }
    window.dispatchEvent(new CustomEvent(SIM_CLOCK_EVENT, { detail: { ms } }))
  } catch {
    // ignore
  }
}

/** Today's date in the business timezone (Asia/Manila) as YYYY-MM-DD. */
export const manilaToday = (now: Date = getSimulatedNowDate()): string => {
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
export const daysUntilEvent = (eventDate: string, now: Date = getSimulatedNowDate()): number => {
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

export const isHoldExpired = (b: Booking, now: number = getSimulatedNowMs()): boolean => {
  if (!isReserveHold(b)) return false
  const exp = getHoldExpiry(b)
  return exp !== null && exp <= now
}

export const getHoldRemainingMs = (b: Booking, now: number = getSimulatedNowMs()): number => {
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
export const isBookingOccupyingDate = (b: Booking, now: number = getSimulatedNowMs()): boolean => {
  if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit') return false
  if (isHoldExpired(b, now)) return false
  return true
}

// ---------------------------------------------------------------------------
// Rebook date picker availability
// ---------------------------------------------------------------------------
export type RebookDateStatus = 'available' | 'current' | 'too_soon' | 'reserved' | 'hold' | 'blocked'

export interface RebookDateInfo {
  status: RebookDateStatus
  label: string
  selectable: boolean
}

/** Availability of one date for rebooking `booking`. Shared by the picker and the portal's re-validation. */
export const getRebookDateInfo = (
  dateStr: string,
  booking: Booking,
  bookings: Booking[],
  blockedDates: string[],
  minDate: string,
): RebookDateInfo => {
  if (dateStr === booking.eventDate) return { status: 'current', label: 'Your current event date', selectable: false }
  if (dateStr < minDate) return { status: 'too_soon', label: `Too soon – earliest rebook date is ${minDate}`, selectable: false }
  const others = bookings.filter((b) => b.id !== booking.id && b.eventDate === dateStr && isBookingOccupyingDate(b))
  if (others.some((b) => !isReserveHold(b))) return { status: 'reserved', label: 'Already reserved', selectable: false }
  if (others.length > 0) return { status: 'hold', label: 'Temporarily held by another client', selectable: false }
  if (blockedDates.includes(dateStr)) return { status: 'blocked', label: 'Blocked by Sinag Catering', selectable: false }
  return { status: 'available', label: 'Available', selectable: true }
}

/** Calendar state of a date contributed by a booking. */
export const getBookingCalendarState = (b: Booking, now: number = getSimulatedNowMs()): 'reserved' | 'hold' | 'pending' | null => {
  if (!isBookingOccupyingDate(b, now)) return null
  if (isReserveHold(b)) return 'hold'
  const term = getPaymentTerm(b)
  if (b.bookingStatus === 'confirmed' || b.bookingStatus === 'approved' || b.bookingStatus === 'completed') return 'reserved'
  if (term === 'full' || term === 'downpayment') return 'reserved'
  return 'pending'
}

/** Fallback paid amount when no explicit amount is stored on the booking. */
const defaultPartialAmount = (b: Booking): number =>
  getPaymentTerm(b) === 'reserve' ? Math.min(b.totalPrice, RESERVATION_FEE) : computeDownpayment(b.totalPrice)

/** Amount the client has actually paid / submitted for this booking (includes receipts still awaiting verification). */
export const getAmountPaid = (b: Booking): number => {
  if (b.paymentStatus === 'fully_paid') return b.totalPrice
  if (b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'partially_paid' || b.paymentStatus === 'pending_verification') {
    return Math.min(b.totalPrice, b.downpaymentAmount || defaultPartialAmount(b))
  }
  return 0
}

/** Amount the admin has actually verified as received (excludes receipts still pending verification). */
export const getVerifiedAmountPaid = (b: Booking): number => {
  if (b.paymentStatus === 'fully_paid') return b.totalPrice
  if (b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'partially_paid') {
    return Math.min(b.totalPrice, b.downpaymentAmount || defaultPartialAmount(b))
  }
  return 0
}

/** True while a cancelled booking's refund is requested but not yet paid out by the admin. */
export const isRefundPending = (b: Booking): boolean => b.bookingStatus === 'cancelled' && b.refundStatus === 'pending'

/** Refund actually paid out (only once the admin marks it as refunded). Never more than what was paid. */
export const getProcessedRefund = (b: Booking): number => {
  if (b.refundStatus !== 'processed') return 0
  return Math.max(0, Math.min(Number(b.refundAmount) || 0, getAmountPaid(b)))
}

/**
 * Collected money recognised as Gross Revenue for one booking.
 *  - Active (confirmed / completed): the verified payment (full price or verified downpayment).
 *  - Cancelled / forfeited: the verified payment stays counted while the refund is
 *    only REFUND PENDING (or when no refund applies). The refund is deducted only
 *    after the admin marks it as refunded (PROCESSED).
 */
export const getRecognizedRevenue = (b: Booking): number => {
  const total = Number(b.totalPrice) || 0
  const collected =
    b.paymentStatus === 'fully_paid'
      ? total
      : b.paymentStatus === 'downpayment_paid'
      ? Math.min(total, Number(b.downpaymentAmount) || computeDownpayment(total))
      : 0
  if (b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed') return collected
  if (b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit') {
    return Math.max(0, collected - getProcessedRefund(b))
  }
  return 0
}

export const getRemainingBalance = (b: Booking): number => {
  if (b.paymentStatus === 'fully_paid') return 0
  if (b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'partially_paid') {
    return Math.max(0, b.totalPrice - (b.downpaymentAmount || computeDownpayment(b.totalPrice)))
  }
  return b.totalPrice
}

export interface RefundQuote {
  daysBefore: number
  refundPercentage: number
  tierLabel: string
  amountPaid: number
  /** Part of amountPaid that is a receipt the admin has not verified yet. */
  unverifiedAmount: number
  refundAmount: number
  refundable: boolean
}

/**
 * Cancellation policy (values come from Business Settings):
 *  - REFUND_FULL_DAYS or more before the event      → 100% refund
 *  - REFUND_PARTIAL_DAYS to REFUND_FULL_DAYS - 1    → REFUND_PARTIAL_PERCENT refund
 *  - less than REFUND_PARTIAL_DAYS                  → no refund
 * Refund is computed on what the client has actually paid. Receipts still awaiting
 * verification are flagged (unverifiedAmount) so the admin verifies them before payout.
 */
export const computeRefundQuote = (b: Booking, now: Date = getSimulatedNowDate()): RefundQuote => {
  const daysBefore = daysUntilEvent(b.eventDate, now)
  const refundPercentage = daysBefore >= REFUND_FULL_DAYS ? 100 : daysBefore >= REFUND_PARTIAL_DAYS ? REFUND_PARTIAL_PERCENT : 0
  const tierLabel =
    daysBefore >= REFUND_FULL_DAYS
      ? `100% Refund (${REFUND_FULL_DAYS}+ days before event)`
      : daysBefore >= REFUND_PARTIAL_DAYS && REFUND_PARTIAL_PERCENT > 0
      ? `${REFUND_PARTIAL_PERCENT}% Refund (${REFUND_PARTIAL_DAYS}–${REFUND_FULL_DAYS - 1} days before event)`
      : `No Refund (less than ${REFUND_PARTIAL_DAYS} days before event)`
  const amountPaid = getAmountPaid(b)
  const unverifiedAmount = Math.max(0, amountPaid - getVerifiedAmountPaid(b))
  // Refund can never exceed what the client actually paid
  const refundAmount = Math.min(amountPaid, Math.max(0, Math.round(amountPaid * (refundPercentage / 100))))
  return { daysBefore, refundPercentage, tierLabel, amountPaid, unverifiedAmount, refundAmount, refundable: refundAmount > 0 }
}

/** Human status label shown in both portals. */
export const getBookingStatusLabel = (b: Booking, now: number = getSimulatedNowMs()): string => {
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
      return `${DOWNPAYMENT_PERCENT}% Paid`
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
