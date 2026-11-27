import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Calendar,
  Trash2,
  AlertCircle,
  AlertTriangle,
  FileText,
  CheckCircle,
  Printer,
  X,
  Copy,
  Check,
  LogOut,
  Users,
  Clock,
  Lock,
  CalendarDays,
  User as UserIcon,
  Utensils,
  RotateCcw,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Booking } from '../types'
import { formatMoney } from '../data/packages'
import { EmbeddedCheckoutModal } from '../components/EmbeddedCheckoutModal'
import { useConfirm } from '../context/ConfirmContext'
import { UserProfileModal } from '../components/UserProfileModal'
import { CancelBookingModal } from '../components/CancelBookingModal'
import { RebookDatePicker } from '../components/RebookDatePicker'
import { PaymentStatusPanel } from '../components/PaymentStatusPanel'
import type { QrZoomInfo } from '../components/PaymentStatusPanel'
import {
  addDaysToDateStr,
  formatCountdown,
  getBookingStatusLabel,
  getRebookDateInfo,
  manilaToday,
  getHoldRemainingMs,
  getPaymentStatusLabel,
  getRemainingBalance,
  isHoldExpired,
  isReserveHold,
} from '../lib/bookingRules'
import { LoginPage } from './LoginPage'

export const ClientPortal: React.FC = () => {
  const {
    currentUser,
    bookings,
    logout,
    uploadPayment,
    cancelBooking,
    rebookEvent,
    refreshAvailability,
    blockedDates,
    business,
  } = useApp()

  const { confirm } = useConfirm()

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Action states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showRebookModal, setShowRebookModal] = useState(false)
  const [rebookDate, setRebookDate] = useState('')
  const [rebookError, setRebookError] = useState<string | null>(null)
  const [rebookSubmitting, setRebookSubmitting] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const visibleRangeRef = useRef<{ from: string; to: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)
  const [portalNotice, setPortalNotice] = useState<{ tone: 'success' | 'info'; text: string } | null>(null)

  // Contract/Invoice modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)

  const [copiedRefId, setCopiedRefId] = useState<string | null>(null)
  const [portalQrZoom, setPortalQrZoom] = useState<QrZoomInfo | null>(null)
  const [checkout, setCheckout] = useState<{ booking: Booking; amount: number } | null>(null)

  // Keep hold countdowns fresh
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => window.clearInterval(t)
  }, [])

  const handleCopyRef = (id: string) => {
    navigator.clipboard?.writeText(id).catch(() => {})
    setCopiedRefId(id)
    setTimeout(() => setCopiedRefId(null), 2000)
  }

  // Filter bookings for current logged in client (newest first)
  const clientBookings = bookings
    .filter((b) => b.email?.toLowerCase().trim() === currentUser?.email?.toLowerCase().trim())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const isOpenBooking = (b: Booking) =>
    b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit' && !isHoldExpired(b, now)

  const activeBooking =
    clientBookings.find((b) => isOpenBooking(b) && (b.bookingStatus === 'confirmed' || b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'fully_paid')) ||
    clientBookings.find(isOpenBooking) ||
    null

  const activeHolds = clientBookings.filter((b) => isReserveHold(b) && !isHoldExpired(b, now))

  const rebookMinDate = addDaysToDateStr(manilaToday(), business.changeNoticeDays)

  const openRebook = (booking: Booking) => {
    setSelectedBooking(booking)
    setRebookDate('')
    setRebookError(null)
    setShowRebookModal(true)
  }

  const closeRebook = () => {
    if (rebookSubmitting) return
    setShowRebookModal(false)
    setRebookError(null)
    visibleRangeRef.current = null
  }

  // Live fetch of bookings + blocked dates for the month the picker is showing
  const loadAvailability = useCallback(async (from: string, to: string) => {
    visibleRangeRef.current = { from, to }
    setAvailabilityLoading(true)
    try {
      await refreshAvailability(from, to)
    } finally {
      setAvailabilityLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback re-sync while the modal is open (realtime keeps state live; this covers dropped sockets)
  useEffect(() => {
    if (!showRebookModal) return
    const t = window.setInterval(() => {
      const r = visibleRangeRef.current
      if (r) void refreshAvailability(r.from, r.to)
    }, 30 * 1000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRebookModal])

  // Keep the modal's booking in sync with live data
  const liveRebookBooking = selectedBooking ? bookings.find((b) => b.id === selectedBooking.id) ?? selectedBooking : null

  // If the chosen date gets taken by a live update while the modal is open, drop it
  const rebookDateInfo =
    showRebookModal && rebookDate && liveRebookBooking
      ? getRebookDateInfo(rebookDate, liveRebookBooking, bookings, blockedDates, rebookMinDate)
      : null
  const rebookDateLost = !!rebookDateInfo && !rebookDateInfo.selectable
  const effectiveRebookDate = rebookDateLost ? '' : rebookDate
  const rebookMessage =
    rebookError ||
    (rebookDateLost && rebookDateInfo
      ? `${rebookDate} is no longer available (${rebookDateInfo.label.toLowerCase()}). Please pick another date.`
      : null)

  const handleRebookSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking || rebookSubmitting) return
    if (!effectiveRebookDate) {
      setRebookError('Please pick an available date on the calendar.')
      return
    }
    setRebookSubmitting(true)
    setRebookError(null)
    try {
      const res = await rebookEvent(selectedBooking.id, effectiveRebookDate)
      if (!res.success) {
        setRebookError(res.message)
        if (res.conflict) setRebookDate('')
        return
      }
      setShowRebookModal(false)
      visibleRangeRef.current = null
      setPortalNotice({ tone: 'success', text: res.message })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setRebookSubmitting(false)
    }
  }

  const handleCancelConfirm = (reason: string, notes: string) => {
    if (!cancelTarget) return
    const result = cancelBooking(cancelTarget.id, reason, notes)
    setCancelTarget(null)
    setPortalNotice({
      tone: 'info',
      text: result.refundStatus === 'pending'
        ? `Booking cancelled. Your refund request of ${formatMoney(result.refundAmount, cancelTarget.currency)} (${result.refundPercentage}% tier) was sent to Sinag Catering for manual review and payout.`
        : 'Booking cancelled. Under our cancellation policy, no refund applies for this notice period.',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClientLogout = async () => {
    const hasActiveCheckout = Boolean(checkout)
    const ok = await confirm({
      title: hasActiveCheckout ? 'Discard Payment & Sign Out?' : 'Confirm Sign Out',
      message: hasActiveCheckout
        ? 'You have an active payment transaction currently in progress. Signing out will cancel this checkout.\n\nAre you sure you want to sign out?'
        : 'Are you sure you want to sign out of your client portal session?',
      confirmText: hasActiveCheckout ? 'Yes, Discard & Sign Out' : 'Sign Out',
      cancelText: 'Stay Signed In',
      variant: hasActiveCheckout ? 'danger' : 'primary',
    })
    if (ok) logout()
  }

  const viewInvoice = (booking: Booking) => {
    setSelectedBooking(booking)
    setShowInvoiceModal(true)
  }

  const viewContract = (booking: Booking) => {
    setSelectedBooking(booking)
    setShowContractModal(true)
  }

  // Auth Screen
  if (!currentUser) {
    return <LoginPage onLoginSuccess={() => {}} />
  }

  const summaryStatus = (() => {
    if (!activeBooking) return { color: 'var(--muted)', icon: null as React.ReactNode, text: 'No Active Booking', sub: 'No active reservation' }
    if (isReserveHold(activeBooking)) {
      return { color: '#B45309', icon: <AlertTriangle size={16} />, text: 'Temporary Hold', sub: `${formatCountdown(getHoldRemainingMs(activeBooking, now))} left to pay` }
    }
    switch (activeBooking.paymentStatus) {
      case 'fully_paid':
        return { color: '#059669', icon: <CheckCircle size={16} />, text: 'Fully Paid', sub: 'Reservation status active' }
      case 'downpayment_paid':
      case 'partially_paid':
        return { color: '#059669', icon: <CheckCircle size={16} />, text: 'Downpayment Verified', sub: `Balance: ${formatMoney(getRemainingBalance(activeBooking), activeBooking.currency)}` }
      case 'pending_verification':
        return { color: '#D97706', icon: <Clock size={16} />, text: 'Under Verification', sub: 'Receipt submitted' }
      default:
        return {
          color: '#DC2626',
          icon: <AlertCircle size={16} />,
          text: activeBooking.paymentTerm === 'full' ? 'Full Payment Due' : `${business.downpaymentPercent}% Downpayment Due`,
          sub: 'Upload your receipt in My Bookings',
        }
    }
  })()

  // Dashboard Screen
  return (
    <div className="portal-container">
      {/* Modern Header */}
      <header className="portal-header-modern">
        <div>
          <div className="portal-tag-row">
            <span className="portal-tag-kicker">01 / CLIENT SERVICES DESK</span>
            <span className="portal-session-pill">
              <span className="status-dot dot-emerald" /> Active Client Session
            </span>
          </div>
          <h1 className="portal-heading">
            Mabuhay, <span className="serif-italic" style={{ fontWeight: 400 }}>{currentUser.name}</span>!
          </h1>
          <p className="portal-subheading">
            Review event reservations, track payment verifications, and download official invoices.
          </p>
        </div>
        <div className="portal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="btn-nav-login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.84rem',
              fontWeight: 600,
              borderRadius: '8px',
            }}
          >
            <UserIcon size={14} />
            <span>My Profile</span>
          </button>
          <button onClick={handleClientLogout} className="portal-btn-ghost">
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {portalNotice && (
        <div className={`alert-box ${portalNotice.tone === 'success' ? 'success' : ''}`} role="status" style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px', background: portalNotice.tone === 'info' ? '#EFF6FF' : undefined, border: portalNotice.tone === 'info' ? '1px solid #BFDBFE' : undefined }}>
          <RotateCcw size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#1D4ED8' }} />
          <span style={{ flex: 1 }}>{portalNotice.text}</span>
          <button type="button" onClick={() => setPortalNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Prominent temporary hold alert */}
      {activeHolds.map((b) => (
        <div key={`hold-banner-${b.id}`} className="hold-alert-banner" role="alert">
          <div className="hold-alert-icon"><AlertTriangle size={22} /></div>
          <div className="hold-alert-text">
            <strong>Your date is temporarily held!</strong>
            <span>
              Please pay the <b>{formatMoney(b.downpaymentAmount || business.reservationFee, b.currency)} reservation fee</b> within <b>{business.reserveHoldHours} hours</b> to lock in your reservation, or your booking will automatically expire. Upload the receipt in the payment box below.
            </span>
            <span className="hold-alert-meta">
              Booking {b.id.slice(0, 16)}… · {b.eventDate} · <b>{formatCountdown(getHoldRemainingMs(b, now))} remaining</b>
            </span>
          </div>
        </div>
      ))}

      {/* Summary Stats Strip */}
      <div className="portal-summary-strip">
        <div className="portal-summary-card">
          <span className="portal-summary-lbl">Total Reservations</span>
          <div className="portal-summary-val font-number">{clientBookings.length}</div>
          <span className="portal-summary-sub">Registered with your account</span>
        </div>
        <div className="portal-summary-card">
          <span className="portal-summary-lbl">Upcoming Event Date</span>
          <div className="portal-summary-val font-number" style={{ fontSize: '1.25rem' }}>
            {activeBooking ? activeBooking.eventDate : 'No scheduled event'}
          </div>
          <span className="portal-summary-sub">
            {activeBooking ? `${activeBooking.eventType} Banquet` : 'Create your reservation'}
          </span>
        </div>
        <div className="portal-summary-card">
          <span className="portal-summary-lbl">Payment Status</span>
          <div className="portal-summary-val" style={{ fontSize: '1.1rem' }}>
            <span style={{ color: summaryStatus.color, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {summaryStatus.icon} {summaryStatus.text}
            </span>
          </div>
          <span className="portal-summary-sub">{summaryStatus.sub}</span>
        </div>
      </div>

      {clientBookings.length === 0 ? (
        <div className="portal-empty-card">
          <Calendar size={44} style={{ color: 'var(--gold-dark)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.5rem', margin: '0 0 10px', fontWeight: 800 }}>No Event Reservations Found</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto 24px', fontSize: '0.9rem', lineHeight: 1.6 }}>
            You haven't requested any catering packages yet. Head over to our event calculator to design your first banquet spread!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {clientBookings.map((booking) => {
            const balanceAmount = getRemainingBalance(booking)
            const isClosed = booking.bookingStatus === 'cancelled' || booking.bookingStatus === 'forfeit' || isHoldExpired(booking, now)
            const statusLabel = getBookingStatusLabel(booking, now)
            const statusClass = isReserveHold(booking) && !isHoldExpired(booking, now) ? 'hold' : booking.bookingStatus

            return (
              <div key={booking.id} className={`portal-booking-card ${isClosed ? 'is-closed' : ''}`}>
                {/* Header Info */}
                <div className="portal-booking-top">
                  <div className="portal-booking-info">
                    <div className="portal-ref-group">
                      <span className="portal-ref-tag">
                        REF #{booking.id.slice(0, 16)}...
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyRef(booking.id)}
                        className="portal-ref-copy-btn"
                        title="Copy full reference ID"
                      >
                        {copiedRefId === booking.id ? (
                          <>
                            <Check size={12} style={{ color: '#059669' }} />
                            <span style={{ color: '#059669' }}>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy ID</span>
                          </>
                        )}
                      </button>
                    </div>

                    <h2 className="portal-booking-title">
                      {booking.eventType} Banquet
                    </h2>

                    <div className="portal-meta-badges">
                      <span className="portal-meta-item">
                        <Calendar size={14} style={{ color: 'var(--gold-dark)' }} />
                        <span>Scheduled: <strong>{booking.eventDate}</strong></span>
                      </span>
                      <span className="portal-meta-item">
                        <Users size={14} style={{ color: 'var(--gold-dark)' }} />
                        <span><strong>{booking.guestCount}</strong> Attendees (+{business.foodBufferPax} buffer)</span>
                      </span>
                    </div>
                  </div>

                  <div className="portal-booking-status-col">
                    <span className={`portal-status-badge badge-${statusClass}`}>
                      <span className="status-dot" />
                      <span>Status: {statusLabel}</span>
                    </span>
                    <span className={`portal-status-badge badge-payment-${booking.paymentStatus}`}>
                      <span className="status-dot" />
                      <span>Payment: {getPaymentStatusLabel(booking)}</span>
                    </span>
                  </div>
                </div>

                {/* Details Bento 3-block Grid */}
                <div className="portal-bento-grid">
                  <div className="portal-bento-card">
                    <span className="portal-bento-label">Selected Tier & Service</span>
                    <div className="portal-bento-val-title">{booking.packageName}</div>
                    <p className="portal-bento-desc">
                      Full banquet arrangement with professional staff, buffet setup, and standard dinnerware.
                    </p>
                  </div>

                  <div className="portal-bento-card">
                    <span className="portal-bento-label">Financial Breakdown</span>
                    <div className="portal-bento-price font-number">
                      {formatMoney(booking.totalPrice, booking.currency)}
                    </div>
                    <div className="portal-balance-tag">
                      Remaining Balance: <strong>{formatMoney(balanceAmount, booking.currency)}</strong>
                    </div>
                  </div>

                  <div className="portal-bento-card">
                    <span className="portal-bento-label">Official Documentation</span>
                    <div className="portal-docs-row">
                      <button type="button" onClick={() => viewInvoice(booking)} className="portal-doc-btn">
                        <FileText size={14} />
                        <span>Invoice</span>
                      </button>
                      <button
                        type="button"
                        disabled={booking.bookingStatus !== 'confirmed'}
                        onClick={() => viewContract(booking)}
                        className={`portal-doc-btn ${booking.bookingStatus !== 'confirmed' ? 'disabled' : ''}`}
                        title={booking.bookingStatus !== 'confirmed' ? 'Contract unlocks once reservation is confirmed' : 'View Contract'}
                      >
                        {booking.bookingStatus !== 'confirmed' ? <Lock size={13} /> : <FileText size={14} />}
                        <span>Contract</span>
                      </button>
                    </div>
                    <span className="portal-docs-hint">
                      {booking.bookingStatus === 'confirmed'
                        ? 'Official contract unlocked & ready for print'
                        : 'Contract unlocks upon admin booking confirmation'}
                    </span>
                  </div>
                </div>

                {/* Catering Menu & Course Selections Display */}
                <div style={{ background: '#FFFDF9', border: '1.5px solid var(--gold)', borderRadius: '12px', padding: '18px 22px', margin: '18px 0', boxShadow: '0 2px 8px rgba(184,137,66,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Utensils size={18} style={{ color: 'var(--gold-dark)' }} />
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--ink)' }}>
                        Your Catering Menu & Banquet Selections
                      </h4>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>
                      Package: <strong>{booking.packageName}</strong> ({booking.guestCount} pax + {business.foodBufferPax} pax buffer)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {/* Main Courses */}
                    <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        Included Main Courses (3 Mains)
                      </div>
                      {booking.addOns?.selectedMainDishes && booking.addOns.selectedMainDishes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {booking.addOns.selectedMainDishes.map((dish) => (
                            <span key={dish} style={{ background: '#FFFFFF', color: '#991B1B', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #FECACA' }}>
                              ✓ {dish}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#991B1B', fontStyle: 'italic' }}>Standard Chef Banquet Selection</span>
                      )}
                    </div>

                    {/* Pasta */}
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        Included Pasta Specialty (1 Pasta)
                      </div>
                      {booking.addOns?.selectedPastaDishes && booking.addOns.selectedPastaDishes.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {booking.addOns.selectedPastaDishes.map((pasta) => (
                            <span key={pasta} style={{ background: '#FFFFFF', color: '#1E40AF', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #DBEAFE' }}>
                              ✓ {pasta}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#1E40AF', fontStyle: 'italic' }}>Standard House Pasta Selection</span>
                      )}
                    </div>

                    {/* Drink */}
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        Included Refreshing Drink
                      </div>
                      {booking.addOns?.selectedDrinks && booking.addOns.selectedDrinks.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {booking.addOns.selectedDrinks.map((drink) => (
                            <span key={drink} style={{ background: '#FFFFFF', color: '#065F46', padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #A7F3D0' }}>
                              🥤 {drink}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: '#065F46', fontStyle: 'italic' }}>Signature House Cooler</span>
                      )}
                    </div>
                  </div>

                  {/* Extra Food & Add-ons */}
                  {((booking.addOns?.extraMainDishes && booking.addOns.extraMainDishes.length > 0) ||
                    (booking.addOns?.extraPastaDishes && booking.addOns.extraPastaDishes.length > 0) ||
                    (booking.notes && booking.notes.includes('Selected mains:'))) && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #E2E8F0', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Configured Options:</span>
                      {booking.addOns?.extraMainDishes?.map((dish, i) => (
                        <span key={`ex-m-${i}`} style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: 600 }}>
                          + Extra Main: {dish}
                        </span>
                      ))}
                      {booking.addOns?.extraPastaDishes?.map((dish, i) => (
                        <span key={`ex-p-${i}`} style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.76rem', fontWeight: 600 }}>
                          + Extra Pasta: {dish}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment status container (optional receipt upload lives here) */}
                <PaymentStatusPanel
                  booking={booking}
                  onUpload={(proofUrl, refNumber, options) => {
                    uploadPayment(booking.id, proofUrl, refNumber || undefined, options)
                    setPortalNotice({ tone: 'success', text: 'Receipt submitted! Our team will verify your payment and notify you once confirmed.' })
                  }}
                  onPayOnline={(amount) => setCheckout({ booking, amount })}
                  onZoomQr={setPortalQrZoom}
                />

                {/* Modification Actions */}
                {!isClosed && booking.bookingStatus !== 'completed' && (
                  <div className="portal-card-footer">
                    <span className="portal-footer-note">
                      Modifications can be requested up to {business.changeNoticeDays} days before your scheduled date.
                    </span>
                    <div className="portal-footer-buttons">
                      <button type="button" onClick={() => openRebook(booking)} className="portal-btn-secondary">
                        <CalendarDays size={14} />
                        <span>Rebook Date</span>
                      </button>
                      <button type="button" onClick={() => setCancelTarget(booking)} className="portal-btn-destructive">
                        <Trash2 size={14} />
                        <span>Cancel Booking</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* REBOOK MODAL */}
      {showRebookModal && liveRebookBooking && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" data-lenis-prevent="true">
          <div className="modal-card" style={{ maxWidth: '560px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: '0 0 10px' }}>Rebook Event Schedule</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Updating event date for Booking Reference {liveRebookBooking.id}. Current date: <strong>{liveRebookBooking.eventDate}</strong>
            </p>

            <form onSubmit={handleRebookSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Select New Available Date</label>
                <RebookDatePicker
                  booking={liveRebookBooking}
                  bookings={bookings}
                  blockedDates={blockedDates}
                  minDate={rebookMinDate}
                  value={effectiveRebookDate}
                  onChange={(d) => {
                    setRebookDate(d)
                    setRebookError(null)
                  }}
                  onVisibleMonthChange={loadAvailability}
                  loading={availabilityLoading}
                />
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  background: effectiveRebookDate ? '#ECFDF5' : '#F8FAFC',
                  color: effectiveRebookDate ? '#065F46' : 'var(--muted)',
                  border: `1px solid ${effectiveRebookDate ? '#A7F3D0' : '#E2E8F0'}`,
                }}
              >
                {effectiveRebookDate ? `New date: ${effectiveRebookDate}` : 'No new date selected yet.'}
              </div>

              {rebookMessage && (
                <div
                  role="alert"
                  style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.86rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <span>{rebookMessage}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={closeRebook} className="btn-nav-logout" disabled={rebookSubmitting}>
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-submit-primary"
                  style={{ width: 'auto', opacity: !effectiveRebookDate || rebookSubmitting ? 0.6 : 1 }}
                  disabled={!effectiveRebookDate || rebookSubmitting}
                >
                  {rebookSubmitting ? 'Checking availability…' : 'Confirm Rebooking'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* CANCELLATION & REFUND REQUEST MODAL */}
      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {/* INVOICE BREAKDOWN MODAL */}
      {showInvoiceModal && selectedBooking && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" data-lenis-prevent="true">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: 0 }}>Official Quotation Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '24px', background: 'var(--paper-warm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '1.1rem' }}>Sinag Catering Services</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Baliuag, Bulacan & Metro Manila</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Invoice ID</span>
                  <div style={{ fontWeight: 700 }}>#{selectedBooking.id}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                  <span>Client Name:</span>
                  <strong>{selectedBooking.customerName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                  <span>Event Category:</span>
                  <strong>{selectedBooking.eventType}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                  <span>Event Date:</span>
                  <strong>{selectedBooking.eventDate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '8px' }}>
                  <span>Catering Package:</span>
                  <strong>{selectedBooking.packageName} ({selectedBooking.guestCount} pax)</strong>
                </div>
                {selectedBooking.addOns?.selectedMainDishes && selectedBooking.addOns.selectedMainDishes.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: '#475569' }}>
                    <span>Included Mains:</span>
                    <span>{selectedBooking.addOns.selectedMainDishes.join(', ')}</span>
                  </div>
                )}
                {selectedBooking.addOns?.selectedPastaDishes && selectedBooking.addOns.selectedPastaDishes.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: '#475569' }}>
                    <span>Included Pasta:</span>
                    <span>{selectedBooking.addOns.selectedPastaDishes.join(', ')}</span>
                  </div>
                )}
                {selectedBooking.addOns?.selectedDrinks && selectedBooking.addOns.selectedDrinks.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: '#475569' }}>
                    <span>Included Beverage:</span>
                    <span>{selectedBooking.addOns.selectedDrinks.join(', ')}</span>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700 }}>
                  <span>Total Amount Due:</span>
                  <span className="font-number" style={{ color: 'var(--terracotta)' }}>{formatMoney(selectedBooking.totalPrice, selectedBooking.currency)}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button onClick={() => window.print()} className="btn-hero-primary" style={{ padding: '10px 20px', fontSize: '0.8rem' }}>
                <Printer size={14} /> Print Invoice
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* SERVICE CONTRACT MODAL */}
      {showContractModal && selectedBooking && typeof document !== 'undefined' && createPortal(
        <div className="modal-overlay" data-lenis-prevent="true">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: 0 }}>Catering Service Contract</h3>
              <button onClick={() => setShowContractModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--ink)' }}>
              <p><strong>MEMORANDUM OF AGREEMENT</strong></p>
              <p>This Catering Contract is executed between <strong>{business.businessName}</strong> and <strong>{selectedBooking.customerName}</strong> for the <strong>{selectedBooking.eventType}</strong> event on <strong>{selectedBooking.eventDate}</strong>.</p>
              <p>1. <strong>Service Scope:</strong> Full banquet arrangement for <strong>{selectedBooking.guestCount} attendees (+{business.foodBufferPax} buffer)</strong> under the <strong>{selectedBooking.packageName}</strong> with professional staff and tableware.</p>
              {selectedBooking.addOns?.selectedMainDishes && selectedBooking.addOns.selectedMainDishes.length > 0 && (
                <p>2. <strong>Included Main Courses:</strong> {selectedBooking.addOns.selectedMainDishes.join(', ')}.</p>
              )}
              {selectedBooking.addOns?.selectedPastaDishes && selectedBooking.addOns.selectedPastaDishes.length > 0 && (
                <p>3. <strong>Included Pasta Specialty:</strong> {selectedBooking.addOns.selectedPastaDishes.join(', ')}.</p>
              )}
              {selectedBooking.addOns?.selectedDrinks && selectedBooking.addOns.selectedDrinks.length > 0 && (
                <p>4. <strong>Included Refreshment:</strong> {selectedBooking.addOns.selectedDrinks.join(', ')}.</p>
              )}
              <p>5. <strong>Payment Terms:</strong> {selectedBooking.paymentStatus === 'fully_paid' ? '100% full payment received; zero balance on event day.' : `${formatMoney(selectedBooking.downpaymentAmount || Math.round(selectedBooking.totalPrice * (business.downpaymentPercent / 100)), selectedBooking.currency)} downpayment received; remaining balance payable on or before event setup date.`}</p>
              <p>6. <strong>Terms &amp; Conditions:</strong> The client has accepted {business.businessName}&apos;s Terms &amp; Conditions and Cancellation Policy ({business.refundFullDays}+ days: full refund; {business.refundPartialDays}–{business.refundFullDays - 1} days: {business.refundPartialPercent}% refund; less than {business.refundPartialDays} days: no refund).</p>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button onClick={() => window.print()} className="btn-hero-primary" style={{ padding: '10px 20px', fontSize: '0.8rem' }}>
                <Printer size={14} /> Print Contract
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* EMBEDDED CHECKOUT MODAL (No external PayMongo redirect, 100% Sinag Branded) */}
      {checkout && (
        <EmbeddedCheckoutModal
          isOpen={!!checkout}
          onClose={() => setCheckout(null)}
          bookingId={checkout.booking.id}
          packageName={checkout.booking.packageName}
          guestCount={checkout.booking.guestCount}
          eventDate={checkout.booking.eventDate}
          amount={checkout.amount}
          totalPrice={checkout.booking.totalPrice}
          customerName={currentUser?.name || checkout.booking.customerName}
          customerEmail={currentUser?.email || checkout.booking.email}
          customerPhone={currentUser?.phone || checkout.booking.phone}
          onPaymentSuccess={() => {
            setPortalNotice({ tone: 'success', text: 'Online payment received! Your reservation is confirmed and your date is locked.' })
          }}
        />
      )}

      {/* USER PROFILE & CHANGE PASSWORD MODAL */}
      {showProfileModal && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* FULLSCREEN QR CODE MODAL */}
      {portalQrZoom && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          data-lenis-prevent="true"
          onClick={() => setPortalQrZoom(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #E2E8F0',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setPortalQrZoom(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: '#64748B',
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>
              {portalQrZoom.title}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px' }}>
              Scan directly using GCash, {business.bankName}, Maya, or any banking app via QR Ph / InstaPay.
            </p>

            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '14px', border: '2px solid #CBD5E1', display: 'inline-block', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              <img
                src={portalQrZoom.imageSrc}
                alt={portalQrZoom.title}
                style={{ width: '380px', maxWidth: '100%', height: '380px', objectFit: 'contain', display: 'block', borderRadius: '8px' }}
              />
            </div>

            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px', textAlign: 'left', fontSize: '0.85rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700 }}>ACCOUNT DETAILS</div>
              <strong style={{ color: 'var(--ink)', fontSize: '0.92rem' }}>{portalQrZoom.name}</strong>
              <div style={{ marginTop: '2px', color: 'var(--ink-light)', fontSize: '0.8rem' }}>
                Account / Hotline: <strong>{portalQrZoom.acc}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={portalQrZoom.imageSrc}
                download
                className="btn-hero-primary"
                style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', fontSize: '0.85rem' }}
              >
                Save / Download QR
              </a>
              <button
                type="button"
                onClick={() => setPortalQrZoom(null)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--ink)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
