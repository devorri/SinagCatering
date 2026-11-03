import React, { useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  Loader2,
  Maximize2,
  Receipt,
  RotateCcw,
  UploadCloud,
} from 'lucide-react'
import type { Booking } from '../types'
import { formatMoney } from '../data/packages'
import { uploadImageToStorage } from '../lib/storage'
import {
  RESERVATION_FEE,
  formatCountdown,
  getHoldExpiry,
  getHoldRemainingMs,
  getPaymentTerm,
  getRemainingBalance,
  isHoldExpired,
  isReserveHold,
} from '../lib/bookingRules'

export interface QrZoomInfo {
  title: string
  imageSrc: string
  name: string
  acc: string
}

interface PaymentStatusPanelProps {
  booking: Booking
  onUpload: (proofUrl: string, refNumber: string, options: { amount: number; paymentTerm?: 'downpayment' | 'full' | 'reserve' }) => void
  onPayOnline: (amount: number) => void
  onZoomQr: (info: QrZoomInfo) => void
}

const GCASH_QR: QrZoomInfo = {
  title: 'GCash / QR Ph Code',
  imageSrc: '/sinag_gcash_qr.png',
  name: 'SU*****E C.',
  acc: '0928 714 4597',
}
const MARIBANK_QR: QrZoomInfo = {
  title: 'MariBank / InstaPay QR Code',
  imageSrc: '/sinag_maribank_qr.png',
  name: 'SUNSHINE CRUZ (MariBank ****2765)',
  acc: '0928 714 4597',
}

/**
 * Bottom "payment status" container on each My Bookings card. Shows the live
 * payment state and an OPTIONAL receipt upload whenever money is still owed.
 */
