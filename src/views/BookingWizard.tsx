import React, { useState, useMemo, useEffect } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  WandSparkles,
  CreditCard,
  Info,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  EXCESS_PAX_RATE,
  EXTRA_DESSERT_RATE,
  EXTRA_MAIN_RATE,
  EXTRA_PASTA_RATE,
  FOOD_BUFFER_PAX,
  SINAG_PACKAGES,
  findTierForGuestCount,
  recommendPackage,
} from '../data/packages'

interface BookingWizardProps {
  onComplete: () => void
  onBack: () => void
  initialPkgId?: string
  initialGuestCount?: number
}

const STEP_LABELS = ['Select Package', 'Customize', 'Pick Date', 'Your Details', 'Review & Submit']

export const BookingWizard: React.FC<BookingWizardProps> = ({ onComplete, onBack, initialPkgId, initialGuestCount }) => {
  const { blockedDates, bookings, createBooking, currentUser, login } = useApp()

  const [currentStep, setCurrentStep] = useState(0)

  // Step 1 — Package selection
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(() => {
    if (initialPkgId) {
      const idx = SINAG_PACKAGES.findIndex((p) => p.id === initialPkgId)
      if (idx !== -1) return idx
    }
    return 1
  })

  // Step 2 — Customization
  const [guestCount, setGuestCount] = useState(initialGuestCount || 70)
  const [extraMain, setExtraMain] = useState(0)
  const [extraPasta, setExtraPasta] = useState(0)
  const [extraDessert, setExtraDessert] = useState(0)
  const [recommendationBudget, setRecommendationBudget] = useState(60000)
  const [needsEntertainment, setNeedsEntertainment] = useState(true)
  const [aiAppliedBanner, setAiAppliedBanner] = useState(!!initialPkgId || !!initialGuestCount)

  useEffect(() => {
    if (initialPkgId) {
      const idx = SINAG_PACKAGES.findIndex((p) => p.id === initialPkgId)
      if (idx !== -1) setSelectedPkgIndex(idx)
    }
    if (initialGuestCount) {
      setGuestCount(initialGuestCount)
    }
    if (initialPkgId || initialGuestCount) {
      setAiAppliedBanner(true)
    }
  }, [initialPkgId, initialGuestCount])

  // Step 3 — Calendar
  const [eventDate, setEventDate] = useState('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // Step 4 — Client details
  const [clientName, setClientName] = useState(currentUser?.name || '')
  const [clientEmail, setClientEmail] = useState(currentUser?.email || '')
  const [clientPhone, setClientPhone] = useState('')
  const [eventType, setEventType] = useState('Kids Birthday')
  const [notes, setNotes] = useState('')

  // Messages
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentPkg = SINAG_PACKAGES[selectedPkgIndex]

  const calculations = useMemo(() => {
    const tier = findTierForGuestCount(currentPkg, guestCount)
    const baseCost = tier.price
    const servicePax = tier.pax + FOOD_BUFFER_PAX
    const excessGuests = Math.max(0, guestCount - servicePax)
    const excessPaxFee = excessGuests * EXCESS_PAX_RATE
    const addOnCost = ((extraMain * EXTRA_MAIN_RATE) + (extraPasta * EXTRA_PASTA_RATE) + (extraDessert * EXTRA_DESSERT_RATE)) * guestCount
    const totalPrice = baseCost + excessPaxFee + addOnCost

    return {
      tier,
      baseCost,
      servicePax,
      excessGuests,
      excessPaxFee,
      addOnCost,
      totalPrice,
      downpayment: totalPrice * 0.5,
    }
  }, [currentPkg, guestCount, extraMain, extraPasta, extraDessert])

  const aiRecommendation = useMemo(() => {
    return recommendPackage(guestCount, recommendationBudget, needsEntertainment)
  }, [guestCount, recommendationBudget, needsEntertainment])

  const addonControls = [
    { label: 'Extra Main Dish', rate: EXTRA_MAIN_RATE, value: extraMain, setter: setExtraMain },
    { label: 'Extra Pasta Dish', rate: EXTRA_PASTA_RATE, value: extraPasta, setter: setExtraPasta },
    { label: 'Extra Dessert', rate: EXTRA_DESSERT_RATE, value: extraDessert, setter: setExtraDessert },
  ]

  // Calendar logic
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
    const days = Array.from({ length: firstDayIndex }, () => ({ day: null as number | null, dateStr: '' }))
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ day, dateStr })
    }
    return days
  }, [currentYear, currentMonth])

  // Get booking count for a specific date
  const getBookingCountForDate = (dateStr: string) => {
    return bookings.filter(b => b.eventDate === dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit').length
  }

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const changeMonth = (dir: number) => {
    let m = currentMonth + dir
    let y = currentYear
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setCurrentMonth(m)
    setCurrentYear(y)
  }

  const handleDateSelect = (dateStr: string) => {
    const isBlocked = blockedDates.includes(dateStr)
    const isBooked = bookings.some((b) => b.eventDate === dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit')
    const bookingCount = getBookingCountForDate(dateStr)
    
    if (isBlocked || isBooked) {
      setErrorMsg(`This date is unavailable. ${bookingCount > 0 ? `(${bookingCount} booking${bookingCount > 1 ? 's' : ''} already scheduled)` : ''}`)
      return
    }
    setErrorMsg('')
    setEventDate(dateStr)
  }

  // Navigation
  const canGoNext = () => {
    if (currentStep === 2 && !eventDate) return false
    if (currentStep === 3) {
      if (!currentUser && (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim())) return false
      if (currentUser && !clientPhone.trim()) return false
    }
    return true
  }

  const goNext = () => {
    setErrorMsg('')
    if (currentStep === 2 && !eventDate) {
      setErrorMsg('Please select an event date from the calendar.')
      return
    }
    if (currentStep === 3) {
      if (!currentUser && (!clientName.trim() || !clientEmail.trim())) {
        setErrorMsg('Please fill in your contact details.')
        return
      }
      if (!clientPhone.trim()) {
        setErrorMsg('Please enter your mobile number.')
        return
      }
    }
    if (currentStep < STEP_LABELS.length - 1) {
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goBack = () => {
    setErrorMsg('')
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      onBack()
    }
  }

  const handleSubmit = () => {
    setErrorMsg('')
    setIsSubmitting(true)
    
    let clientUser = currentUser
    if (!clientUser) {
      if (!clientName || !clientEmail || !clientPhone) {
        setErrorMsg('Missing contact details.')
        setIsSubmitting(false)
        return
      }
      clientUser = login(clientEmail, clientName, 'client')
    }

    // Create booking with pending status
    const bookingData = {
      customerName: clientUser.name,
      email: clientUser.email,
      phone: clientPhone || '0928 714 4597',
      eventType,
      eventDate,
      guestCount,
      packageName: currentPkg.name,
      basePrice: calculations.tier.price,
      extraPaxFee: calculations.excessPaxFee,
      addOns: {
        extraMainCount: extraMain,
        extraPastaCount: extraPasta,
        extraDessertCount: extraDessert,
      },
      totalPrice: calculations.totalPrice,
      downpaymentAmount: calculations.downpayment, // Store the required downpayment amount
      bookingStatus: 'pending', // Always starts as pending
      paymentStatus: 'pending', // Always starts as pending
      notes: `Tier: ${calculations.tier.pax} pax + ${FOOD_BUFFER_PAX} pax food buffer. Inclusions: ${currentPkg.inclusions.join(', ')}. Freebies: ${currentPkg.freebies.join(', ')}. Entertainment: ${currentPkg.entertainment.length ? currentPkg.entertainment.join(', ') : 'Not included'}.\n${notes}`,
    }

    createBooking(bookingData)

    setSuccessMsg('🎉 Booking submitted successfully! You will receive a confirmation email once our team reviews your request. Please wait for admin approval and downpayment instructions.')
    setIsSubmitting(false)
    setTimeout(onComplete, 3000) // Give user time to read the success message
  }

  // Check if date has pending bookings
  const hasPendingBookings = (dateStr: string) => {
    return bookings.some(b => b.eventDate === dateStr && b.bookingStatus === 'pending')
  }

  return (
    <div className="wizard-container">
      {/* Progress Bar */}
      <div className="wizard-progress">
        {STEP_LABELS.map((label, idx) => (
          <div
            key={label}
            className={`wizard-step-indicator ${idx < currentStep ? 'completed' : ''} ${idx === currentStep ? 'active' : ''}`}
          >
            <div className="wizard-step-dot">
              {idx < currentStep ? <Check size={14} /> : <span>{idx + 1}</span>}
            </div>
            <span className="wizard-step-label">{label}</span>
          </div>
        ))}
      </div>

      {aiAppliedBanner && (
        <div className="alert-box success" style={{ marginBottom: '28px', background: 'linear-gradient(135deg, #FFFDF0 0%, #FFF3D6 100%)', border: '1px solid var(--gold)' }}>
          <Sparkles size={18} style={{ color: 'var(--gold-dark)' }} />
          <span><strong>✨ AI Auto-Filled Settings!</strong> Recommended package (<strong>{currentPkg.name}</strong>) and guest count (<strong>{guestCount} pax</strong>) have been automatically applied.</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box success" style={{ marginBottom: '28px', background: '#D1FAE5', border: '1px solid #10B981' }}>
          <Check size={18} style={{ color: '#059669' }} />
          <span style={{ color: '#065F46' }}>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-box error" style={{ marginBottom: '28px' }}>
          <AlertCircle size={18} /><span>{errorMsg}</span>
        </div>
      )}

      {/* Info Banner - Explain the booking process */}
      {currentStep < 4 && !successMsg && (
        <div style={{ 
          marginBottom: '28px', 
          padding: '16px 20px', 
          background: 'var(--paper-warm)', 
          border: '1px solid var(--line)', 
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Info size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            <strong>How it works:</strong> Submit your booking request for admin approval. 
            Once approved, you'll be asked to pay a 50% downpayment to confirm your date. 
            Your date is only reserved after downpayment is received.
          </div>
        </div>
      )}

      {/* STEP 1: Select Package */}
      {currentStep === 0 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Choose Your Party Package</h2>
            <p>Select from Sinag's curated kids party packages. Each includes complete food, styling, and crew.</p>
          </div>

          <div className="wizard-packages-grid">
            {SINAG_PACKAGES.map((pkg, idx) => (
              <div
                key={pkg.id}
                className={`wizard-package-card ${selectedPkgIndex === idx ? 'selected' : ''}`}
                onClick={() => setSelectedPkgIndex(idx)}
              >
                {idx === 2 && <div className="wizard-pkg-badge">Most Popular</div>}
                <h3>{pkg.shortName}</h3>
                <p className="wizard-pkg-desc">{pkg.description}</p>

                <div className="wizard-pkg-price">
                  Starting at <strong>PHP {pkg.tiers[0].price.toLocaleString()}</strong>
                  <span> / {pkg.tiers[0].pax} pax</span>
                </div>

                <ul className="wizard-pkg-features">
                  {pkg.inclusions.slice(0, 4).map((inc) => (
                    <li key={inc}><Check size={14} /> {inc}</li>
                  ))}
                  {pkg.inclusions.length > 4 && (
                    <li style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                      +{pkg.inclusions.length - 4} more inclusions
                    </li>
                  )}
                </ul>

                <div className="wizard-pkg-extras">
                  {pkg.freebies.length > 0 && (
                    <span><Sparkles size={12} /> {pkg.freebies.length} freebies</span>
                  )}
                  {pkg.entertainment.length > 0 && (
                    <span><Star size={12} /> {pkg.entertainment.length} entertainment</span>
                  )}
                  {pkg.entertainment.length === 0 && (
                    <span style={{ color: 'var(--muted)' }}>No entertainment included</span>
                  )}
                </div>

                <button
                  type="button"
                  className={`wizard-pkg-select-btn ${selectedPkgIndex === idx ? 'active' : ''}`}
                >
                  {selectedPkgIndex === idx ? '✓ Selected' : 'Select Package'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: Customize & AI */}
      {currentStep === 1 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Customize Your Event</h2>
            <p>Adjust guest count, add extras, and let AI recommend the best fit for your budget.</p>
          </div>

          <div className="wizard-customize-layout">
            <div className="wizard-customize-panel">
              <div className="pkg-header-info" style={{ marginBottom: '28px' }}>
                <div>
                  <h3 className="pkg-title">{currentPkg.name}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{currentPkg.description}</span>
                </div>
                <div className="pkg-rate">
                  PHP {calculations.tier.price.toLocaleString()} <span>/{calculations.tier.pax} pax</span>
                </div>
              </div>

              <div className="ai-recommendation-panel">
                <div className="ai-rec-head">
                  <WandSparkles size={18} />
                  <strong>AI Recommendation</strong>
                </div>
                <p>
                  Recommended: <strong>{aiRecommendation.pkg.shortName}</strong> at PHP {aiRecommendation.estimatedTotal.toLocaleString()}.
                  {aiRecommendation.pkg.id === currentPkg.id ? ' Your selected package matches this event profile.' : ' This may fit the pax, budget, and entertainment needs better.'}
                </p>
                <div className="ai-rec-controls">
                  <label>
                    Budget
                    <input type="number" className="input-field" value={recommendationBudget} min={0} step={1000} onChange={(e) => setRecommendationBudget(Number(e.target.value))} />
                  </label>
                  <label className="toggle-row">
                    <input type="checkbox" checked={needsEntertainment} onChange={(e) => setNeedsEntertainment(e.target.checked)} />
                    Needs entertainment
                  </label>
                </div>
                {aiRecommendation.pkg.id !== currentPkg.id && (
                  <button type="button" className="btn-nav-logout" onClick={() => setSelectedPkgIndex(SINAG_PACKAGES.findIndex((pkg) => pkg.id === aiRecommendation.pkg.id))}>
                    Apply AI Choice
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                  Guest Attendees
                </label>
                <div className="stepper-control">
                  <button type="button" className="stepper-btn" onClick={() => setGuestCount((prev) => Math.max(50, prev - 5))}>
                    <Minus size={16} />
                  </button>
                  <div className="stepper-value">{guestCount}</div>
                  <button type="button" className="stepper-btn" onClick={() => setGuestCount((prev) => prev + 5)}>
                    <Plus size={16} />
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginLeft: '10px' }}>
                    covered by {calculations.tier.pax} pax + {FOOD_BUFFER_PAX} pax buffer
                  </span>
                </div>
              </div>

              <div className="dish-swap-box">
                <h4 className="dish-swap-title">Included Services</h4>
                <div className="included-services-grid">
                  {currentPkg.inclusions.map((item) => (
                    <span key={item}><Check size={14} /> {item}</span>
                  ))}
                </div>
              </div>

              <div className="dish-swap-box">
                <h4 className="dish-swap-title">Freebies & Entertainment</h4>
                <div className="included-services-grid compact">
                  {currentPkg.freebies.map((item) => (
                    <span key={item}><Sparkles size={14} /> {item}</span>
                  ))}
                  {currentPkg.entertainment.map((item) => (
                    <span key={item}><Star size={14} /> {item}</span>
                  ))}
                  {currentPkg.entertainment.length === 0 && (
                    <span><AlertCircle size={14} /> Entertainment can be quoted as an upgrade.</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
                <h4 className="dish-swap-title">Optional Extra Food</h4>
                <div className="addon-grid">
                  {addonControls.map(({ label, rate, value, setter }) => (
                    <div key={label} className="addon-card">
                      <span>{label}</span>
                      <small>+PHP {rate} / pax</small>
                      <div>
                        <button type="button" className="stepper-btn" onClick={() => setter((prev: number) => Math.max(0, prev - 1))}><Minus size={12} /></button>
                        <strong>{value}</strong>
                        <button type="button" className="stepper-btn" onClick={() => setter((prev: number) => prev + 1)}><Plus size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="quote-summary-card">
              <h3 className="quote-title">Estimate Summary</h3>
              <div className="quote-line-item">
                <span>Package Tier ({calculations.tier.pax} pax)</span>
                <span className="font-number">PHP {calculations.baseCost.toLocaleString()}</span>
              </div>
              <div className="quote-line-item">
                <span>Food Buffer</span>
                <span className="font-number">+{FOOD_BUFFER_PAX} pax included</span>
              </div>
              {calculations.excessGuests > 0 && (
                <div className="quote-line-item">
                  <span>Excess Guests ({calculations.excessGuests} pax)</span>
                  <span className="font-number">PHP {calculations.excessPaxFee.toLocaleString()}</span>
                </div>
              )}
              {calculations.addOnCost > 0 && (
                <div className="quote-line-item">
                  <span>Extra Food Add-ons</span>
                  <span className="font-number">PHP {calculations.addOnCost.toLocaleString()}</span>
                </div>
              )}
              <div className="quote-line-item total-row">
                <span>Total Estimated Cost</span>
                <span className="quote-total-price">PHP {calculations.totalPrice.toLocaleString()}</span>
              </div>
              <div className="quote-deposit-info">
                <CreditCard size={20} style={{ color: 'var(--gold)' }} />
                <div>
                  <strong>Required 50% Downpayment:</strong>
                  <div className="font-number" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold-light)' }}>
                    PHP {calculations.downpayment.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
                    Payable only after admin approval
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Pick Date */}
      {currentStep === 2 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Select Event Date</h2>
            <p>Pick an available date. Dates marked with counts show how many bookings are already scheduled.</p>
          </div>

          <div className="calendar-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div className="calendar-header-bar">
              <button type="button" className="stepper-btn" onClick={() => changeMonth(-1)}>&lt;</button>
              <h3 className="calendar-month-title">{monthsList[currentMonth]} {currentYear}</h3>
              <button type="button" className="stepper-btn" onClick={() => changeMonth(1)}>&gt;</button>
            </div>

            <div className="calendar-grid-header">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            <div className="calendar-days-grid">
              {calendarDays.map((item, idx) => {
                if (!item.day) return <div key={`empty-${idx}`} className="calendar-day-cell empty" />
                
                const isBlocked = blockedDates.includes(item.dateStr)
                const isBooked = bookings.some((b) => b.eventDate === item.dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit')
                const bookingCount = getBookingCountForDate(item.dateStr)
                const isSelected = eventDate === item.dateStr
                const hasPending = hasPendingBookings(item.dateStr)
                
                let stateClass = 'available'
                if (isBlocked) stateClass = 'blocked'
                else if (isBooked) stateClass = 'booked'
                else if (hasPending) stateClass = 'pending-booking'

                // Determine if date should be clickable
                const isClickable = !isBlocked && !isBooked

                return (
                  <button 
                    key={item.dateStr} 
                    type="button" 
                    className={`calendar-day-cell ${stateClass} ${isSelected ? 'selected' : ''} ${!isClickable ? 'disabled' : ''}`} 
                    onClick={() => isClickable && handleDateSelect(item.dateStr)}
                    disabled={!isClickable}
                  >
                    <span>{item.day}</span>
                    {bookingCount > 0 && (
                      <span style={{ 
                        fontSize: '0.6rem', 
                        background: '#FEF3C7', 
                        color: '#D97706',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        marginTop: '2px'
                      }}>
                        {bookingCount} booked
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="calendar-legend-bar">
              <div className="legend-item"><span className="legend-dot available" /> Available</div>
              <div className="legend-item"><span className="legend-dot booked" /> Reserved</div>
              <div className="legend-item"><span className="legend-dot blocked" /> Blocked</div>
              <div className="legend-item"><span className="legend-dot pending-booking" /> Pending Request</div>
            </div>

            {eventDate && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--paper-warm)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', textAlign: 'center' }}>
                <Check size={18} style={{ color: '#10B981', marginRight: '8px' }} />
                <strong>Selected:</strong> {eventDate}
                {getBookingCountForDate(eventDate) > 0 && (
                  <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    ({getBookingCountForDate(eventDate)} booking{getBookingCountForDate(eventDate) > 1 ? 's' : ''} already scheduled)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Your Details */}
      {currentStep === 3 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Your Event Details</h2>
            <p>Fill in your contact information and event preferences.</p>
          </div>

          <div className="wizard-details-form" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div className="booking-form-grid">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={currentUser?.name || clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={!!currentUser}
                  required
                  placeholder="Maria Santos"
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  value={currentUser?.email || clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  disabled={!!currentUser}
                  required
                  placeholder="maria@example.com"
                />
              </div>
              <div className="form-group">
                <label>Mobile Number</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="0928 714 4597"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Event Category</label>
                <select className="input-field" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                  <option value="Kids Birthday">Kids Birthday</option>
                  <option value="Baptism">Baptism</option>
                  <option value="Debut">Debut</option>
                  <option value="Family Gathering">Family Gathering</option>
                  <option value="Corporate Party">Corporate Party</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Special Instructions / Venue Address</label>
              <textarea
                className="input-field"
                rows={4}
                placeholder="Venue, theme, color motif, celebrant name, and other requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Booking Process Summary */}
            <div style={{ 
              padding: '20px', 
              background: 'linear-gradient(135deg, #FFFDF0 0%, #FFF3D6 100%)', 
              border: '1px solid var(--gold)',
              borderRadius: 'var(--radius-md)',
              marginTop: '12px'
            }}>
              <h4 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--gold)' }} />
                Booking Process Summary
              </h4>
              <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--muted)' }}>
                <li>Submit your booking request</li>
                <li>Admin reviews and approves your request</li>
                <li>You receive notification with downpayment instructions</li>
                <li>Pay 50% downpayment to confirm your date</li>
                <li>Your date is officially reserved!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Review & Submit */}
      {currentStep === 4 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Review Your Booking</h2>
            <p>Confirm all details below before submitting your reservation request.</p>
          </div>

          <div className="wizard-review-grid">
            <div className="wizard-review-card">
              <h4>Package</h4>
              <p><strong>{currentPkg.name}</strong></p>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{currentPkg.description}</p>
            </div>

            <div className="wizard-review-card">
              <h4>Event</h4>
              <p><strong>{eventType}</strong> — {eventDate}</p>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{guestCount} guests</p>
              {getBookingCountForDate(eventDate) > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#D97706' }}>
                  ⚠️ {getBookingCountForDate(eventDate)} booking{getBookingCountForDate(eventDate) > 1 ? 's' : ''} already scheduled on this date
                </p>
              )}
            </div>

            <div className="wizard-review-card">
              <h4>Client</h4>
              <p><strong>{currentUser?.name || clientName}</strong></p>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                {currentUser?.email || clientEmail} · {clientPhone}
              </p>
            </div>

            <div className="wizard-review-card">
              <h4>Total Cost</h4>
              <p className="font-number" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--terracotta)' }}>
                PHP {calculations.totalPrice.toLocaleString()}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                50% Downpayment: PHP {calculations.downpayment.toLocaleString()}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#8B5CF6' }}>
                ⏳ Payable after admin approval
              </p>
            </div>

            {notes && (
              <div className="wizard-review-card" style={{ gridColumn: '1 / -1' }}>
                <h4>Special Notes</h4>
                <p style={{ fontSize: '0.88rem' }}>{notes}</p>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button
              type="button"
              className="btn-hero-primary"
              style={{ fontSize: '1rem', padding: '16px 40px' }}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>⏳ Submitting...</>
              ) : (
                <>
                  <ShieldCheck size={18} /> Submit Reservation Request
                </>
              )}
            </button>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '12px' }}>
              Your booking will be sent for admin approval. You will receive confirmation via email.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      {!successMsg && (
        <div className="wizard-nav-buttons">
          <button type="button" className="btn-hero-outline" onClick={goBack} disabled={isSubmitting}>
            <ArrowLeft size={16} /> {currentStep === 0 ? 'Back to Home' : 'Previous Step'}
          </button>

          {currentStep < STEP_LABELS.length - 1 && (
            <button
              type="button"
              className="btn-hero-primary"
              onClick={goNext}
              disabled={!canGoNext() || isSubmitting}
            >
              Next Step <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}