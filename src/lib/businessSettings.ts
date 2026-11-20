/**
 * Business Settings — every business rule and contact detail the admin can
 * change without touching code. Stored as one row in public.business_settings
 * and kept in sync through Supabase realtime.
 *
 * Non-React code reads the current values with getBusiness(); React components
 * should use useApp().business so they re-render when an admin saves changes.
 */
import { setPricingRules } from '../data/packages'
import { setBookingRules } from './bookingRules'

export interface TermsSection {
  heading: string
  items?: string[]
  paragraphs?: string[]
  ordered?: boolean
}

export interface BusinessSettings {
  // Contact
  businessName: string
  phone: string
  email: string
  address: string
  serviceArea: string
  hours: string

  // Payment accounts
  gcashName: string
  gcashNumber: string
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
  bankAccountTag: string
  gcashQrUrl: string
  bankQrUrl: string

  // Admin alerts
  adminAlertPhone: string

  // Pricing rules
  foodBufferPax: number
  excessPaxRate: number
  downpaymentPercent: number
  reservationFee: number
  reserveHoldHours: number
  maxExtraMain: number
  maxExtraPasta: number
  maxExtraDessert: number

  // Included menu: how many dishes the client picks in every package
  includedMains: number
  includedPastas: number
  includedDrinks: number

  // Policies
  leadTimeDays: number
  changeNoticeDays: number
  refundFullDays: number
  refundPartialDays: number
  refundPartialPercent: number
  reminderDays: number

  // Terms & Conditions ({fee}, {holdHours}, {leadDays}, {changeDays}, {fullDays}, {partialDays}, {partialPercent} are filled in automatically)
  termsSections: TermsSection[]
  termsVersion: string
}

export const DEFAULT_TERMS_SECTIONS: TermsSection[] = [
  {
    heading: 'Terms and Conditions',
    ordered: true,
    items: [
      'The client shall provide the crew meal.',
      'Changes in venue, date, theme, or guest count must be communicated at least {changeDays} days before the event and are subject to availability.',
      'Any damages to equipment, décor, linens, tables, chairs, or other rented items caused by the client or guests shall be charged accordingly.',
      'The caterer/stylist is not liable for delays caused by natural disasters, government restrictions, accidents, power outages, or other events beyond reasonable control.',
      'Food service will be based on the agreed service duration unless an extension is requested and approved.',
      'Any remaining balance not paid on time may result in suspension of services until payment is completed.',
      'Reservation fee: {fee}, deducted from the total package price.',
    ],
  },
  {
    heading: 'Entire Agreement',
    paragraphs: [
      'The parties acknowledge and agree that this agreement represents the entire agreement between the parties. In the event that the parties desire to change, add, or otherwise modify any terms, they shall do so in writing to be signed by both parties.',
      'IN WITNESS WHEREOF, each of the parties hereto has caused the agreement to be executed by its duly authorized representative on the date set forth above.',
    ],
  },
  {
    heading: 'Cancellation Policy',
    paragraphs: ['By Clients. The client may cancel this agreement at any time.'],
    items: [
      'If the client cancels {fullDays} or more days prior to the event date, the client will be entitled to a full refund.',
      'If the client cancels {partialDays} to {fullDaysMinus1} days prior to the event date, the client will be entitled to a {partialPercent}% refund.',
      'If the client cancels less than {partialDays} days prior to the event date, the client will not be entitled to a refund.',
    ],
  },
  {
    heading: 'Temporary Date Holds (Reserve Only)',
    paragraphs: [
      'A "Reserve Only" booking temporarily holds your selected date for {holdHours} hours. The {fee} reservation fee must be paid within those {holdHours} hours to lock the date; the fee is deducted from the total package price. If no payment is uploaded within {holdHours} hours, the hold automatically expires, the booking is marked as forfeited, and the date is released back to the public calendar.',
    ],
  },
  {
    heading: 'Data Privacy (Republic Act No. 10173)',
    paragraphs: [
      'Your personal information is collected solely for event reservation, booking verification, date protection, and concierge support by Sinag Catering. Your data is protected with strict confidentiality and will never be shared with unauthorized third parties.',
    ],
  },
]

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  businessName: "Sinag's Catering Services",
  phone: '0928 714 4597',
  email: 'cruzsunshine19@yahoo.com',
  address: 'Baliwag, Bulacan',
  serviceArea: 'Bulacan and nearby provinces',
  hours: 'Mon-Sat, 9:00 AM - 7:00 PM',

  gcashName: 'Sunshine C.',
  gcashNumber: '0928 714 4597',
  bankName: 'MariBank',
  bankAccountName: 'Sunshine C.',
  bankAccountNumber: '0928 714 4597',
  bankAccountTag: 'MariBank(****2765)',
  gcashQrUrl: '/sinag_gcash_qr.png',
  bankQrUrl: '/sinag_maribank_qr.png',

  adminAlertPhone: (import.meta.env.VITE_ADMIN_PHONE as string | undefined)?.trim() || '09287144597',

  foodBufferPax: 10,
  excessPaxRate: 700,
  downpaymentPercent: 50,
  reservationFee: 2000,
  reserveHoldHours: 48,
  maxExtraMain: 3,
  maxExtraPasta: 2,
  maxExtraDessert: 2,

  includedMains: 3,
  includedPastas: 1,
  includedDrinks: 1,

  leadTimeDays: 14,
  changeNoticeDays: 14,
  refundFullDays: 30,
  refundPartialDays: 14,
  refundPartialPercent: 50,
  reminderDays: 7,

  termsSections: DEFAULT_TERMS_SECTIONS,
  termsVersion: '2026-11-04',
}

