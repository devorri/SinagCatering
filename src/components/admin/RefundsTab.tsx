import React, { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, RotateCcw, Search, X } from 'lucide-react'
import type { Booking } from '../../types'
import { formatMoney } from '../../data/packages'
import { computeRefundQuote, getAmountPaid, getVerifiedAmountPaid } from '../../lib/bookingRules'

interface RefundsTabProps {
  bookings: Booking[]
  onMarkProcessed: (booking: Booking) => void
  onOpenBooking: (booking: Booking) => void
}

type RefundFilter = 'pending' | 'processed' | 'not_applicable' | 'all'

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

/** "Cancellations & Refunds" admin tab — every client cancellation with its manual refund request. */
export const RefundsTab: React.FC<RefundsTabProps> = ({ bookings, onMarkProcessed, onOpenBooking }) => {
  const [filter, setFilter] = useState<RefundFilter>('pending')
  const [query, setQuery] = useState('')

  const cancelled = useMemo(
    () =>
      bookings
        .filter((b) => b.bookingStatus === 'cancelled')
        .map((b) => {
          // Older cancellations (before revision 6) have no stored refund data — derive it
          const derived = computeRefundQuote(b, b.cancelledAt ? new Date(b.cancelledAt) : new Date(b.createdAt))
          const paid = getAmountPaid(b)
          const unverified = Math.max(0, paid - getVerifiedAmountPaid(b))
          // Never show (or pay out) more than the client actually paid
          const refundAmount = Math.min(paid, Math.max(0, b.refundAmount ?? derived.refundAmount))
          const refundPercentage = b.refundPercentage ?? derived.refundPercentage
          const status: Exclude<RefundFilter, 'all'> =
            b.refundStatus === 'pending' || b.refundStatus === 'processed'
              ? b.refundStatus
              : 'not_applicable'
          return { b, paid, unverified, refundAmount, refundPercentage, status }
        })
        .sort((x, y) => new Date(y.b.cancelledAt || y.b.createdAt).getTime() - new Date(x.b.cancelledAt || x.b.createdAt).getTime()),
    [bookings],
  )

  const counts = useMemo(() => ({
    pending: cancelled.filter((r) => r.status === 'pending').length,
    processed: cancelled.filter((r) => r.status === 'processed').length,
    not_applicable: cancelled.filter((r) => r.status === 'not_applicable').length,
    all: cancelled.length,
  }), [cancelled])

  const pendingTotal = cancelled.filter((r) => r.status === 'pending').reduce((s, r) => s + r.refundAmount, 0)

  const rows = cancelled.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return r.b.customerName.toLowerCase().includes(q) || r.b.email.toLowerCase().includes(q) || r.b.id.toLowerCase().includes(q)
  })

  return (
    <div className="admin-tab-card">
      <div className="admin-tab-card-head">
        <div>
          <h3>Cancellations &amp; Refunds</h3>
          <p>
            Client cancellation requests with reason, refund tier and requested manual payout.
            Gross Revenue is only reduced once a refund is marked as refunded.
            {counts.pending > 0 && (
              <> Pending payouts: <strong style={{ color: '#B45309' }}>{formatMoney(pendingTotal)}</strong></>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="admin-filter-bar">
            {(['pending', 'processed', 'not_applicable', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`admin-filter-pill ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'not_applicable' ? 'NO REFUND' : f.toUpperCase()} ({counts[f]})
              </button>
            ))}
          </div>
          <div className="admin-register-search">
            <Search size={14} style={{ color: '#A1A1AA' }} />
            <input type="text" placeholder="Search client or ref…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference / Client</th>
              <th>Event</th>
              <th>Cancelled</th>
              <th>Reason</th>
              <th>Paid</th>
              <th>Refund Tier</th>
              <th>Refund Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <RotateCcw size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  No cancellations in this view.
                </td>
              </tr>
            ) : (
              rows.map(({ b, paid, unverified, refundAmount, refundPercentage, status }) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#18181B' }}>{b.customerName}</div>
                    <div style={{ fontSize: '0.74rem', color: '#71717A' }}>#{b.id.slice(0, 14)}…</div>
                    <div style={{ fontSize: '0.74rem', color: '#71717A' }}>{b.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.eventType}</div>
                    <div style={{ fontSize: '0.78rem', color: '#71717A' }}>{b.eventDate}</div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#52525B' }}>{fmtDateTime(b.cancelledAt)}</td>
                  <td style={{ maxWidth: '220px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{b.cancellationReason || '—'}</div>
                    {b.cancellationNotes && <div style={{ fontSize: '0.74rem', color: '#71717A', marginTop: '2px' }}>“{b.cancellationNotes}”</div>}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {formatMoney(paid, b.currency)}
                    {unverified > 0 && (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#B45309', fontWeight: 700, marginTop: '3px' }}
                        title="The client's receipt was never verified. Confirm the money was received before paying out."
                      >
                        <AlertTriangle size={11} /> {formatMoney(unverified, b.currency)} unverified
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', fontWeight: 700 }}>{refundPercentage}%</td>
                  <td style={{ fontWeight: 800, color: '#9A3412' }}>{formatMoney(refundAmount, b.currency)}</td>
                  <td>
                    <span className={`refund-pill ${status}`}>
                      {status === 'pending' ? 'Refund Pending' : status === 'processed' ? 'Refunded' : 'No Refund'}
                    </span>
                    {status === 'processed' && b.refundProcessedAt && (
                      <div style={{ fontSize: '0.7rem', color: '#71717A', marginTop: '3px' }}>{fmtDateTime(b.refundProcessedAt)}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button type="button" className="btn-action-view" onClick={() => onOpenBooking(b)}>
                        <Eye size={12} /> View
                      </button>
                      {status === 'pending' && (
                        <button type="button" className="btn-action-approve" onClick={() => onMarkProcessed(b)}>
                          <CheckCircle2 size={12} /> Mark Refunded
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
