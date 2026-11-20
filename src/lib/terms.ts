import { fillPolicyText, getBusiness } from './businessSettings'
import type { TermsSection } from './businessSettings'

export type { TermsSection }

/**
 * Terms & Conditions come from the admin's Business Settings. The version
 * changes automatically whenever the admin edits the terms, and every client
 * is asked to scroll through and accept again on their next sign-in.
 */
export const getTermsVersion = (): string => getBusiness().termsVersion

/** Sections with {fee}, {holdHours}, refund days, etc. filled in with live values. */
export const getTermsSections = (): TermsSection[] => {
  const s = getBusiness()
  return s.termsSections.map((section) => ({
    ...section,
    items: section.items?.map((t) => fillPolicyText(t, s)),
    paragraphs: section.paragraphs?.map((t) => fillPolicyText(t, s)),
  }))
}

const ACCEPT_KEY_PREFIX = 'sinag_terms_accepted_'

export const getLocalTermsAcceptance = (userId: string): string | null => {
  try {
    const raw = localStorage.getItem(`${ACCEPT_KEY_PREFIX}${userId}`)
    return raw && raw === getTermsVersion() ? raw : null
  } catch {
    return null
  }
}

export const setLocalTermsAcceptance = (userId: string) => {
  try {
    localStorage.setItem(`${ACCEPT_KEY_PREFIX}${userId}`, getTermsVersion())
  } catch {
    // storage unavailable — DB copy is the source of truth
  }
}
