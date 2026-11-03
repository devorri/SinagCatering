import { RESERVATION_FEE } from './bookingRules'

/**
 * Bump this whenever the Terms & Conditions text changes. Every client is
 * asked to scroll through and accept again on their next sign-in.
 */
export const TERMS_VERSION = '2026-11-04'

export interface TermsSection {
  heading: string
  items?: string[]
  paragraphs?: string[]
  ordered?: boolean
}

const fee = `₱${RESERVATION_FEE.toLocaleString('en-PH')}`

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: 'Terms and Conditions',
    ordered: true,
    items: [
      'The client shall provide the crew meal.',
      'Changes in venue, date, theme, or guest count must be communicated at least fourteen (14) days before the event and are subject to availability.',
      'Any damages to equipment, décor, linens, tables, chairs, or other rented items caused by the client or guests shall be charged accordingly.',
      'The caterer/stylist is not liable for delays caused by natural disasters, government restrictions, accidents, power outages, or other events beyond reasonable control.',
      'Food service will be based on the agreed service duration unless an extension is requested and approved.',
      'Any remaining balance not paid on time may result in suspension of services until payment is completed.',
      `Reservation fee: ${fee}, deducted from the total package price.`,
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
    paragraphs: [
      'By Clients. The client may cancel this agreement at any time.',
    ],
    items: [
      'If the client cancels 30 or more days prior to the event date, the client will be entitled to a full refund.',
      'If the client cancels 14 to 29 days prior to the event date, the client will be entitled to a fifty percent (50%) refund.',
      'If the client cancels less than 14 days prior to the event date, the client will not be entitled to a refund.',
    ],
  },
  {
    heading: 'Temporary Date Holds (Reserve Only)',
    paragraphs: [
      `A "Reserve Only" booking temporarily holds your selected date for forty-eight (48) hours. The ${fee} reservation fee must be paid within those 48 hours to lock the date; the fee is deducted from the total package price. If no payment is uploaded within 48 hours, the hold automatically expires, the booking is marked as forfeited, and the date is released back to the public calendar.`,
    ],
  },
  {
    heading: 'Data Privacy (Republic Act No. 10173)',
    paragraphs: [
      'Your personal information is collected solely for event reservation, booking verification, date protection, and concierge support by Sinag Catering. Your data is protected with strict confidentiality and will never be shared with unauthorized third parties.',
    ],
  },
]

const ACCEPT_KEY_PREFIX = 'sinag_terms_accepted_'

export const getLocalTermsAcceptance = (userId: string): string | null => {
  try {
    const raw = localStorage.getItem(`${ACCEPT_KEY_PREFIX}${userId}`)
    return raw && raw === TERMS_VERSION ? raw : null
  } catch {
    return null
  }
}

export const setLocalTermsAcceptance = (userId: string) => {
  try {
    localStorage.setItem(`${ACCEPT_KEY_PREFIX}${userId}`, TERMS_VERSION)
  } catch {
    // storage unavailable — DB copy is the source of truth
  }
}
