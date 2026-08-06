import React, { useState } from 'react'
import { Calendar, Trash2, Edit2, AlertCircle, FileText, CheckCircle, Printer, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Booking } from '../types'

export const ClientPortal: React.FC = () => {
  const {
    currentUser,
    bookings,
    login,
    logout,
    uploadPayment,
    cancelBooking,
    rebookEvent,
  } = useApp()

  // Authentication states
  const [emailInput, setEmailInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Action states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showRebookModal, setShowRebookModal] = useState(false)
  const [rebookDate, setRebookDate] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelRefundResult, setCancelRefundResult] = useState<{ refundPercentage: number; refundAmount: number } | null>(null)

  // Contract/Invoice modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)

  // Filter bookings for current logged in client
  const clientBookings = bookings.filter((b) => b.email === currentUser?.email)

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!emailInput.trim()) return

    if (isRegistering && !nameInput.trim()) {
      setErrorMsg('Please enter your full name to register.')
      return
    }

    const name = isRegistering ? nameInput : emailInput.split('@')[0]
    login(emailInput.toLowerCase(), name, 'client')
    setEmailInput('')
    setNameInput('')
  }

  const handleQuickLogin = (email: string, name: string) => {
    login(email, name, 'client')
  }

  const handleMockPaymentUpload = (bookingId: string) => {
    const mockReceipt = 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=500&auto=format&fit=crop&q=60'
    uploadPayment(bookingId, mockReceipt)
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

    let refundPercentage = 0
    if (diffDays >= 30) refundPercentage = 100
    else if (diffDays >= 14) refundPercentage = 50
    else refundPercentage = 0

    const amountPaid = booking.paymentStatus === 'fully_paid' ? booking.totalPrice : (booking.totalPrice * 0.5)
    const refundAmount = booking.paymentStatus === 'unpaid' ? 0 : amountPaid * (refundPercentage / 100)

    setCancelRefundResult({ refundPercentage, refundAmount })
    setShowCancelModal(true)
  }

  const handleCancelConfirm = () => {
    if (!selectedBooking) return
    cancelBooking(selectedBooking.id)
    alert('Booking cancelled successfully.')
    setShowCancelModal(false)
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

          <div className="demo-login-bar">
            <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Quick Demonstration Accounts:
            </span>
            <button
              type="button"
              onClick={() => handleQuickLogin('maria@email.com', 'Maria Santos')}
              className="btn-demo-chip"
            >
              Maria Santos (Kids Party Client)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('juan@email.com', 'Juan Dela Cruz')}
              className="btn-demo-chip"
            >
              Juan Dela Cruz (Birthday Client)
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard Screen
  return (
    <div className="portal-container">
      <header className="admin-header">
        <div className="admin-title-group">
          <span className="section-tag">Client Services Desk</span>
          <h1>Mabuhay, {currentUser.name}!</h1>
          <p style={{ color: 'var(--muted)', margin: 0 }}>Review event reservations, track payment verifications, and download invoices.</p>
        </div>
        <button onClick={logout} className="btn-nav-logout">
          Logout Account
        </button>
      </header>

      {clientBookings.length === 0 ? (
        <div style={{ background: '#FFF', padding: '60px', borderRadius: 'var(--radius-lg)', textAlign: 'center', border: '1px solid var(--line)' }}>
          <Calendar size={48} style={{ color: 'var(--gold)', marginBottom: '16px' }} />
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: '0 0 10px' }}>No Event Reservations Found</h3>
          <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto 24px' }}>
            You haven't requested any catering packages yet. Head over to our customizer to design your first feast!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {clientBookings.map((booking) => {
            const downpaymentRequired = booking.totalPrice * 0.5
            const balanceAmount = booking.paymentStatus === 'fully_paid' ? 0 : booking.paymentStatus === 'partially_paid' ? booking.totalPrice * 0.5 : booking.totalPrice

            return (
              <div
                key={booking.id}
                style={{ background: '#FFF', borderRadius: 'var(--radius-lg)', padding: '36px', border: '1px solid var(--line)', boxShadow: 'var(--shadow-md)' }}
              >
                {/* Header Info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '20px', marginBottom: '24px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>
                      Booking REF: {booking.id}
                    </span>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: '4px 0' }}>
                      {booking.eventType} Banquet
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} /> Scheduled Date: <strong>{booking.eventDate}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span className={`status-pill ${booking.bookingStatus}`}>
                      {booking.bookingStatus}
                    </span>
                    <span className={`status-pill ${booking.paymentStatus === 'fully_paid' ? 'confirmed' : 'pending'}`}>
                      Payment: {booking.paymentStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '28px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Selected Tier
                    </h4>
                    <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{booking.packageName}</p>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{booking.guestCount} Attendees registered</span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Financial Breakdown
                    </h4>
                    <p className="font-number" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--terracotta)', margin: '0 0 4px' }}>
                      PHP {booking.totalPrice.toLocaleString()}
                    </p>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Remaining Balance: PHP {balanceAmount.toLocaleString()}</span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Official Documents
                    </h4>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => viewInvoice(booking)} className="btn-nav-logout">
                        <FileText size={14} /> Invoice
                      </button>
                      <button
                        disabled={booking.bookingStatus !== 'confirmed'}
                        onClick={() => viewContract(booking)}
                        className="btn-nav-logout"
                      >
                        <FileText size={14} /> Contract
                      </button>
                    </div>
                  </div>
                </div>

                {/* Payment Actions Box */}
                {booking.paymentStatus === 'unpaid' && (
                  <div style={{ background: '#FFF8E6', border: '1px solid #F3E0A3', padding: '20px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <AlertCircle size={24} style={{ color: 'var(--terracotta)' }} />
                      <div>
                        <strong style={{ color: 'var(--ink)', display: 'block' }}>50% Downpayment Required: PHP {downpaymentRequired.toLocaleString()}</strong>
                        <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>Send to GCash / Maya: 0917-123-4567 (Sinag Catering Services).</span>
                      </div>
                    </div>
                    <button onClick={() => handleMockPaymentUpload(booking.id)} className="btn-submit-primary" style={{ width: 'auto', padding: '12px 24px' }}>
                      Simulate GCash Receipt Upload
                    </button>
                  </div>
                )}

                {booking.paymentStatus === 'pending_verification' && (
                  <div style={{ background: '#E6F4EA', border: '1px solid #B7E1CD', padding: '16px 20px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <CheckCircle size={20} style={{ color: '#137333' }} />
                    <span style={{ fontSize: '0.9rem', color: '#137333' }}>
                      Downpayment receipt uploaded! Our concierge team is verifying your payment. Your calendar date is locked.
                    </span>
                  </div>
                )}

                {/* Modification Buttons */}
                {booking.bookingStatus !== 'cancelled' && (
                  <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
                    <button onClick={() => openRebook(booking)} className="btn-nav-logout">
                      <Edit2 size={12} /> Rebook Date
                    </button>
                    <button onClick={() => openCancel(booking)} className="btn-nav-logout" style={{ color: 'var(--terracotta)', borderColor: 'var(--terracotta)' }}>
                      <Trash2 size={12} /> Cancel Reservation
                    </button>
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
                <strong>PHP {selectedBooking.totalPrice.toLocaleString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '0.9rem' }}>
                <span>Refund Tier:</span>
                <strong style={{ color: cancelRefundResult.refundPercentage > 0 ? 'var(--emerald)' : 'var(--terracotta)' }}>
                  {cancelRefundResult.refundPercentage}% Refund
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 0', paddingTop: '12px', borderTop: '1px solid var(--line)', fontSize: '1.1rem' }}>
                <span>Refund Amount:</span>
                <strong className="font-number" style={{ color: 'var(--terracotta)' }}>PHP {cancelRefundResult.refundAmount.toLocaleString()}</strong>
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
                  <span className="font-number" style={{ color: 'var(--terracotta)' }}>PHP {selectedBooking.totalPrice.toLocaleString()}</span>
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
    </div>
  )
}
