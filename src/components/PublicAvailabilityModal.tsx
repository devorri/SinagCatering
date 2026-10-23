import React, { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { useApp } from '../context/AppContext'

interface PublicAvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDateToBook: (dateStr: string) => void
}

export const PublicAvailabilityModal: React.FC<PublicAvailabilityModalProps> = ({
  isOpen,
  onClose,
  onSelectDateToBook,
}) => {
  const { blockedDates, bookings } = useApp()

  // 14-day advance booking calculation rule
  const minBookingDate = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 14)
    return d
  }, [])

  const formatToDateStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const [currentYear, setCurrentYear] = useState(() => minBookingDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => minBookingDate.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
    const days: Array<{ day: number | null; dateStr: string }> = Array.from(
      { length: firstDayIndex },
      () => ({ day: null, dateStr: '' }),
    )

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(currentYear, currentMonth, day)
      days.push({ day, dateStr: formatToDateStr(d) })
    }
    return days
  }, [currentYear, currentMonth])

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((prev) => prev + 1)
    } else {
      setCurrentMonth((prev) => prev + 1)
    }
  }

  const prevMonth = () => {
    const now = new Date()
    // Don't allow scrolling past the current month/year
    if (currentYear === now.getFullYear() && currentMonth <= now.getMonth()) {
      return
    }
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((prev) => prev - 1)
    } else {
      setCurrentMonth((prev) => prev - 1)
    }
  }

  const getDateStatus = (dateStr: string) => {
    if (!dateStr) return { status: 'empty', label: '' }
    const dateObj = new Date(`${dateStr}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (dateObj < today) {
      return { status: 'past', label: 'Past Date', canBook: false }
    }
    if (dateObj < minBookingDate) {
      return { status: 'too_soon', label: 'Requires 14-day advance', canBook: false }
    }
    if (blockedDates.includes(dateStr)) {
      return { status: 'blocked', label: 'Blocked / Holiday', canBook: false }
    }
    const hasBooking = bookings.some(
      (b) => b.eventDate === dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit',
    )
    if (hasBooking) {
      return { status: 'reserved', label: 'Reserved / Booked', canBook: false }
    }
    return { status: 'available', label: 'Available for Booking', canBook: true }
  }

  if (!isOpen) return null

  const selectedStatus = selectedDate ? getDateStatus(selectedDate) : null

  return (
    <div
      className="modal-overlay"
      style={{
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        position: 'fixed',
        inset: 0,
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '18px',
          padding: '28px',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.22)',
          maxHeight: '92vh',
          overflowY: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ background: '#ECFDF5', color: '#059669', padding: '3px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} /> Live System Availability
              </span>
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: 0, color: 'var(--ink)' }}>
              Check Date Availability
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--muted)', margin: '4px 0 0' }}>
              Real-time reservation calendar synced directly with Sinag Catering bookings database.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--ink)',
            }}
            title="Close Calendar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            padding: '12px 16px',
            background: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065F46' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
            <span>Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991B1B' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
            <span>Reserved / Booked</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#B45309' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
            <span>&lt;14 Days Prep</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94A3B8' }} />
            <span>Blocked / Holiday</span>
          </div>
        </div>

        {/* Month Selector */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            padding: '8px 12px',
            background: '#FFFFFF',
            border: '1px solid var(--line)',
            borderRadius: '10px',
          }}
        >
          <button
            type="button"
            onClick={prevMonth}
            style={{
              background: '#F8FAFC',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--ink)' }}>
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            style={{
              background: '#F8FAFC',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', background: '#FFFFFF' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              textAlign: 'center',
              padding: '10px 0',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#F1F5F9' }}>
            {calendarDays.map((item, index) => {
              if (!item.day) {
                return (
                  <div
                    key={`empty-${index}`}
                    style={{ background: '#FAFAFA', minHeight: '62px' }}
                  />
                )
              }

              const { status, canBook } = getDateStatus(item.dateStr)
              const isSelected = selectedDate === item.dateStr

              let bg = '#FFFFFF'
              let textColor = 'var(--ink)'
              let badgeColor = '#059669'
              let badgeText = ''

              if (status === 'past') {
                bg = '#F9FAFB'
                textColor = '#D1D5DB'
              } else if (status === 'too_soon') {
                bg = '#FFFBEB'
                textColor = '#B45309'
                badgeText = '14d prep'
                badgeColor = '#D97706'
              } else if (status === 'blocked') {
                bg = '#F1F5F9'
                textColor = '#94A3B8'
                badgeText = 'Blocked'
                badgeColor = '#64748B'
              } else if (status === 'reserved') {
                bg = '#FEF2F2'
                textColor = '#991B1B'
                badgeText = 'Reserved'
                badgeColor = '#DC2626'
              } else if (status === 'available') {
                bg = '#F0FDF4'
                textColor = '#065F46'
                badgeText = 'Open'
                badgeColor = '#059669'
              }

              if (isSelected) {
                bg = '#DCFCE7'
              }

              return (
                <div
                  key={item.dateStr}
                  onClick={() => {
                    if (canBook) {
                      setSelectedDate(item.dateStr)
                    }
                  }}
                  style={{
                    background: bg,
                    minHeight: '62px',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: canBook ? 'pointer' : 'not-allowed',
                    border: isSelected ? '2px solid #059669' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title={canBook ? `Click to select ${item.dateStr} for booking` : status}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: isSelected || canBook ? 800 : 500, color: textColor }}>
                      {item.day}
                    </span>
                    {canBook && (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                    )}
                  </div>
                  {badgeText && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: badgeColor,
                        lineHeight: 1.1,
                        marginTop: '2px',
                      }}
                    >
                      {badgeText}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Date Action Panel */}
        {selectedDate && selectedStatus?.canBook && (
          <div
            style={{
              marginTop: '18px',
              padding: '16px 20px',
              background: '#ECFDF5',
              border: '1.5px solid #A7F3D0',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065F46', fontWeight: 800, fontSize: '0.94rem' }}>
                <CheckCircle2 size={18} style={{ color: '#059669' }} />
                <span>Selected Date: {selectedDate}</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#047857', marginTop: '2px', display: 'block' }}>
                This date is verified open and ready to book.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelectDateToBook(selectedDate)}
              className="btn-hero-primary"
              style={{ padding: '10px 22px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Book This Date <ArrowRight size={15} />
            </button>
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--muted)' }}>
          <span>Advance rule: Minimum 14 days lead time required.</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