const num = (value: unknown, fallback: number, min = 0, max = 10_000_000): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

/** Fills any missing or invalid field with its default. */
export const normalizeBusinessSettings = (raw: any): BusinessSettings => {
  const d = DEFAULT_BUSINESS_SETTINGS
  const r = raw && typeof raw === 'object' ? raw : {}
  const sections = Array.isArray(r.termsSections) && r.termsSections.length > 0
    ? r.termsSections
        .filter((s: any) => s && typeof s.heading === 'string')
        .map((s: any) => ({
          heading: String(s.heading),
          ordered: Boolean(s.ordered),
          items: Array.isArray(s.items) ? s.items.map(String).filter((x: string) => x.trim()) : undefined,
          paragraphs: Array.isArray(s.paragraphs) ? s.paragraphs.map(String).filter((x: string) => x.trim()) : undefined,
        }))
    : d.termsSections
  const refundPartialDays = num(r.refundPartialDays, d.refundPartialDays, 0, 365)
  return {
    businessName: str(r.businessName, d.businessName),
    phone: str(r.phone, d.phone),
    email: str(r.email, d.email),
    address: str(r.address, d.address),
    serviceArea: str(r.serviceArea, d.serviceArea),
    hours: str(r.hours, d.hours),
    gcashName: str(r.gcashName, d.gcashName),
    gcashNumber: str(r.gcashNumber, d.gcashNumber),
    bankName: str(r.bankName, d.bankName),
    bankAccountName: str(r.bankAccountName, d.bankAccountName),
    bankAccountNumber: str(r.bankAccountNumber, d.bankAccountNumber),
    bankAccountTag: str(r.bankAccountTag, d.bankAccountTag),
    gcashQrUrl: str(r.gcashQrUrl, d.gcashQrUrl),
    bankQrUrl: str(r.bankQrUrl, d.bankQrUrl),
    adminAlertPhone: str(r.adminAlertPhone, d.adminAlertPhone),
    foodBufferPax: Math.round(num(r.foodBufferPax, d.foodBufferPax, 0, 500)),
    excessPaxRate: num(r.excessPaxRate, d.excessPaxRate),
    downpaymentPercent: num(r.downpaymentPercent, d.downpaymentPercent, 1, 100),
    reservationFee: num(r.reservationFee, d.reservationFee),
    reserveHoldHours: num(r.reserveHoldHours, d.reserveHoldHours, 1, 720),
    maxExtraMain: Math.round(num(r.maxExtraMain, d.maxExtraMain, 0, 20)),
    maxExtraPasta: Math.round(num(r.maxExtraPasta, d.maxExtraPasta, 0, 20)),
    maxExtraDessert: Math.round(num(r.maxExtraDessert, d.maxExtraDessert, 0, 20)),
    includedMains: Math.round(num(r.includedMains, d.includedMains, 1, 20)),
    includedPastas: Math.round(num(r.includedPastas, d.includedPastas, 1, 20)),
    includedDrinks: Math.round(num(r.includedDrinks, d.includedDrinks, 1, 10)),
    leadTimeDays: Math.round(num(r.leadTimeDays, d.leadTimeDays, 0, 365)),
    changeNoticeDays: Math.round(num(r.changeNoticeDays, d.changeNoticeDays, 0, 365)),
    refundFullDays: Math.max(refundPartialDays + 1, Math.round(num(r.refundFullDays, d.refundFullDays, 0, 365))),
    refundPartialDays,
    refundPartialPercent: num(r.refundPartialPercent, d.refundPartialPercent, 0, 100),
    reminderDays: Math.round(num(r.reminderDays, d.reminderDays, 0, 90)),
    termsSections: sections,
    termsVersion: str(r.termsVersion, d.termsVersion),
  }
}

