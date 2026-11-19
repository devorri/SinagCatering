import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Clock, FastForward, RotateCcw, BellRing, TimerOff, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getSimulatedNowMs, isReserveHold } from '../lib/bookingRules'

const toLocalInputString = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const DemoTimeMachineBar: React.FC = () => {
  const {
    bookings,
    simulatedNow,
    setSimulatedNow,
    runSimulateHoldExpiryCheck,
    runSimulate7DayReminders,
  } = useApp()

  const [isOpen, setIsOpen] = useState(false)
  const [dateTimeInput, setDateTimeInput] = useState(() => toLocalInputString(getSimulatedNowMs()))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'expiry' | 'reminder' | null>(null)

  useEffect(() => {
    setDateTimeInput(toLocalInputString(simulatedNow ?? Date.now()))
  }, [simulatedNow])

  if (typeof document === 'undefined') return null

  const showNotice = (msg: string) => {
    setFeedback(msg)
    window.setTimeout(() => setFeedback((prev) => (prev === msg ? null : prev)), 6500)
  }

  const handleApplyInput = () => {
    if (!dateTimeInput) return
    const parsed = new Date(dateTimeInput).getTime()
    if (Number.isNaN(parsed)) return
    setSimulatedNow(parsed)
    showNotice(`Simulated clock set to ${new Date(parsed).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}.`)
  }

  const handleShiftHours = (hours: number) => {
    const base = simulatedNow ?? Date.now()
    const next = base + hours * 60 * 60 * 1000
    setSimulatedNow(next)
    showNotice(`Advanced simulated clock by +${hours}h → ${new Date(next).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}.`)
  }

  const handleJump7DaysBeforeNextEvent = () => {
    const active = bookings
      .filter((b) => b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit' && b.bookingStatus !== 'completed' && !isReserveHold(b))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    if (active.length === 0) {
      showNotice('No active upcoming booking found to jump to.')
      return
    }
    const target = active[0]
    const eventMs = new Date(`${target.eventDate}T09:00:00`).getTime()
    const sevenDaysBefore = eventMs - 7 * 24 * 60 * 60 * 1000
    setSimulatedNow(sevenDaysBefore)
    showNotice(`Jumped to 7 days before Booking #${target.id} (${target.eventDate}). 1-week reminder triggered!`)
  }

  const handleReset = () => {
    setSimulatedNow(null)
    showNotice('Clock reset to real system time.')
  }

  const handleTriggerHoldExpiry = async () => {
    setBusyAction('expiry')
    try {
      const res = await runSimulateHoldExpiryCheck({ forceExpireActiveHolds: true })
      showNotice(res.message)
    } finally {
      setBusyAction(null)
    }
  }

  const handleTrigger7DayReminders = async () => {
    setBusyAction('reminder')
    try {
      const res = await runSimulate7DayReminders({ forceNextUpcoming: true })
      showNotice(res.message)
    } finally {
      setBusyAction(null)
    }
  }

  const activeHoldsCount = bookings.filter((b) => isReserveHold(b)).length

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '18px',
        left: '18px',
        zIndex: 9990,
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        maxWidth: 'calc(100vw - 36px)',
      }}
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 14px',
            borderRadius: '999px',
            background: simulatedNow ? '#92400E' : '#18181B',
            color: '#FFFFFF',
            border: simulatedNow ? '1.5px solid #F59E0B' : '1px solid rgba(255,255,255,0.16)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.28)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
          title="Open Panel Defense Demo Time Machine & Automation Triggers"
        >
          <Clock size={14} style={{ color: '#FBBF24' }} />
          <span>Demo Time Machine</span>
          {simulatedNow && (
            <span
              style={{
                background: '#FEF3C7',
                color: '#92400E',
                padding: '1px 7px',
                borderRadius: '999px',
                fontSize: '0.68rem',
                fontWeight: 800,
              }}
            >
              {new Date(simulatedNow).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          <ChevronUp size={13} />
        </button>
      ) : (
        <div
          style={{
            width: '440px',
            maxWidth: '100%',
            background: '#18181B',
            color: '#F8FAFC',
            borderRadius: '14px',
            border: simulatedNow ? '1.5px solid #F59E0B' : '1px solid #3F3F46',
            boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
            padding: '16px',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: '#FBBF24' }} />
              <strong style={{ fontSize: '0.88rem', letterSpacing: '0.02em' }}>Demo Time Machine &amp; Cron Triggers</strong>
              {simulatedNow ? (
                <span style={{ background: '#F59E0B', color: '#18181B', fontSize: '0.66rem', fontWeight: 800, padding: '2px 7px', borderRadius: '999px' }}>
                  SIMULATED
                </span>
              ) : (
                <span style={{ background: '#27272A', color: '#A1A1AA', fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>
                  REAL TIME
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#A1A1AA', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              title="Minimize toolbar"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Approach A: Time Travel Date/Time Picker */}
          <div style={{ background: '#27272A', padding: '10px 12px', borderRadius: '10px', marginBottom: '10px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D4D4D8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Approach A · Shift App Perspective (Date / Time)
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
              <input
                type="datetime-local"
                value={dateTimeInput}
                onChange={(e) => setDateTimeInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#18181B',
                  color: '#FFFFFF',
                  border: '1px solid #52525B',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  fontSize: '0.78rem',
                }}
              />
              <button
                type="button"
                onClick={handleApplyInput}
                style={{
                  background: '#F59E0B',
                  color: '#18181B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontWeight: 800,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
              {simulatedNow && (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset to Real Time"
                  style={{
                    background: '#3F3F46',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    fontWeight: 700,
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleShiftHours(24)}
                style={{ background: '#3F3F46', color: '#E4E4E7', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <FastForward size={11} /> +24h
              </button>
              <button
                type="button"
                onClick={() => handleShiftHours(49)}
                style={{ background: '#3F3F46', color: '#FCD34D', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <FastForward size={11} /> +48h (Expire Holds)
              </button>
              <button
                type="button"
                onClick={handleJump7DaysBeforeNextEvent}
                style={{ background: '#3F3F46', color: '#93C5FD', border: 'none', borderRadius: '5px', padding: '4px 8px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <FastForward size={11} /> Jump to 7d Before Next Event
              </button>
            </div>
          </div>

          {/* Approach B: Direct Backend/Cron Simulation Triggers */}
          <div style={{ background: '#27272A', padding: '10px 12px', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#D4D4D8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Approach B · Instant Automated Job Triggers
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                disabled={busyAction === 'expiry'}
                onClick={handleTriggerHoldExpiry}
                style={{
                  width: '100%',
                  background: '#7C2D12',
                  color: '#FFEDD5',
                  border: '1px solid #EA580C',
                  borderRadius: '7px',
                  padding: '8px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <TimerOff size={14} />
                  {busyAction === 'expiry' ? 'Running 48-Hour Expiry Check…' : 'Simulate 48-Hour Expiry Check Now'}
                </span>
                <span style={{ fontSize: '0.68rem', background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                  {activeHoldsCount} active hold{activeHoldsCount === 1 ? '' : 's'}
                </span>
              </button>

              <button
                type="button"
                disabled={busyAction === 'reminder'}
                onClick={handleTrigger7DayReminders}
                style={{
                  width: '100%',
                  background: '#1E3A8A',
                  color: '#DBEAFE',
                  border: '1px solid #3B82F6',
                  borderRadius: '7px',
                  padding: '8px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <BellRing size={14} />
                  {busyAction === 'reminder' ? 'Dispatching 7-Day Reminders…' : 'Simulate 7-Day Event Reminder Batch'}
                </span>
                <span style={{ fontSize: '0.68rem', background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                  SMS + Email + Bell
                </span>
              </button>
            </div>
          </div>

          {feedback && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.16)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#A7F3D0',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                lineHeight: 1.4,
              }}
            >
              <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#34D399' }} />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
