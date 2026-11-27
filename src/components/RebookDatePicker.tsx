import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import type { Booking } from '../types'
import { getRebookDateInfo } from '../lib/bookingRules'
import type { RebookDateStatus } from '../lib/bookingRules'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

const STYLE: Record<RebookDateStatus, { bg: string; color: string; tag: string; tagColor: string }> = {
  available: { bg: '#F0FDF4', color: '#065F46', tag: 'Open', tagColor: '#059669' },
  current: { bg: '#EFF6FF', color: '#1D4ED8', tag: 'Current', tagColor: '#2563EB' },
  too_soon: { bg: '#F9FAFB', color: '#D1D5DB', tag: '', tagColor: '#9CA3AF' },
  reserved: { bg: '#FEF2F2', color: '#991B1B', tag: 'Booked', tagColor: '#DC2626' },
  hold: { bg: '#F1F5F9', color: '#94A3B8', tag: 'On hold', tagColor: '#64748B' },
  blocked: { bg: '#F1F5F9', color: '#94A3B8', tag: 'Blocked', tagColor: '#64748B' },
}

interface RebookDatePickerProps {
  booking: Booking
  bookings: Booking[]
  blockedDates: string[]
  /** Earliest selectable date (YYYY-MM-DD). */
  minDate: string
  value: string
  onChange: (dateStr: string) => void
  /** Fired with the first/last day (YYYY-MM-DD) of the visible month whenever it changes. */
  onVisibleMonthChange: (fromDate: string, toDate: string) => void
  loading?: boolean
}

export const RebookDatePicker: React.FC<RebookDatePickerProps> = ({
  booking,
  bookings,
  blockedDates,
  minDate,
  value,
  onChange,
  onVisibleMonthChange,
  loading,
}) => {
  // Open on the month of the earliest allowed date (or the current event date if that's later)
  const initial = booking.eventDate > minDate ? booking.eventDate : minDate
  const [year, setYear] = useState(() => Number(initial.slice(0, 4)))
  const [month, setMonth] = useState(() => Number(initial.slice(5, 7)) - 1)

  const minYear = Number(minDate.slice(0, 4))
  const minMonth = Number(minDate.slice(5, 7)) - 1
  const canGoBack = year > minYear || (year === minYear && month > minMonth)

  useEffect(() => {
    const last = new Date(year, month + 1, 0).getDate()
    onVisibleMonthChange(toDateStr(year, month, 1), toDateStr(year, month, last))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const cells = useMemo(() => {
    const first = new Date(year, month, 1).getDay()
    const count = new Date(year, month + 1, 0).getDate()
    const list: Array<string | null> = Array.from({ length: first }, () => null)
    for (let d = 1; d <= count; d++) list.push(toDateStr(year, month, d))
    return list
  }, [year, month])

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  const navBtn: React.CSSProperties = {
    background: '#F8FAFC',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    width: '34px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ink)',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          style={{ ...navBtn, cursor: canGoBack ? 'pointer' : 'not-allowed', opacity: canGoBack ? 1 : 0.4 }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {MONTHS[month]} {year}
          {loading && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)' }}>
              <RefreshCw size={12} /> Syncing…
            </span>
          )}
        </span>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month" style={{ ...navBtn, cursor: 'pointer' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            textAlign: 'center',
            padding: '8px 0',
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#F1F5F9' }}>
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={`e-${i}`} style={{ background: '#FAFAFA', minHeight: '48px' }} />
            const info = getRebookDateInfo(dateStr, booking, bookings, blockedDates, minDate)
            const look = STYLE[info.status]
            const selected = value === dateStr
            return (
              <button
                key={dateStr}
                type="button"
                disabled={!info.selectable}
                onClick={() => info.selectable && onChange(dateStr)}
                title={`${dateStr} – ${info.label}`}
                aria-label={`${dateStr}, ${info.label}`}
                aria-pressed={selected}
                style={{
                  background: selected ? '#DCFCE7' : look.bg,
                  minHeight: '48px',
                  padding: '4px 5px',
                  border: selected ? '2px solid #059669' : '2px solid transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  cursor: info.selectable ? 'pointer' : 'not-allowed',
                  textDecoration: info.status === 'reserved' || info.status === 'blocked' || info.status === 'hold' ? 'line-through' : 'none',
                  font: 'inherit',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: info.selectable || selected ? 800 : 500, color: look.color }}>
                  {Number(dateStr.slice(8, 10))}
                </span>
                {look.tag && (
                  <span style={{ fontSize: '0.58rem', fontWeight: 700, color: look.tagColor, lineHeight: 1.1, textDecoration: 'none' }}>
                    {look.tag}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)' }}>
        {([
          ['#10B981', 'Available'],
          ['#2563EB', 'Current date'],
          ['#EF4444', 'Booked'],
          ['#94A3B8', 'Blocked / on hold'],
        ] as const).map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} /> {l}
          </span>
        ))}
      </div>
    </div>
  )
}
