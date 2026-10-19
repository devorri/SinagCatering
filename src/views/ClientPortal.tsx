import React, { useState } from 'react'
import {
  Calendar,
  Trash2,
  AlertCircle,
  FileText,
  CheckCircle,
  Printer,
  X,
  Eye,
  EyeOff,
  CreditCard,
  Copy,
  Check,
  UploadCloud,
  LogOut,
  Users,
  Receipt,
  Clock,
  ArrowUpRight,
  Lock,
  CalendarDays,
  User as UserIcon,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Booking } from '../types'
import { formatMoney } from '../data/packages'
import { PasswordStrengthIndicator, getPasswordValidationError } from '../components/PasswordStrengthIndicator'
import { EmbeddedCheckoutModal } from '../components/EmbeddedCheckoutModal'
import { useConfirm } from '../context/ConfirmContext'
import { ForgotPasswordModal } from '../components/ForgotPasswordModal'
import { UserProfileModal } from '../components/UserProfileModal'

export const ClientPortal: React.FC = () => {
  const {
    currentUser,
    bookings,
    signIn,
    signUp,
    logout,
    uploadPayment,
    cancelBooking,
    rebookEvent,
  } = useApp()

  const { confirm } = useConfirm()

  // Authentication states
  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [paymentRefInput, setPaymentRefInput] = useState('')
  const [paymentProofError, setPaymentProofError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Action states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showRebookModal, setShowRebookModal] = useState(false)
  const [rebookDate, setRebookDate] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelRefundResult, setCancelRefundResult] = useState<{ refundPercentage: number; refundAmount: number } | null>(null)

  // Contract/Invoice modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)

  // Copy and upload states
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null)
  const [copiedGcash, setCopiedGcash] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const handleCopyRef = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedRefId(id)
    setTimeout(() => setCopiedRefId(null), 2000)
  }

  const handleCopyGcash = (phone: string) => {
    navigator.clipboard.writeText(phone)
    setCopiedGcash(true)
    setTimeout(() => setCopiedGcash(false), 2000)
  }

  // Filter bookings for current logged in client
  const clientBookings = bookings.filter((b) => b.email?.toLowerCase().trim() === currentUser?.email?.toLowerCase().trim())
  const activeBooking =
    clientBookings.find(
      (b) =>
        b.bookingStatus === 'confirmed' ||
        (b as any).status === 'confirmed' ||
        (b as any).booking_status === 'confirmed' ||
        b.paymentStatus === 'downpayment_paid' ||
        (b as any).payment_status === 'downpayment_paid' ||
        b.paymentStatus === 'fully_paid',
    ) ||
    clientBookings.find((b) => b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit') ||
    clientBookings[0]

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!emailInput.trim()) return

    if (isRegistering) {
      if (!nameInput.trim()) {
        setErrorMsg('Please enter your full name to register.')
        return
      }
      const passwordError = getPasswordValidationError(passwordInput)
      if (passwordError) {
        setErrorMsg(passwordError)
        return
      }
    } else {
      if (!passwordInput) {
        setErrorMsg('Please enter your password.')
        return
      }
    }

    const result = isRegistering
      ? await signUp(nameInput, emailInput, '', passwordInput)
      : await signIn(emailInput, passwordInput)
    if (result.error) {
      setErrorMsg(result.error)
      return
    }
    if (result.confirmationRequired) {
      setErrorMsg('Check your email to confirm your account, then sign in here.')
      return
    }
    setEmailInput('')
    setNameInput('')
    setPasswordInput('')
  }

  const [uploadedReceipt, setUploadedReceipt] = useState<string | null>(null)
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null)

  const handlePaymentUpload = (bookingId: string) => {
    const ref = paymentRefInput.trim()
    if (!ref || !uploadedReceipt) {
      setPaymentProofError('Please provide both the payment reference number and screenshot proof before submitting.')
      return
    }
    uploadPayment(bookingId, uploadedReceipt, ref)
    setPaymentRefInput('')
    setUploadedReceipt(null)
    setUploadedFileName(null)
    setPaymentProofError('')
  }

  const handlePayMongoCheckout = (booking: Booking) => {
    setCheckoutBooking(booking)
  }

  const openRebook = (booking: Booking) => {
    setSelectedBooking(booking)
    setRebookDate(booking.eventDate)
    setShowRebookModal(true)
  }

  const handleRebookSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking || !rebookDate) return

    const res = rebookEvent(selectedBooking.id, rebookDate)
    if (!res.success) {
      alert(res.message)
    } else {
      alert(res.message)
      setShowRebookModal(false)
    }
  }

  const openCancel = (booking: Booking) => {
    setSelectedBooking(booking)
    
    const eventTime = new Date(booking.eventDate).getTime()
    const nowTime = new Date().getTime()
    const diffDays = Math.ceil((eventTime - nowTime) / (1000 * 60 * 60 * 24))

    const refundPercentage = diffDays >= 30 ? 100 : diffDays >= 14 ? 50 : 0

    const amountPaid = booking.paymentStatus === 'fully_paid' ? booking.totalPrice : (booking.totalPrice * 0.5)
    const refundAmount = booking.paymentStatus === 'unpaid' ? 0 : amountPaid * (refundPercentage / 100)

    setCancelRefundResult({ refundPercentage, refundAmount })
    setShowCancelModal(true)
  }

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return
    const refundText = cancelRefundResult && cancelRefundResult.refundAmount > 0
      ? `Based on our cancellation policy, your estimated refund is ${formatMoney(cancelRefundResult.refundAmount, selectedBooking.currency)} (${cancelRefundResult.refundPercentage}%).`
      : 'Under our cancellation policy, no refund applies for this notice period.'
    const ok = await confirm({
      title: 'Confirm Booking Cancellation',
      message: `Are you sure you want to cancel booking #${selectedBooking.id} (${selectedBooking.eventType} on ${selectedBooking.eventDate})?\n\n${refundText}`,
      confirmText: 'Yes, Cancel Reservation',
      cancelText: 'Keep My Booking',
      variant: 'danger',
    })
    if (!ok) return
    cancelBooking(selectedBooking.id)
    setShowCancelModal(false)
  }

  const handleClientLogout = async () => {
    const ok = await confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your client portal session?',
      confirmText: 'Sign Out',
      cancelText: 'Stay Signed In',
      variant: 'primary',
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
    return (
      <div className="portal-container">
        <div className="portal-auth-card">
          <h2 className="portal-auth-title">Client Portal Login</h2>
          <p className="portal-auth-sub">Manage your reservations, submit GCash downpayments, and view service contracts.</p>

          <form onSubmit={handleAuthSubmit}>
            {isRegistering && (
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="e.g. Maria Santos"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="input-field"
                required
                placeholder="maria@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {isRegistering ? (
                <PasswordStrengthIndicator password={passwordInput} showChecklist={true} />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    Enter your account password
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--terracotta)',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {errorMsg}
              </p>
            )}

            <button type="submit" className="btn-submit-primary">
              {isRegistering ? 'Register & Login' : 'Login to Dashboard'}
            </button>
          </form>

          <div style={{ marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register as client'}
            </button>
          </div>

        </div>

        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
          initialIdentifier={emailInput}
          initialMethod="email"
          onSuccess={() => setShowForgotPassword(false)}
        />
      </div>
    )
  }

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
          <span className="portal-summary-lbl">Downpayment Status</span>
          <div className="portal-summary-val" style={{ fontSize: '1.1rem' }}>
            {!activeBooking ? (
              <span style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                No Active Booking
              </span>
            ) : activeBooking.paymentStatus === 'fully_paid' || (activeBooking as any).payment_status === 'fully_paid' ? (
              <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> Fully Paid
              </span>
            ) : activeBooking.paymentStatus === 'downpayment_paid' || (activeBooking as any).payment_status === 'downpayment_paid' || activeBooking.bookingStatus === 'confirmed' || (activeBooking as any).status === 'confirmed' || (activeBooking as any).booking_status === 'confirmed' ? (
              <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> Downpayment Verified
              </span>
            ) : activeBooking.paymentStatus === 'partially_paid' ? (
              <span style={{ color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> 50% Settled
              </span>
            ) : activeBooking.paymentStatus === 'pending_verification' ? (
              <span style={{ color: '#D97706', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Under Verification
              </span>
            ) : (
              <span style={{ color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={16} /> 50% Downpayment Due
              </span>
            )}
          </div>
          <span className="portal-summary-sub">
            {!activeBooking
              ? 'No active reservation'
              : activeBooking.paymentStatus === 'unpaid' && activeBooking.bookingStatus !== 'confirmed' && (activeBooking as any).booking_status !== 'confirmed'
              ? 'Required to lock calendar date'
              : 'Reservation status active'}
          </span>
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
            const downpaymentRequired = booking.totalPrice * 0.5
            const balanceAmount =
              booking.paymentStatus === 'fully_paid'
                ? 0
                : booking.paymentStatus === 'partially_paid' || booking.paymentStatus === 'downpayment_paid'
                ? booking.totalPrice - (booking.downpaymentAmount || booking.totalPrice * 0.5)
                : booking.totalPrice

            return (
              <div key={booking.id} className="portal-booking-card">
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
                        <span><strong>{booking.guestCount}</strong> Attendees (+10 buffer)</span>
                      </span>
                    </div>
                  </div>

                  <div className="portal-booking-status-col">
                    <span className={`portal-status-badge badge-${booking.bookingStatus}`}>
                      <span className="status-dot" />
                      <span style={{ textTransform: 'capitalize' }}>Status: {booking.bookingStatus}</span>
                    </span>
                    <span className={`portal-status-badge badge-payment-${booking.paymentStatus}`}>
                      <span className="status-dot" />
                      <span style={{ textTransform: 'capitalize' }}>
                        Payment: {booking.paymentStatus === 'unpaid' ? '50% Unpaid' : booking.paymentStatus.replace('_', ' ')}
                      </span>
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

                {/* Payment Actions Box */}
                {booking.paymentStatus === 'unpaid' && booking.bookingStatus !== 'confirmed' && (activeBooking as any).booking_status !== 'confirmed' && (
                  <div className="portal-checkout-panel">
                    <div className="portal-checkout-grid">
                      {/* Left Column: QR & Instant Payment */}
                      <div className="portal-checkout-col-left">
                        <div className="portal-checkout-badge-row">
                          <span className="portal-step-pill">STEP 01</span>
                          <span className="portal-checkout-kicker">50% Downpayment Required</span>
                        </div>
                        <div className="portal-checkout-amount font-number">
                          {formatMoney(downpaymentRequired, booking.currency)}
                        </div>
                        <p className="portal-checkout-sub">
                          To lock your reservation date on our official catering schedule, scan the verified QR Ph code or pay via PayMongo.
                        </p>

                        <div className="portal-qr-showcase">
                          <div className="portal-qr-frame">
                            <img
                              src="/sinag_gcash_qr.png"
                              alt="Scan GCash / QR Ph"
                              className="portal-qr-img"
                            />
                          </div>
                          <div className="portal-qr-details">
                            <span className="portal-qr-account-lbl">Official QR Ph / GCash</span>
                            <strong className="portal-qr-account-name">Sinag Catering Services / Sunshine C.</strong>
                            <div className="portal-qr-copy-row">
                              <span className="portal-qr-phone">0928 714 4597</span>
                              <button
                                type="button"
                                onClick={() => handleCopyGcash('09287144597')}
                                className="portal-copy-pill"
                              >
                                {copiedGcash ? (
                                  <>
                                    <Check size={11} style={{ color: '#059669' }} />
                                    <span style={{ color: '#059669' }}>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <span className="portal-qr-hint">Scan using GCash, Maya, BDO, BPI, or any mobile bank app.</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePayMongoCheckout(booking)}
                          className="portal-paymongo-btn"
                        >
                          <CreditCard size={15} />
                          <span>Pay Online (GCash / Card / Maya)</span>
                        </button>
                      </div>

                      {/* Right Column: Reference & File Upload Verification */}
                      <div className="portal-checkout-col-right">
                        <div className="portal-checkout-badge-row">
                          <span className="portal-step-pill">STEP 02</span>
                          <span className="portal-checkout-kicker">Payment Verification</span>
                        </div>
                        <h4 className="portal-proof-title">Submit Transaction Proof</h4>
                        <p className="portal-checkout-sub">
                          Enter your GCash / Bank reference number and attach your payment receipt screenshot.
                        </p>

                        <div className="portal-upload-form">
                          <div className="portal-input-group">
                            <label className="portal-input-label">
                              <Receipt size={13} />
                              <span>Reference Number <strong style={{ color: '#DC2626' }}>*</strong></span>
                            </label>
                            <input
                              type="text"
                              className={`portal-text-input ${paymentProofError && !paymentRefInput.trim() ? 'input-error' : ''}`}
                              placeholder="Enter Reference No. (e.g. 902148923019)"
                              value={paymentRefInput}
                              onChange={(e) => setPaymentRefInput(e.target.value)}
                            />
                            {paymentProofError && !paymentRefInput.trim() && (
                              <span className="portal-field-error">Transaction reference number is required.</span>
                            )}
                          </div>

                          <div className="portal-input-group">
                            <label className="portal-input-label">
                              <UploadCloud size={13} />
                              <span>Screenshot Proof <strong style={{ color: '#DC2626' }}>*</strong></span>
                            </label>

                            <label
                              htmlFor={`receipt-upload-${booking.id}`}
                              className={`portal-dropzone ${uploadedReceipt ? 'has-file' : ''} ${paymentProofError && !uploadedReceipt ? 'dropzone-error' : ''}`}
                            >
                              <input
                                id={`receipt-upload-${booking.id}`}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    setUploadedFileName(file.name)
                                    const reader = new FileReader()
                                    reader.onloadend = () => setUploadedReceipt(reader.result as string)
                                    reader.readAsDataURL(file)
                                  }
                                }}
                              />
                              {uploadedReceipt ? (
                                <div className="portal-dropzone-selected">
                                  {uploadedReceipt.startsWith('data:image') && (
                                    <img src={uploadedReceipt} alt="Receipt thumbnail" className="portal-receipt-thumbnail" />
                                  )}
                                  <div className="portal-dropzone-fileinfo">
                                    <span className="portal-dropzone-filename">{uploadedFileName || 'receipt_screenshot.png'}</span>
                                    <span className="portal-dropzone-change"><CheckCircle size={12} /> Ready to submit · Click to change file</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="portal-dropzone-empty">
                                  <div className="portal-upload-icon-circle">
                                    <UploadCloud size={18} />
                                  </div>
                                  <div className="portal-dropzone-text">
                                    <strong>Click or tap to upload screenshot proof</strong>
                                    <span>PNG, JPG, or WEBP up to 10MB</span>
                                  </div>
                                </div>
                              )}
                            </label>
                            {paymentProofError && !uploadedReceipt && (
                              <span className="portal-field-error">Screenshot image proof is required.</span>
                            )}
                          </div>

                          {paymentProofError && (
                            <div className="portal-alert-error" role="alert">
                              <AlertCircle size={15} />
                              <span>{paymentProofError}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePaymentUpload(booking.id)}
                            disabled={!paymentRefInput.trim() || !uploadedReceipt}
                            className="portal-btn-submit-proof"
                          >
                            <CheckCircle size={15} />
                            <span>Submit Payment Proof</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {booking.paymentStatus === 'pending_verification' && (
                  <div className="portal-verification-notice">
                    <div className="portal-notice-left">
                      <div className="portal-notice-icon-circle">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="portal-notice-title">Downpayment Submitted & Pending Admin Verification</h4>
                        <p className="portal-notice-desc">
                          Reference No: <strong>{booking.gcashRefNumber || 'Receipt uploaded'}</strong> · Your calendar date is temporarily locked.
                        </p>
                      </div>
                    </div>
                    {booking.proofOfPaymentUrl && (
                      <a
                        href={booking.proofOfPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="portal-notice-link"
                      >
                        <span>View Uploaded Receipt</span>
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                )}

                {(booking.paymentStatus === 'fully_paid' || booking.paymentStatus === 'downpayment_paid') && (
                  <div className="portal-paid-notice">
                    <div className="portal-notice-left">
                      <div className="portal-notice-icon-circle paid">
                        <CheckCircle size={20} />
                      </div>
                      <div>
                        <h4 className="portal-notice-title">
                          {booking.paymentStatus === 'fully_paid' ? 'Full Payment Completed' : 'Reservation Downpayment Completed'}
                        </h4>
                        <p className="portal-notice-desc">
                          Your reservation is locked in our master catering calendar. You may download your official contract and invoice anytime.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modification Actions */}
                {booking.bookingStatus !== 'cancelled' && (
                  <div className="portal-card-footer">
                    <span className="portal-footer-note">
                      Modifications can be requested up to 14 days before your scheduled date.
                    </span>
                    <div className="portal-footer-buttons">
                      <button type="button" onClick={() => openRebook(booking)} className="portal-btn-secondary">
                        <CalendarDays size={14} />
                        <span>Rebook Date</span>
                      </button>
                      <button type="button" onClick={() => openCancel(booking)} className="portal-btn-destructive">
                        <Trash2 size={14} />
                        <span>Cancel Reservation</span>
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
      {showRebookModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: '0 0 10px' }}>Rebook Event Schedule</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>Updating event date for Booking Reference {selectedBooking.id}</p>

            <form onSubmit={handleRebookSubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Select New Available Date</label>
                <input
                  type="date"
                  className="input-field"
                  required
                  value={rebookDate}
                  min={(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10) })()}
                  onChange={(e) => setRebookDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button type="button" onClick={() => setShowRebookModal(false)} className="btn-nav-logout">
                  Close
                </button>
                <button type="submit" className="btn-submit-primary" style={{ width: 'auto' }}>
                  Confirm Rebooking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {showCancelModal && selectedBooking && cancelRefundResult && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: '0 0 10px' }}>Confirm Cancellation</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Booking Reference: {selectedBooking.id}</p>

            <div style={{ background: 'var(--paper-warm)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '0.9rem' }}>
                <span>Total Package Price:</span>
                <strong>{formatMoney(selectedBooking.totalPrice, selectedBooking.currency)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '0.9rem' }}>
                <span>Refund Tier:</span>
                <strong style={{ color: cancelRefundResult.refundPercentage > 0 ? 'var(--emerald)' : 'var(--terracotta)' }}>
                  {cancelRefundResult.refundPercentage}% Refund
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 0', paddingTop: '12px', borderTop: '1px solid var(--line)', fontSize: '1.1rem' }}>
                <span>Refund Amount:</span>
                <strong className="font-number" style={{ color: 'var(--terracotta)' }}>{formatMoney(cancelRefundResult.refundAmount, selectedBooking.currency)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCancelModal(false)} className="btn-nav-logout">
                Back
              </button>
              <button onClick={handleCancelConfirm} className="btn-submit-primary" style={{ width: 'auto', background: 'var(--terracotta)' }}>
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE BREAKDOWN MODAL */}
      {showInvoiceModal && selectedBooking && (
        <div className="modal-overlay">
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
        </div>
      )}

      {/* SERVICE CONTRACT MODAL */}
      {showContractModal && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: 0 }}>Catering Service Contract</h3>
              <button onClick={() => setShowContractModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--ink)' }}>
              <p><strong>MEMORANDUM OF AGREEMENT</strong></p>
              <p>This Catering Contract is executed between <strong>Sinag Catering Services</strong> and <strong>{selectedBooking.customerName}</strong> for the <strong>{selectedBooking.eventType}</strong> event on <strong>{selectedBooking.eventDate}</strong>.</p>
              <p>1. <strong>Service Scope:</strong> Full buffet setup, {selectedBooking.packageName} menu spread, and staff allocation of 3 waiters per 100 pax.</p>
              <p>2. <strong>Payment Terms:</strong> 50% downpayment received; remaining 50% balance payable on or before event setup date.</p>
            </div>

            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button onClick={() => window.print()} className="btn-hero-primary" style={{ padding: '10px 20px', fontSize: '0.8rem' }}>
                <Printer size={14} /> Print Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMBEDDED CHECKOUT MODAL (No external PayMongo redirect, 100% Sinag Branded) */}
      {checkoutBooking && (
        <EmbeddedCheckoutModal
          isOpen={!!checkoutBooking}
          onClose={() => setCheckoutBooking(null)}
          bookingId={checkoutBooking.id}
          packageName={checkoutBooking.packageName}
          guestCount={checkoutBooking.guestCount}
          eventDate={checkoutBooking.eventDate}
          amount={checkoutBooking.downpaymentAmount || Math.round(checkoutBooking.totalPrice * 0.5)}
          totalPrice={checkoutBooking.totalPrice}
          customerName={currentUser?.name || checkoutBooking.customerName}
          customerEmail={currentUser?.email || checkoutBooking.email}
          customerPhone={currentUser?.phone || checkoutBooking.phone}
          onPaymentSuccess={(_ref) => {
            // Updated directly in database & AppContext
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
    </div>
  )
}