export const PaymentStatusPanel: React.FC<PaymentStatusPanelProps> = ({ booking, onUpload, onPayOnline, onZoomQr }) => {
  const [now, setNow] = useState(() => Date.now())
  const [isExpanded, setIsExpanded] = useState(false)
  const [qrMethod, setQrMethod] = useState<'gcash' | 'maribank'>('gcash')
  const [refNumber, setRefNumber] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const term = getPaymentTerm(booking)
  const hold = isReserveHold(booking)
  const holdExpired = isHoldExpired(booking, now)
  const holdRemaining = getHoldRemainingMs(booking, now)

  const downpaymentDue = Math.round(booking.totalPrice * 0.5)
  const reservationFee = Math.min(booking.totalPrice, term === 'reserve' && booking.downpaymentAmount ? booking.downpaymentAmount : RESERVATION_FEE)
  const remaining = getRemainingBalance(booking)
  const [payChoice, setPayChoice] = useState<'reserve' | 'downpayment' | 'full'>(term === 'full' ? 'full' : term === 'reserve' ? 'reserve' : 'downpayment')

  useEffect(() => {
    if (!hold) return
    const t = window.setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => window.clearInterval(t)
  }, [hold])

  const isClosed = booking.bookingStatus === 'cancelled' || booking.bookingStatus === 'forfeit'
  const isBalanceStage = booking.paymentStatus === 'downpayment_paid' || booking.paymentStatus === 'partially_paid'
  const canUpload =
    !isClosed &&
    !holdExpired &&
    booking.paymentStatus !== 'fully_paid' &&
    booking.bookingStatus !== 'completed'

  // Amount the receipt being uploaded represents
  const uploadAmount = isBalanceStage
    ? remaining
    : booking.paymentStatus === 'pending_verification'
    ? (booking.downpaymentAmount || downpaymentDue)
    : payChoice === 'full'
    ? booking.totalPrice
    : payChoice === 'reserve'
    ? reservationFee
    : downpaymentDue

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image receipt (PNG, JPG, or WEBP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Receipt file exceeds 10MB limit. Please upload a smaller image.')
      return
    }
    setError('')
    setFileName(file.name)
    setIsUploading(true)
    try {
      const res = await uploadImageToStorage(file, 'receipts')
      if (res.url) {
        setReceiptUrl(res.url)
      } else {
        throw new Error(res.error || 'Upload failed')
      }
    } catch {
      const reader = new FileReader()
      reader.onloadend = () => setReceiptUrl(reader.result as string)
      reader.readAsDataURL(file)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = () => {
    if (!receiptUrl) {
      setError('Please attach your payment receipt screenshot.')
      return
    }
    onUpload(receiptUrl, refNumber.trim(), {
      amount: uploadAmount,
      paymentTerm: isBalanceStage || booking.paymentStatus === 'pending_verification' ? undefined : payChoice,
    })
    setRefNumber('')
    setReceiptUrl(null)
    setFileName('')
    setError('')
    setIsExpanded(false)
  }

  // ----- Status headline -----
  let tone: 'hold' | 'pending' | 'partial' | 'paid' | 'due' | 'closed' | 'refund' = 'due'
  let icon = <AlertCircle size={20} />
  let title = ''
  let desc = ''

  if (booking.bookingStatus === 'cancelled') {
    tone = 'refund'
    icon = <RotateCcw size={20} />
    if (booking.refundStatus === 'pending') {
      title = `Cancelled – Refund Pending (${formatMoney(booking.refundAmount || 0, booking.currency)})`
      desc = `Your refund request (${booking.refundPercentage ?? 0}% tier) was sent to Sinag Catering for manual review and payout.`
    } else if (booking.refundStatus === 'processed') {
      title = `Cancelled – Refund Processed (${formatMoney(booking.refundAmount || 0, booking.currency)})`
      desc = 'Your refund has been released by Sinag Catering.'
    } else {
      title = 'Booking Cancelled'
      desc = booking.cancellationReason ? `Reason: ${booking.cancellationReason}. No refund applies under the cancellation policy.` : 'This reservation has been cancelled.'
    }
  } else if (booking.bookingStatus === 'forfeit') {
    tone = 'closed'
    icon = <Ban size={20} />
    title = term === 'reserve' && booking.paymentStatus === 'unpaid' ? 'Temporary Hold Expired – Forfeited' : 'Reservation Forfeited'
    desc = 'This date has been released back to the open calendar.'
  } else if (hold && holdExpired) {
    tone = 'closed'
    icon = <Ban size={20} />
    title = 'Temporary Hold Expired'
    desc = 'No payment was uploaded within 48 hours, so the date is being released.'
  } else if (hold) {
    tone = 'hold'
    icon = <AlertTriangle size={20} />
    const exp = getHoldExpiry(booking)
    title = `Temporary Hold – Pay within 48 Hours (${formatCountdown(holdRemaining)} left)`
    desc = `Pay the ${formatMoney(reservationFee, booking.currency)} reservation fee and upload the receipt before ${exp ? new Date(exp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'the hold expires'} to lock your date. You may also pay 50% or in full.`
  } else if (booking.paymentStatus === 'fully_paid' || booking.bookingStatus === 'completed') {
    tone = 'paid'
    icon = <CheckCircle size={20} />
    title = 'Full Payment Completed'
    desc = 'Your reservation is locked in our master catering calendar. You may download your official contract and invoice anytime.'
  } else if (booking.paymentStatus === 'pending_verification') {
    tone = 'pending'
    icon = <Clock size={20} />
    title = 'Pending Verification'
    desc = `Receipt submitted${booking.gcashRefNumber ? ` (Ref: ${booking.gcashRefNumber})` : ''} for ${formatMoney(booking.downpaymentAmount || downpaymentDue, booking.currency)}. Our team is verifying your payment — your date is locked meanwhile.`
  } else if (isBalanceStage) {
    tone = 'partial'
    icon = <CheckCircle size={20} />
    title = booking.paymentStatus === 'partially_paid'
      ? `Reservation Fee Paid – Remaining Balance: ${formatMoney(remaining, booking.currency)}`
      : `50% Paid – Remaining Balance: ${formatMoney(remaining, booking.currency)}`
    desc = 'Your date is locked. Settle the remaining balance on or before your event day — you may upload the receipt here anytime.'
  } else {
    tone = 'due'
    icon = <AlertCircle size={20} />
    title = term === 'full'
      ? `Full Payment Due: ${formatMoney(booking.totalPrice, booking.currency)}`
      : `50% Downpayment Due: ${formatMoney(downpaymentDue, booking.currency)}`
    desc = 'Your date is reserved. Upload your payment receipt below whenever you are ready so our team can verify it.'
  }

  return (
    <div className={`pay-status-panel tone-${tone}`}>
      <div className="pay-status-head">
        <div className="pay-status-icon">{icon}</div>
        <div className="pay-status-text">
          <span className="pay-status-kicker">Payment Status</span>
          <h4>{title}</h4>
          <p>{desc}</p>
          {booking.proofOfPaymentUrl && !isClosed && (
            <a href={booking.proofOfPaymentUrl} target="_blank" rel="noopener noreferrer" className="pay-status-link">
              View uploaded receipt <ArrowUpRight size={13} />
            </a>
          )}
        </div>
        {canUpload && (
          <button
            type="button"
            className="pay-status-toggle"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
          >
            <UploadCloud size={15} />
            <span>{booking.paymentStatus === 'pending_verification' ? 'Replace Receipt (Optional)' : 'Upload Payment Receipt (Optional)'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {canUpload && isExpanded && (
        <div className="pay-status-body">
          {/* Amount selector for holds / unpaid bookings */}
          {!isBalanceStage && booking.paymentStatus !== 'pending_verification' && (
            <div className="pay-choice-row" role="radiogroup" aria-label="Payment amount">
              {term === 'reserve' && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={payChoice === 'reserve'}
                  className={`pay-choice ${payChoice === 'reserve' ? 'active' : ''}`}
                  onClick={() => setPayChoice('reserve')}
                >
                  <strong>Reservation Fee</strong>
                  <span>{formatMoney(reservationFee, booking.currency)}</span>
                </button>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={payChoice === 'downpayment'}
                className={`pay-choice ${payChoice === 'downpayment' ? 'active' : ''}`}
                onClick={() => setPayChoice('downpayment')}
              >
                <strong>50% Downpayment</strong>
                <span>{formatMoney(downpaymentDue, booking.currency)}</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={payChoice === 'full'}
                className={`pay-choice ${payChoice === 'full' ? 'active' : ''}`}
                onClick={() => setPayChoice('full')}
              >
                <strong>100% Full Payment</strong>
                <span>{formatMoney(booking.totalPrice, booking.currency)}</span>
              </button>
            </div>
          )}

          <div className="pay-status-grid">
            {/* QR column */}
            <div className="pay-qr-col">
              <div className="pay-qr-tabs">
                <button type="button" className={qrMethod === 'gcash' ? 'active gcash' : ''} onClick={() => setQrMethod('gcash')}>
                  GCash (QR Ph)
                </button>
                <button type="button" className={qrMethod === 'maribank' ? 'active maribank' : ''} onClick={() => setQrMethod('maribank')}>
                  MariBank (InstaPay)
                </button>
              </div>
              <button
                type="button"
                className="pay-qr-frame"
                onClick={() => onZoomQr(qrMethod === 'gcash' ? GCASH_QR : MARIBANK_QR)}
                title="Click to enlarge QR code"
              >
                <img src={qrMethod === 'gcash' ? GCASH_QR.imageSrc : MARIBANK_QR.imageSrc} alt={`${qrMethod === 'gcash' ? 'GCash' : 'MariBank'} QR code`} />
                <span className="pay-qr-zoom"><Maximize2 size={11} /> Fullscreen</span>
              </button>
              <div className="pay-qr-meta">
                <strong>{qrMethod === 'gcash' ? 'SU*****E C. (Sinag Catering)' : 'SUNSHINE CRUZ – MariBank (****2765)'}</strong>
                <span>
                  0928 714 4597
                  <button
                    type="button"
                    className="pay-copy"
                    onClick={() => {
                      navigator.clipboard?.writeText('09287144597').catch(() => {})
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                </span>
                <span className="pay-amount-due">
                  Amount to transfer: <strong>{formatMoney(uploadAmount, booking.currency)}</strong>
                </span>
              </div>
              {!isBalanceStage && booking.paymentStatus !== 'pending_verification' && (
                <button type="button" className="pay-online-btn" onClick={() => onPayOnline(uploadAmount)}>
                  <CreditCard size={14} /> Pay Online (GCash / Card / Maya)
                </button>
              )}
            </div>

            {/* Upload column */}
            <div className="pay-upload-col">
              <label className="pay-input-label" htmlFor={`ref-${booking.id}`}>
                <Receipt size={13} /> Reference Number <em>(optional)</em>
              </label>
              <input
                id={`ref-${booking.id}`}
                type="text"
                className="portal-text-input"
                placeholder="e.g. 902148923019"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
              />

              <span className="pay-input-label" style={{ marginTop: '12px' }}>
                <UploadCloud size={13} /> Payment Receipt Screenshot
              </span>
              <label
                htmlFor={`receipt-${booking.id}`}
                className={`portal-dropzone ${receiptUrl ? 'has-file' : ''} ${error && !receiptUrl ? 'dropzone-error' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  void handleFile(e.dataTransfer.files?.[0])
                }}
              >
                <input
                  id={`receipt-${booking.id}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleFile(e.target.files?.[0])}
                />
                {receiptUrl ? (
                  <div className="portal-dropzone-selected">
                    <img src={receiptUrl} alt="Receipt thumbnail" className="portal-receipt-thumbnail" />
                    <div className="portal-dropzone-fileinfo">
                      <span className="portal-dropzone-filename">{fileName || 'receipt.png'}</span>
                      <span className="portal-dropzone-change"><CheckCircle size={12} /> Ready · Click to change</span>
                    </div>
                  </div>
                ) : (
                  <div className="portal-dropzone-empty">
                    <div className="portal-upload-icon-circle">
                      {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                    </div>
                    <div className="portal-dropzone-text">
                      <strong>{isUploading ? 'Uploading receipt…' : 'Click or drop your receipt here'}</strong>
                      <span>PNG, JPG, or WEBP up to 10MB</span>
                    </div>
                  </div>
                )}
              </label>

              {error && (
                <div className="portal-alert-error" role="alert" style={{ marginTop: '10px' }}>
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                className="portal-btn-submit-proof"
                onClick={handleSubmit}
                disabled={!receiptUrl || isUploading}
                style={{ marginTop: '12px' }}
              >
                <CheckCircle size={15} />
                <span>Submit Receipt for Verification</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