let current: BusinessSettings = DEFAULT_BUSINESS_SETTINGS

/** Current settings for code outside React (pricing math, notifications, AI). */
export const getBusiness = (): BusinessSettings => current

/** Called by AppContext whenever settings load or change. */
export const applyBusinessSettings = (settings: BusinessSettings) => {
  current = settings
  setPricingRules({
    foodBufferPax: settings.foodBufferPax,
    excessPaxRate: settings.excessPaxRate,
    maxExtraMain: settings.maxExtraMain,
    maxExtraPasta: settings.maxExtraPasta,
    maxExtraDessert: settings.maxExtraDessert,
  })
  setBookingRules({
    reserveHoldHours: settings.reserveHoldHours,
    reservationFee: settings.reservationFee,
    reminderDays: settings.reminderDays,
    adminAlertPhone: settings.adminAlertPhone,
    leadTimeDays: settings.leadTimeDays,
    refundFullDays: settings.refundFullDays,
    refundPartialDays: settings.refundPartialDays,
    refundPartialPercent: settings.refundPartialPercent,
    downpaymentPercent: settings.downpaymentPercent,
  })
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
export const pesoText = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`

/** "0928 714 4597" → "09287144597" for tel: links and clipboard. */
export const phoneDigits = (phone: string) => phone.replace(/[^0-9+]/g, '')

/** Downpayment amount for a total, using the configured percent. */
export const downpaymentFor = (total: number, s: BusinessSettings = current) =>
  Math.round(total * (s.downpaymentPercent / 100))

/** Replaces {placeholders} in terms text with the live values. */
export const fillPolicyText = (text: string, s: BusinessSettings = current): string =>
  text
    .replace(/\{fee\}/g, pesoText(s.reservationFee))
    .replace(/\{holdHours\}/g, String(s.reserveHoldHours))
    .replace(/\{leadDays\}/g, String(s.leadTimeDays))
    .replace(/\{changeDays\}/g, String(s.changeNoticeDays))
    .replace(/\{fullDaysMinus1\}/g, String(Math.max(s.refundPartialDays, s.refundFullDays - 1)))
    .replace(/\{fullDays\}/g, String(s.refundFullDays))
    .replace(/\{partialDays\}/g, String(s.refundPartialDays))
    .replace(/\{partialPercent\}/g, String(s.refundPartialPercent))
    .replace(/\{downpaymentPercent\}/g, String(s.downpaymentPercent))
    .replace(/\{phone\}/g, s.phone)
    .replace(/\{email\}/g, s.email)
    .replace(/\{businessName\}/g, s.businessName)

/** One-line refund policy, e.g. "30+ days: 100% · 14–29 days: 50% · under 14 days: no refund". */
export const refundPolicySummary = (s: BusinessSettings = current) =>
  `${s.refundFullDays}+ days before the event: 100% refund · ${s.refundPartialDays}–${s.refundFullDays - 1} days: ${s.refundPartialPercent}% refund · under ${s.refundPartialDays} days: no refund`
