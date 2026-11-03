import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, CheckCheck, Clock, CreditCard, CalendarClock, RotateCcw, Info, AlertTriangle, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { ClientNotification } from '../types'
import { formatCountdown, getHoldRemainingMs, isHoldExpired, isReserveHold } from '../lib/bookingRules'

interface ClientNotificationBellProps {
  onOpenBookings: () => void
}

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return ''
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const iconFor = (type: ClientNotification['type']) => {
  switch (type) {
    case 'hold_created':
    case 'hold_expired':
      return <Clock size={15} />
    case 'payment_confirmed':
    case 'payment_submitted':
      return <CreditCard size={15} />
    case 'event_reminder':
      return <CalendarClock size={15} />
    case 'refund_requested':
    case 'refund_processed':
      return <RotateCcw size={15} />
    default:
      return <Info size={15} />
  }
}

export const ClientNotificationBell: React.FC<ClientNotificationBellProps> = ({ onOpenBookings }) => {
  const { currentUser, bookings, clientNotifications, markClientNotificationRead, markAllClientNotificationsRead } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const wrapRef = useRef<HTMLDivElement>(null)

  // Live countdown for hold warnings
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  const activeHolds = useMemo(() => {
    if (!currentUser) return []
    const email = currentUser.email.toLowerCase().trim()
    return bookings.filter(
      (b) => b.email.toLowerCase().trim() === email && isReserveHold(b) && !isHoldExpired(b, now),
    )
  }, [bookings, currentUser, now])

  const unreadCount = clientNotifications.filter((n) => !n.read).length + activeHolds.length

  if (!currentUser || currentUser.role !== 'client') return null

  return (
    <div className="client-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`client-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && <span className="client-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="client-bell-panel" role="dialog" aria-label="Notifications" data-lenis-prevent>
          <div className="client-bell-head">
            <strong>Notifications</strong>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {clientNotifications.some((n) => !n.read) && (
                <button type="button" className="client-bell-link" onClick={markAllClientNotificationsRead}>
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
              <button type="button" className="client-bell-close" onClick={() => setIsOpen(false)} aria-label="Close notifications">
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="client-bell-list">
            {activeHolds.map((b) => {
              const remaining = getHoldRemainingMs(b, now)
              const urgent = remaining < 12 * 60 * 60 * 1000
              return (
                <button
                  key={`hold-${b.id}`}
                  type="button"
                  className={`client-bell-item hold ${urgent ? 'urgent' : ''}`}
                  onClick={() => {
                    setIsOpen(false)
                    onOpenBookings()
                  }}
                >
                  <span className="client-bell-icon"><AlertTriangle size={15} /></span>
                  <span className="client-bell-text">
                    <strong>Temporary hold – {formatCountdown(remaining)} left</strong>
                    <span>
                      Pay the ₱{(b.downpaymentAmount || 2000).toLocaleString()} reservation fee for {b.eventDate} before the hold expires, or the date will be released.
                    </span>
                  </span>
                </button>
              )
            })}

            {clientNotifications.length === 0 && activeHolds.length === 0 ? (
              <div className="client-bell-empty">
                <Bell size={22} />
                <span>You&apos;re all caught up. Booking updates, payment confirmations, reminders and refund updates will appear here.</span>
              </div>
            ) : (
              clientNotifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`client-bell-item ${n.read ? '' : 'unread'} type-${n.type}`}
                  onClick={() => {
                    markClientNotificationRead(n.id)
                    setIsOpen(false)
                    onOpenBookings()
                  }}
                >
                  <span className="client-bell-icon">{iconFor(n.type)}</span>
                  <span className="client-bell-text">
                    <strong>{n.title}</strong>
                    <span>{n.message}</span>
                    <em>{relativeTime(n.timestamp)}</em>
                  </span>
                  {!n.read && <span className="client-bell-dot" aria-label="Unread" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
