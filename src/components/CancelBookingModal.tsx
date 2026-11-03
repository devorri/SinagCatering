import React, { useMemo, useState } from 'react'
import { AlertCircle, Info, Loader2, X } from 'lucide-react'
import type { Booking } from '../types'
import { formatMoney } from '../data/packages'
import {
  CANCELLATION_REASONS,
  OTHER_CANCELLATION_REASON,
  computeRefundQuote,
} from '../lib/bookingRules'

interface CancelBookingModalProps {
  booking: Booking
  onClose: () => void
  onConfirm: (reason: string, notes: string) => void
}

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({ booking, onClose, onConfirm }) => {
  const quote = useMemo(() => computeRefundQuote(booking), [booking])
  const [reason, setReason] = useState('')
  const [otherText, setOtherText] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOther = reason === OTHER_CANCELLATION_REASON
  const reasonError = attempted && !reason ? 'Please select a cancellation reason.' : ''
  const otherError = attempted && isOther && otherText.trim().length < 3 ? 'Please tell us the reason (at least 3 characters).' : ''

  const handleSubmit = () => {
    setAttempted(true)
    if (!reason || (isOther && otherText.trim().length < 3)) return
    setIsSubmitting(true)
    onConfirm(reason, isOther ? otherText.trim() : '')
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div className="modal-card cancel-modal-card" data-lenis-prevent>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <h3 id="cancel-modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: '0 0 6px' }}>
            Confirm Cancellation
          </h3>
          <button type="button" onClick={onClose} className="cancel-modal-x" aria-label="Close" disabled={isSubmitting}>
            <X size={18} />
          </button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0 0 18px', wordBreak: 'break-all' }}>
          Booking Reference: <strong style={{ color: 'var(--ink)' }}>{booking.id}</strong>
        </p>

        {/* A. Refund summary & policy */}
        <div className="cancel-summary">
          <div className="cancel-row">
            <span>Total Package Price:</span>
            <strong>{formatMoney(booking.totalPrice, booking.currency)}</strong>
          </div>
          <div className="cancel-row">
            <span>Amount Paid / Submitted:</span>
            <strong>{formatMoney(quote.amountPaid, booking.currency)}</strong>
          </div>
          <div className="cancel-row">
            <span>Days Before Event:</span>
            <strong>{Math.max(0, quote.daysBefore)} day{quote.daysBefore === 1 ? '' : 's'}</strong>
          </div>
          <div className="cancel-row">
            <span>Refund Tier:</span>
            <strong style={{ color: quote.refundPercentage > 0 ? 'var(--emerald, #059669)' : 'var(--terracotta)' }}>
              {quote.tierLabel}
            </strong>
          </div>
          <div className="cancel-row total">
            <span>Refundable Amount:</span>
            <strong className="font-number" style={{ color: 'var(--terracotta)' }}>
              {formatMoney(quote.refundAmount, booking.currency)}
            </strong>
          </div>
          <ul className="cancel-policy">
            <li>30+ days before the event — 100% refund</li>
            <li>14–29 days before the event — 50% refund</li>
            <li>Less than 14 days — no refund</li>
          </ul>
        </div>

        {/* Reason */}
        <div className="form-group" style={{ margin: '18px 0 0' }}>
          <label htmlFor="cancel-reason" style={{ fontWeight: 700 }}>
            Cancellation Reason <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <select
            id="cancel-reason"
            className={`input-field ${reasonError ? 'input-error' : ''}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="" disabled>
              Select a reason…
            </option>
            {CANCELLATION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {reasonError && <span className="cancel-field-error"><AlertCircle size={13} /> {reasonError}</span>}
        </div>

        {isOther && (
          <div className="form-group" style={{ margin: '12px 0 0' }}>
            <label htmlFor="cancel-other" style={{ fontWeight: 700 }}>
              Please specify <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              id="cancel-other"
              className={`input-field ${otherError ? 'input-error' : ''}`}
              rows={3}
              maxLength={500}
              placeholder="Tell us why you're cancelling…"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              disabled={isSubmitting}
            />
            {otherError && <span className="cancel-field-error"><AlertCircle size={13} /> {otherError}</span>}
          </div>
        )}

        <div className="cancel-disclaimer">
          <Info size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Since payments are settled via manual transfer, submitting this request will notify Sinag Catering administration
            to review your refund tier and coordinate the manual payout.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn-nav-logout" disabled={isSubmitting}>
            Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-submit-primary"
            style={{ width: 'auto', background: 'var(--terracotta)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {quote.refundable ? 'CONFIRM CANCELLATION & REQUEST REFUND' : 'CONFIRM CANCELLATION'}
          </button>
        </div>
      </div>
    </div>
  )
}
