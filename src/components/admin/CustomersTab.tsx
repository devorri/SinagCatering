import React, { useEffect, useMemo, useState } from 'react'
import { Search, X, RefreshCw, Mail, Phone, Calendar, ShieldCheck, Loader2, Eye, Users } from 'lucide-react'
import type { Booking, CustomerAccount } from '../../types'
import { formatMoney } from '../../data/packages'
import {
  PAYMENT_TERM_LABELS,
  getAmountPaid,
  getBookingStatusLabel,
  getPaymentStatusLabel,
  getPaymentTerm,
} from '../../lib/bookingRules'

interface CustomersTabProps {
  bookings: Booking[]
  fetchCustomers: () => Promise<CustomerAccount[]>
  onOpenBooking: (booking: Booking) => void
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ bookings, fetchCustomers, onOpenBooking }) => {
  const [customers, setCustomers] = useState<CustomerAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CustomerAccount | null>(null)

  const load = async () => {
    setIsLoading(true)
    try {
      setCustomers(await fetchCustomers())
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const bookingsByEmail = useMemo(() => {
    const map = new Map<string, Booking[]>()
    bookings.forEach((b) => {
      const key = b.email.toLowerCase().trim()
      const list = map.get(key) || []
      list.push(b)
      map.set(key, list)
    })
    map.forEach((list) => list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    return map
  }, [bookings])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || '').includes(q))
      .map((c) => ({ customer: c, bookings: bookingsByEmail.get(c.email.toLowerCase().trim()) || [] }))
  }, [customers, query, bookingsByEmail])

  const selectedBookings = selected ? bookingsByEmail.get(selected.email.toLowerCase().trim()) || [] : []
  const selectedTotals = useMemo(() => {
    const active = selectedBookings.filter((b) => b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit')
    return {
      bookedValue: active.reduce((s, b) => s + b.totalPrice, 0),
      paid: selectedBookings.reduce((s, b) => s + (b.bookingStatus === 'cancelled' && b.refundStatus === 'processed' ? 0 : getAmountPaid(b)), 0),
      refunds: selectedBookings.reduce((s, b) => s + (b.refundStatus === 'pending' || b.refundStatus === 'processed' ? b.refundAmount || 0 : 0), 0),
    }
  }, [selectedBookings])

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  return (
    <div className="admin-tab-card">
      <div className="admin-tab-card-head">
        <div>
          <h3>Customer Directory</h3>
          <p>All registered clients with their booking and transaction history. Click a row for full details.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="admin-register-search">
            <Search size={14} style={{ color: '#A1A1AA' }} />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search customers by name or email"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
          <button type="button" className="btn-action-view" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Contact Number</th>
              <th>Date Joined</th>
              <th style={{ textAlign: 'center' }}>Total Bookings</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && customers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <Loader2 size={18} className="animate-spin" style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Loading customers…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  {query ? 'No customers match your search.' : 'No registered customers yet.'}
                </td>
              </tr>
            ) : (
              rows.map(({ customer, bookings: list }) => (
                <tr
                  key={`${customer.id}-${customer.email}`}
                  className="admin-row-clickable"
                  onClick={() => setSelected(customer)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(customer)
                    }
                  }}
                >
                  <td>
                    <div style={{ fontWeight: 700, color: '#18181B' }}>{customer.name}</div>
                    {customer.isGuest && <span className="auth-pill guest">Guest booking</span>}
                  </td>
                  <td style={{ color: '#52525B', fontSize: '0.86rem' }}>{customer.email}</td>
                  <td style={{ color: '#52525B', fontSize: '0.86rem' }}>{customer.phone || '—'}</td>
                  <td style={{ color: '#52525B', fontSize: '0.86rem' }}>{fmtDate(customer.createdAt)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#9A3412' }}>{list.length}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '12px 24px', fontSize: '0.8rem', color: '#71717A', borderTop: '1px solid #EBE4D8' }}>
        <Users size={13} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
        {rows.length} of {customers.length} customers
      </div>

      {selected && (
        <div className="customer-drawer-overlay" onClick={() => setSelected(null)} role="presentation">
          <aside
            className="customer-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.name} details`}
            onClick={(e) => e.stopPropagation()}
            data-lenis-prevent
          >
            <div className="customer-drawer-head">
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800, color: '#18181B' }}>{selected.name}</h3>
                <span className={`auth-pill ${selected.isGuest ? 'guest' : selected.authProvider === 'google' ? 'google' : 'email'}`}>
                  {selected.isGuest ? 'Guest (no account)' : selected.authProvider === 'google' ? 'Google sign-in' : 'Email & password'}
                </span>
              </div>
              <button type="button" className="cancel-modal-x" onClick={() => setSelected(null)} aria-label="Close details">
                <X size={18} />
              </button>
            </div>

            <div className="customer-drawer-body">
              <section>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#71717A' }}>Profile Summary</h4>
                <div className="customer-profile-grid">
                  <div className="customer-profile-item"><span><Mail size={11} /> Email</span><strong>{selected.email}</strong></div>
                  <div className="customer-profile-item"><span><Phone size={11} /> Mobile</span><strong>{selected.phone || '—'}</strong></div>
                  <div className="customer-profile-item"><span><Calendar size={11} /> Date Joined</span><strong>{fmtDate(selected.createdAt)}</strong></div>
                  <div className="customer-profile-item"><span><ShieldCheck size={11} /> Terms Accepted</span><strong>{selected.termsAcceptedAt ? fmtDate(selected.termsAcceptedAt) : 'Not yet'}</strong></div>
                  <div className="customer-profile-item"><span>Booked Value</span><strong>{formatMoney(selectedTotals.bookedValue)}</strong></div>
                  <div className="customer-profile-item"><span>Paid / Submitted</span><strong>{formatMoney(selectedTotals.paid)}</strong></div>
                  <div className="customer-profile-item"><span>Refunds</span><strong>{formatMoney(selectedTotals.refunds)}</strong></div>
                  <div className="customer-profile-item"><span>Total Bookings</span><strong>{selectedBookings.length}</strong></div>
                </div>
              </section>

              <section>
                <h4 style={{ margin: '0 0 10px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#71717A' }}>Transaction &amp; Booking History</h4>
                {selectedBookings.length === 0 ? (
                  <p style={{ color: '#94A3B8', fontSize: '0.88rem', margin: 0 }}>This customer has no bookings yet.</p>
                ) : (
                  <div className="table-responsive" style={{ border: '1px solid #EBE4D8', borderRadius: '12px' }}>
                    <table className="admin-table" style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>Booked On</th>
                          <th>Event</th>
                          <th>Term</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBookings.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{fmtDate(b.createdAt)}</div>
                              <div style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>#{b.id.slice(0, 12)}…</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{b.eventType}</div>
                              <div style={{ fontSize: '0.75rem', color: '#71717A' }}>{b.eventDate} · {b.guestCount} pax</div>
                            </td>
                            <td style={{ fontSize: '0.75rem' }}>{PAYMENT_TERM_LABELS[getPaymentTerm(b)]}</td>
                            <td style={{ fontWeight: 700, color: '#9A3412' }}>{formatMoney(b.totalPrice, b.currency)}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{formatMoney(getAmountPaid(b), b.currency)}</div>
                              <div style={{ fontSize: '0.72rem', color: '#71717A' }}>{getPaymentStatusLabel(b)}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: '0.76rem' }}>{getBookingStatusLabel(b)}</div>
                              {b.cancellationReason && (
                                <div style={{ fontSize: '0.7rem', color: '#71717A' }}>Reason: {b.cancellationReason}</div>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-action-view"
                                onClick={() => {
                                  setSelected(null)
                                  onOpenBooking(b)
                                }}
                              >
                                <Eye size={12} /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
