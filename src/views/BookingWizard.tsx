import React, { useState, useMemo } from 'react'
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
  QrCode,
  Image as ImageIcon,
  Building,
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
import { CATEGORY_SHOWCASE_GALLERY } from '../data/eventGalleries'
import { AI_CATALOG_ADDONS, formatMoney } from '../data/packages'
import type { AIFormData } from '../lib/ai'
import { supabase } from '../lib/supabase'

interface BookingWizardProps {
  onComplete: () => void
  onBack: () => void
  initialAIFormData?: AIFormData
}

const STEP_LABELS = ['Select Package', 'Customize', 'Pick Date', 'Your Details', 'Review & Submit']

export const BookingWizard: React.FC<BookingWizardProps> = ({
  onComplete,
  onBack,
  initialAIFormData,
}) => {
  const { blockedDates, bookings, createBooking, currentUser } = useApp()

  const [currentStep, setCurrentStep] = useState(0)

  // Step 1 — Package Selection & AI Recommendation Mode
  const [packageSelectMode, setPackageSelectMode] = useState<'standard' | 'ai'>('standard')
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(() => {
    if (initialAIFormData?.package_id) {
      const idx = SINAG_PACKAGES.findIndex((p) => p.id === initialAIFormData.package_id)
      if (idx !== -1) return idx
    }
    return 1
  })

  // Dedicated AI Recommendation Inputs (Step 1 AI Tab)
  const [aiBudget, setAiBudget] = useState(60000)
  const [aiGuestCount, setAiGuestCount] = useState(initialAIFormData?.guest_count || 70)
  const [aiNeedsEntertainment, setAiNeedsEntertainment] = useState(true)
  const [aiAppliedBanner, setAiAppliedBanner] = useState(Boolean(initialAIFormData))

  // Step 2 — Customization (Pure Manual Customization)
  const [guestCount, setGuestCount] = useState(initialAIFormData?.guest_count || 70)
  const [selectedAIAddonIds, setSelectedAIAddonIds] = useState<string[]>(initialAIFormData?.addons ?? [])
  const [extraMain, setExtraMain] = useState(0)
  const [extraPasta, setExtraPasta] = useState(0)
  const [extraDessert, setExtraDessert] = useState(0)

  // Step 3 — Calendar
  const [eventDate, setEventDate] = useState('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  // Step 4 — Client Details & Category Selection
  const [clientName, setClientName] = useState(currentUser?.name || '')
  const [clientEmail, setClientEmail] = useState(currentUser?.email || '')
  const [clientPhone, setClientPhone] = useState(currentUser?.phone || '')
  const [eventType, setEventType] = useState<'Kids Birthday' | 'Debut' | 'Wedding' | 'Others (Please Specify)'>('Kids Birthday')
  const [customEventType, setCustomEventType] = useState('')
  const [selectedGalleryPhotoIndex, setSelectedGalleryPhotoIndex] = useState(0)
  const [notes, setNotes] = useState('')

  // Step 4 — Dedicated Payment Method Section
  const [paymentMethod, setPaymentMethod] = useState<'qrph' | 'gcash' | 'maya' | 'bank_transfer' | 'paymongo'>('qrph')
  const [gcashRefNumber, setGcashRefNumber] = useState('')

  // Messages & Form Status
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentPkg = SINAG_PACKAGES[selectedPkgIndex]

  // Task 3: Precise Math Logic for Package, Buffers, Add-ons & 50% Downpayment
  const calculations = useMemo(() => {
    const tier = findTierForGuestCount(currentPkg, guestCount)
    const isPerHeadPackage = currentPkg.pricePerHead !== undefined
    const baseCost = isPerHeadPackage ? guestCount * (currentPkg.pricePerHead ?? 0) : tier.price
    const servicePax = isPerHeadPackage ? guestCount : tier.pax + FOOD_BUFFER_PAX
    const excessGuests = isPerHeadPackage ? 0 : Math.max(0, guestCount - servicePax)
    const excessPaxFee = excessGuests * EXCESS_PAX_RATE

    const extraMainCost = extraMain * EXTRA_MAIN_RATE * guestCount
    const extraPastaCost = extraPasta * EXTRA_PASTA_RATE * guestCount
    const extraDessertCost = extraDessert * EXTRA_DESSERT_RATE * guestCount
    const flatAddonsCost = AI_CATALOG_ADDONS
      .filter((addon) => selectedAIAddonIds.includes(addon.id))
      .reduce((sum, addon) => sum + addon.price, 0)
    const addOnCost = extraMainCost + extraPastaCost + extraDessertCost + flatAddonsCost

    const totalPrice = baseCost + excessPaxFee + addOnCost
    const downpayment = Math.round(totalPrice * 0.5)

    return {
      tier,
      baseCost,
      servicePax,
      excessGuests,
      excessPaxFee,
      extraMainCost,
      extraPastaCost,
      extraDessertCost,
      flatAddonsCost,
      addOnCost,
      totalPrice,
      downpayment,
    }
  }, [currentPkg, guestCount, extraMain, extraPasta, extraDessert, selectedAIAddonIds])

  // Dedicated AI Recommendation Calculation (For Step 1 AI Tab)
  const aiRecommendation = useMemo(() => {
    return recommendPackage(aiGuestCount, aiBudget, aiNeedsEntertainment)
  }, [aiGuestCount, aiBudget, aiNeedsEntertainment])

  const addonControls = [
    { label: 'Extra Main Dish', rate: EXTRA_MAIN_RATE, value: extraMain, cost: calculations.extraMainCost, setter: setExtraMain },
    { label: 'Extra Pasta Dish', rate: EXTRA_PASTA_RATE, value: extraPasta, cost: calculations.extraPastaCost, setter: setExtraPasta },
    { label: 'Extra Dessert', rate: EXTRA_DESSERT_RATE, value: extraDessert, cost: calculations.extraDessertCost, setter: setExtraDessert },
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

  const getBookingCountForDate = (dateStr: string) => {
    return bookings.filter(
      (b) => b.eventDate === dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit',
    ).length
  }

  const hasPendingBookings = (dateStr: string) => {
    return bookings.some((b) => b.eventDate === dateStr && b.bookingStatus === 'pending')
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
    const isBooked = bookings.some(
      (b) => b.eventDate === dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit',
    )
    const bookingCount = getBookingCountForDate(dateStr)

    if (isBlocked) {
      setErrorMsg(`This date (${dateStr}) is blocked for private catering inventory or management reservation. Please select an available date.`)
      return
    }

    if (isBooked) {
      setErrorMsg(`This date already has ${bookingCount} confirmed event${bookingCount > 1 ? 's' : ''}. Please pick another date.`)
      return
    }

    setErrorMsg('')
    setEventDate(dateStr)
  }

  const handleApplyAiRecommendation = () => {
    const idx = SINAG_PACKAGES.findIndex((pkg) => pkg.id === aiRecommendation.pkg.id)
    if (idx !== -1) {
      setSelectedPkgIndex(idx)
    }
    setGuestCount(aiGuestCount)
    setSelectedAIAddonIds([])
    setAiAppliedBanner(true)
    setPackageSelectMode('standard')
    setErrorMsg('')
  }

  // Navigation validation
  const canGoNext = () => {
    if (currentStep === 2 && !eventDate) return false
    if (currentStep === 3) {
      if (!currentUser && (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim())) return false
      if (currentUser && !clientPhone.trim()) return false
      if (eventType === 'Others (Please Specify)' && !customEventType.trim()) return false
    }
    return true
  }

  const goNext = () => {
    setErrorMsg('')
    if (currentStep === 2 && !eventDate) {
      setErrorMsg('Please select an available event date on the calendar.')
      return
    }
    if (currentStep === 3) {
      if (!currentUser && (!clientName.trim() || !clientEmail.trim())) {
        setErrorMsg('Please enter your full name and email address.')
        return
      }
      if (!clientPhone.trim()) {
        setErrorMsg('Please provide a mobile phone number for SMS booking updates.')
        return
      }
      if (eventType === 'Others (Please Specify)' && !customEventType.trim()) {
        setErrorMsg('Please specify your custom event type.')
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

  const handleSubmit = async () => {
    setErrorMsg('')
    setIsSubmitting(true)

    if (!currentUser && (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim())) {
      setErrorMsg('Missing contact details.')
      setIsSubmitting(false)
      return
    }

    const finalEventType = eventType === 'Others (Please Specify)' && customEventType.trim()
      ? `Other: ${customEventType.trim()}`
      : eventType

    const bookingData = {
      customerName: currentUser?.name || clientName.trim(),
      email: currentUser?.email || clientEmail.trim(),
      phone: clientPhone || '0928 714 4597',
      eventType: finalEventType,
      customEventType: customEventType.trim() || undefined,
      eventDate,
      guestCount,
      packageName: currentPkg.name,
      packageId: currentPkg.id,
      basePrice: calculations.tier.price,
      extraPaxFee: calculations.excessPaxFee,
      currency: currentPkg.currency ?? 'PHP',
      addOns: {
        extraMainCount: extraMain,
        extraPastaCount: extraPasta,
        extraDessertCount: extraDessert,
        selectedAddonIds: selectedAIAddonIds,
      },
      totalPrice: calculations.totalPrice,
      downpaymentAmount: calculations.downpayment,
      paymentMethod,
      gcashRefNumber: gcashRefNumber.trim() || undefined,
      notes: `${currentPkg.pricePerHead !== undefined ? 'Per-head pricing; ' : `Tier: ${calculations.tier.pax} pax + ${FOOD_BUFFER_PAX} pax buffer. `}Extra Main: ${extraMain}, Extra Pasta: ${extraPasta}, Extra Dessert: ${extraDessert}. Flat add-ons: ${selectedAIAddonIds.join(', ') || 'none'}.\nPayment: ${paymentMethod.toUpperCase()}${gcashRefNumber ? ` (Ref: ${gcashRefNumber})` : ' (Pending submission)'}.\n${notes}`,
    }

    if (paymentMethod === 'paymongo') {
      if (!supabase) {
        setErrorMsg('Supabase is not configured for secure PayMongo checkout.')
        setIsSubmitting(false)
        return
      }

      const bookingId = `bk-${crypto.randomUUID()}`
      const { data, error } = await supabase.functions.invoke('create-paymongo-checkout', {
        body: { bookingId, booking: { ...bookingData, userId: currentUser?.id ?? 'guest' } },
      })
      if (error || typeof data?.checkout_url !== 'string') {
        setErrorMsg(data?.error ?? error?.message ?? 'Could not start PayMongo checkout. Please try again.')
        setIsSubmitting(false)
        return
      }

      createBooking({ ...bookingData, totalPrice: Number(data.total_price), downpaymentAmount: Number(data.downpayment_amount) }, bookingId)
      window.location.assign(data.checkout_url)
      return
    }

    createBooking(bookingData)

    setSuccessMsg('🎉 Booking submitted successfully! You will receive an SMS and email notification with your booking reference. Please wait for downpayment verification.')
    setIsSubmitting(false)
    setTimeout(onComplete, 2400)
  }

  // Active showcase photos for selected category (Checklist Item 5)
  const currentShowcasePhotos = CATEGORY_SHOWCASE_GALLERY[eventType] || CATEGORY_SHOWCASE_GALLERY['Kids Birthday']
  const activeShowcasePhoto = currentShowcasePhotos[selectedGalleryPhotoIndex] || currentShowcasePhotos[0]

  return (
    <div className="wizard-container">
      {/* Step Indicators */}
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
        <div className="alert-box success" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #FFFDF0 0%, #FFF3D6 100%)', border: '1px solid var(--gold)' }}>
          <Sparkles size={18} style={{ color: 'var(--gold-dark)', flexShrink: 0 }} />
          <span>
            <strong>✨ AI Package Preset Applied:</strong> Recommended package (<strong>{currentPkg.shortName}</strong>) and <strong>{guestCount} guests</strong> have been configured for your event!
          </span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box success" style={{ marginBottom: '24px', background: '#D1FAE5', border: '1px solid #10B981' }}>
          <Check size={18} style={{ color: '#059669', flexShrink: 0 }} />
          <span style={{ color: '#065F46' }}>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-box error" style={{ marginBottom: '24px' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Select Package & Dedicated AI Tab (Checklist Item 1 & Item 2) */}
      {currentStep === 0 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header" style={{ marginBottom: '20px' }}>
            <h2>Choose Your Celebration Package</h2>
            <p>Select from Sinag's authentic party packages or use our AI Package Match for personalized planning.</p>
          </div>

          {/* Checklist Item 1: Dedicated AI Package Recommendation Tab Selector */}
          <div className="package-mode-switcher-bar" style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', background: 'var(--paper-warm)', padding: '6px', borderRadius: 'var(--radius-full)', border: '1px solid var(--line)', gap: '8px' }}>
              <button
                type="button"
                className={`package-mode-btn ${packageSelectMode === 'standard' ? 'active' : ''}`}
                onClick={() => setPackageSelectMode('standard')}
              >
                Standard Packages Grid
              </button>
              <button
                type="button"
                className={`package-mode-btn ${packageSelectMode === 'ai' ? 'active' : ''}`}
                onClick={() => setPackageSelectMode('ai')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <WandSparkles size={16} /> AI Package Recommendation
              </button>
            </div>
          </div>

          {/* Mode 1: Standard Packages Grid */}
          {packageSelectMode === 'standard' && (
            <div className="wizard-packages-grid">
              {SINAG_PACKAGES.map((pkg, idx) => (
                <div
                  key={pkg.id}
                  className={`wizard-package-card ${selectedPkgIndex === idx ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPkgIndex(idx)
                    setGuestCount(pkg.defaultPax ?? 70)
                    if (pkg.pricePerHead === undefined) setSelectedAIAddonIds([])
                  }}
                >
                  {idx === 2 && <div className="wizard-pkg-badge">Most Popular</div>}
                  <h3>{pkg.shortName}</h3>
                  <p className="wizard-pkg-desc">{pkg.description}</p>

                  <div className="wizard-pkg-price">
                    Starting at <strong>{formatMoney(pkg.pricePerHead !== undefined
                      ? pkg.pricePerHead * (pkg.defaultPax ?? pkg.tiers[0].pax)
                      : pkg.tiers[0].price, pkg.currency)}</strong>
                    <span>{pkg.pricePerHead !== undefined
                      ? ` / ${pkg.defaultPax ?? pkg.tiers[0].pax} pax`
                      : ` / ${pkg.tiers[0].pax} pax (+${FOOD_BUFFER_PAX} buffer)`}</span>
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
          )}

          {/* Mode 2: Dedicated AI Package Recommendation Page / Generator (Checklist Item 1 & Item 2 Task 2) */}
          {packageSelectMode === 'ai' && (
            <div className="ai-dedicated-recommendation-card" style={{ maxWidth: '850px', margin: '0 auto', background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '36px', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--gold-gradient)', display: 'grid', placeItems: 'center', color: 'var(--obsidian)' }}>
                  <WandSparkles size={24} />
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 4px' }}>
                    AI-Guided Package Finder
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
                    Input your celebration budget and attendee count to generate a tailored Sinag catering match.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
                <div className="form-group">
                  <label>Budget (PHP)</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      className="input-field"
                      min={30000}
                      step={5000}
                      value={aiBudget}
                      onChange={(e) => setAiBudget(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {[45000, 60000, 80000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAiBudget(preset)}
                        className={`chip-btn ${aiBudget === preset ? 'active' : ''}`}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        ₱{(preset / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Guest Count (Pax)</label>
                  <div className="stepper-control" style={{ marginTop: '2px' }}>
                    <button type="button" className="stepper-btn" onClick={() => setAiGuestCount((prev) => Math.max(50, prev - 5))}>
                      <Minus size={16} />
                    </button>
                    <div className="stepper-value" style={{ width: '60px', textAlign: 'center', fontWeight: 700 }}>
                      {aiGuestCount}
                    </div>
                    <button type="button" className="stepper-btn" onClick={() => setAiGuestCount((prev) => prev + 5)}>
                      <Plus size={16} />
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '8px' }}>attendees</span>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--paper-warm)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', marginBottom: '32px' }}>
                <label className="toggle-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={aiNeedsEntertainment}
                    onChange={(e) => setAiNeedsEntertainment(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--terracotta)' }}
                  />
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.92rem' }}>Include Full Entertainment & Host</strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      Includes Clown/Host, Magician, Photo booth, Event Photographer, and Lights & Sounds.
                    </span>
                  </div>
                </label>
              </div>

              {/* Recommended Match Outcome */}
              <div style={{ background: 'linear-gradient(135deg, #FFFDF5 0%, #FFF8E6 100%)', border: '2px solid var(--gold)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--terracotta)' }}>
                      Best AI Matched Package
                    </span>
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', margin: '4px 0' }}>
                      {aiRecommendation.pkg.name}
                    </h4>
                    <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: 0 }}>
                      {aiRecommendation.pkg.description}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block' }}>Estimated Total</span>
                    <strong className="font-number" style={{ fontSize: '1.4rem', color: 'var(--terracotta)' }}>
                      PHP {aiRecommendation.estimatedTotal.toLocaleString()}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>
                      50% Downpayment: PHP {Math.round(aiRecommendation.estimatedTotal * 0.5).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--ink-light)', borderTop: '1px solid rgba(245, 196, 0, 0.3)', paddingTop: '14px' }}>
                  <span>✓ <strong>{aiRecommendation.tier.pax} pax base tier</strong></span>
                  <span>✓ <strong>+{FOOD_BUFFER_PAX} pax buffer</strong> (covers {aiRecommendation.tier.pax + FOOD_BUFFER_PAX} pax)</span>
                  <span>✓ <strong>{aiRecommendation.pkg.freebies.length} freebies</strong></span>
                  <span>✓ <strong>{aiRecommendation.pkg.entertainment.length} entertainment</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPackageSelectMode('standard')}
                  className="btn-hero-outline"
                >
                  Browse Standard Grid
                </button>
                <button
                  type="button"
                  onClick={handleApplyAiRecommendation}
                  className="btn-hero-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Sparkles size={16} /> Apply Recommendation & Select Package
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Customize Your Event (Cleaned up, no inline AI box) (Checklist Item 2) */}
      {currentStep === 1 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Customize Your Event</h2>
            <p>Configure guest count, review package inclusions, and add optional gourmet dishes.</p>
          </div>

          <div className="wizard-customize-layout">
            <div className="wizard-customize-panel">
              {/* Selected Package Banner */}
              <div className="pkg-header-info" style={{ marginBottom: '28px' }}>
                <div>
                  <h3 className="pkg-title">{currentPkg.name}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{currentPkg.description}</span>
                </div>
                <div className="pkg-rate">
                  {formatMoney(calculations.baseCost, currentPkg.currency)} <span>/{calculations.tier.pax} pax</span>
                </div>
              </div>

              {/* Guest Count Stepper */}
              <div style={{ marginBottom: '32px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                  Guest Attendees Count
                </label>
                <div className="stepper-control">
                  <button type="button" className="stepper-btn" onClick={() => setGuestCount((prev) => Math.max(currentPkg.pricePerHead ? 1 : 50, prev - 5))}>
                    <Minus size={16} />
                  </button>
                  <div className="stepper-value" style={{ minWidth: '60px', textAlign: 'center', fontWeight: 700 }}>
                    {guestCount}
                  </div>
                  <button type="button" className="stepper-btn" onClick={() => setGuestCount((prev) => prev + 5)}>
                    <Plus size={16} />
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)', marginLeft: '12px' }}>
                    {currentPkg.pricePerHead !== undefined
                      ? `${formatMoney(currentPkg.pricePerHead, currentPkg.currency)} per guest`
                      : `Covered by ${calculations.tier.pax} pax tier + ${FOOD_BUFFER_PAX} pax complimentary buffet buffer`}
                  </span>
                </div>
              </div>

              {/* Inclusions */}
              <div className="dish-swap-box">
                <h4 className="dish-swap-title">Included Buffet & Catering Setup</h4>
                <div className="included-services-grid">
                  {currentPkg.inclusions.map((item) => (
                    <span key={item}><Check size={14} /> {item}</span>
                  ))}
                </div>
              </div>

              {/* Freebies & Entertainment */}
              <div className="dish-swap-box">
                <h4 className="dish-swap-title">Freebies & Coordinated Entertainment</h4>
                <div className="included-services-grid compact">
                  {currentPkg.freebies.map((item) => (
                    <span key={item}><Sparkles size={14} /> {item}</span>
                  ))}
                  {currentPkg.entertainment.map((item) => (
                    <span key={item}><Star size={14} /> {item}</span>
                  ))}
                  {currentPkg.entertainment.length === 0 && (
                    <span><AlertCircle size={14} /> Entertainment can be added by request with our concierge desk.</span>
                  )}
                </div>
              </div>

              {/* Extra Food Add-ons */}
              {currentPkg.pricePerHead !== undefined ? (
                <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
                  <h4 className="dish-swap-title">Optional Add-ons</h4>
                  <div className="addon-grid">
                    {AI_CATALOG_ADDONS.map((addon) => (
                      <label key={addon.id} className="addon-card" style={{ cursor: 'pointer' }}>
                        <span>{addon.name}</span>
                        <small>{formatMoney(addon.price, addon.currency)} flat</small>
                        <input
                          type="checkbox"
                          checked={selectedAIAddonIds.includes(addon.id)}
                          onChange={(event) => setSelectedAIAddonIds((current) =>
                            event.target.checked
                              ? [...new Set([...current, addon.id])]
                              : current.filter((id) => id !== addon.id),
                          )}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
                <h4 className="dish-swap-title">Optional Extra Food Add-ons (Calculated per guest)</h4>
                <div className="addon-grid">
                  {addonControls.map(({ label, rate, value, cost, setter }) => (
                    <div key={label} className="addon-card">
                      <span>{label}</span>
                      <small>+PHP {rate} / pax</small>
                      <div>
                        <button type="button" className="stepper-btn" onClick={() => setter((prev: number) => Math.max(0, prev - 1))}>
                          <Minus size={12} />
                        </button>
                        <strong>{value}</strong>
                        <button type="button" className="stepper-btn" onClick={() => setter((prev: number) => prev + 1)}>
                          <Plus size={12} />
                        </button>
                      </div>
                      {value > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--terracotta)', fontWeight: 700, marginTop: '4px' }}>
                          +PHP {cost.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              )}
            </div>

            {/* Task 3: Estimate Summary Sidebar with Audited Math Logic */}
            <div className="quote-summary-card">
              <h3 className="quote-title">Estimate Summary</h3>
              <div className="quote-line-item">
                <span>Package Base ({calculations.tier.pax} pax)</span>
                <span className="font-number">{formatMoney(calculations.baseCost, currentPkg.currency)}</span>
              </div>
              {currentPkg.pricePerHead === undefined && (
                <div className="quote-line-item">
                  <span>Complimentary Buffer</span>
                  <span className="font-number" style={{ color: 'var(--emerald)' }}>+{FOOD_BUFFER_PAX} pax included</span>
                </div>
              )}

              {calculations.excessGuests > 0 && (
                <div className="quote-line-item">
                  <span>Excess Guests ({calculations.excessGuests} pax × ₱{EXCESS_PAX_RATE})</span>
                  <span className="font-number">{formatMoney(calculations.excessPaxFee, currentPkg.currency)}</span>
                </div>
              )}

              {calculations.extraMainCost > 0 && (
                <div className="quote-line-item">
                  <span>Extra Main ({extraMain} dish × ₱{EXTRA_MAIN_RATE})</span>
                  <span className="font-number">{formatMoney(calculations.extraMainCost, currentPkg.currency)}</span>
                </div>
              )}

              {calculations.extraPastaCost > 0 && (
                <div className="quote-line-item">
                  <span>Extra Pasta ({extraPasta} dish × ₱{EXTRA_PASTA_RATE})</span>
                  <span className="font-number">{formatMoney(calculations.extraPastaCost, currentPkg.currency)}</span>
                </div>
              )}

              {calculations.extraDessertCost > 0 && (
                <div className="quote-line-item">
                  <span>Extra Dessert ({extraDessert} dish × ₱{EXTRA_DESSERT_RATE})</span>
                  <span className="font-number">{formatMoney(calculations.extraDessertCost, currentPkg.currency)}</span>
                </div>
              )}

              {selectedAIAddonIds.map((addonId) => {
                const addon = AI_CATALOG_ADDONS.find((item) => item.id === addonId)
                return addon ? (
                  <div key={addon.id} className="quote-line-item">
                    <span>{addon.name}</span>
                    <span className="font-number">{formatMoney(addon.price, addon.currency)}</span>
                  </div>
                ) : null
              })}

              <div className="quote-line-item total-row">
                <span>Total Estimated Cost</span>
                <span className="quote-total-price">{formatMoney(calculations.totalPrice, currentPkg.currency)}</span>
              </div>

              <div className="quote-deposit-info">
                <CreditCard size={20} style={{ color: 'var(--gold)' }} />
                <div>
                    <strong>Required 50% Downpayment:</strong>
                    <div className="font-number" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gold-light)' }}>
                      {formatMoney(calculations.downpayment, currentPkg.currency)}
                    </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
                      Payable via QR Ph / GCash to lock your event date
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Pick Date (Checklist Item 3: Calendar Date Styling & Alignment for Blocked Dates) */}
      {currentStep === 2 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Select Event Date</h2>
            <p>Pick an available celebration date. Blocked dates and already scheduled dates cannot be selected.</p>
          </div>

          <div className="calendar-card" style={{ maxWidth: '720px', margin: '0 auto' }}>
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

                const isClickable = !isBlocked && !isBooked

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    className={`calendar-day-cell ${stateClass} ${isSelected ? 'selected' : ''} ${!isClickable ? 'disabled' : ''}`}
                    onClick={() => isClickable && handleDateSelect(item.dateStr)}
                    disabled={!isClickable}
                  >
                    <span className="calendar-day-number">{item.day}</span>
                    {isBlocked ? (
                      <span className="calendar-blocked-tag">
                        Blocked
                      </span>
                    ) : bookingCount > 0 ? (
                      <span className="calendar-count-tag">
                        {bookingCount} booked
                      </span>
                    ) : hasPending ? (
                      <span className="calendar-pending-tag">
                        Pending
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            {/* Calendar Legend Bar strictly matching tokens */}
            <div className="calendar-legend-bar">
              <div className="legend-item"><span className="legend-dot available" /> Available</div>
              <div className="legend-item"><span className="legend-dot booked" /> Reserved</div>
              <div className="legend-item"><span className="legend-dot blocked" /> Blocked</div>
              <div className="legend-item"><span className="legend-dot pending-booking" /> Pending Request</div>
            </div>

            {eventDate && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--paper-warm)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', textAlign: 'center' }}>
                <Check size={18} style={{ color: '#10B981', marginRight: '8px', verticalAlign: 'middle' }} />
                <strong>Selected Date:</strong> {eventDate}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 4: Event Details, Category & Dynamic Showcase Gallery, and Payment Integration (Checklist Items 4 & 5) */}
      {currentStep === 3 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Your Details & Event Showcase</h2>
            <p>Standardize event details, view theme setup showcase photos, and review downpayment payment options.</p>
          </div>

          <div className="wizard-details-showcase-layout" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '32px', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Form Column */}
            <div className="wizard-details-form">
              <div className="booking-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
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
                  <label>Mobile Number (For Semaphore SMS)</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="0928 714 4597"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    required
                  />
                </div>

                {/* Checklist Item 5 Task 1: Category Standardization strictly to 4 options */}
                <div className="form-group">
                  <label>Event Category</label>
                  <select
                    className="input-field"
                    value={eventType}
                    onChange={(e) => {
                      setEventType(e.target.value as typeof eventType)
                      setSelectedGalleryPhotoIndex(0)
                    }}
                  >
                    <option value="Kids Birthday">Kids Birthday</option>
                    <option value="Debut">Debut</option>
                    <option value="Wedding">Wedding</option>
                    <option value="Others (Please Specify)">Others (Please Specify)</option>
                  </select>
                </div>
              </div>

              {/* Others (Please Specify) conditional field */}
              {eventType === 'Others (Please Specify)' && (
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Please Specify Your Event Type</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 50th Golden Anniversary, Baptism, Corporate Banquet..."
                    value={customEventType}
                    onChange={(e) => setCustomEventType(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Venue Address & Special Instructions</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Venue location, theme colors, celebrant's name, or dietary preferences..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Checklist Item 4: Dedicated Payment Method Section inside "Your Details" */}
              <div className="payment-method-section" style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <CreditCard size={20} style={{ color: 'var(--terracotta)' }} />
                  <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>
                    Payment Method & Downpayment Instructions
                  </h4>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px' }}>
                  To reserve and lock your celebration date, a required <strong>50% downpayment</strong> ({formatMoney(calculations.downpayment, currentPkg.currency)}) is requested. You can pay via QR Ph / GCash now or upon admin review.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qrph')}
                    className={`payment-option-card ${paymentMethod === 'qrph' || paymentMethod === 'gcash' ? 'active' : ''}`}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: paymentMethod === 'qrph' || paymentMethod === 'gcash' ? '2px solid var(--terracotta)' : '1px solid var(--line)',
                      background: paymentMethod === 'qrph' || paymentMethod === 'gcash' ? 'var(--paper-warm)' : '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <QrCode size={22} style={{ color: 'var(--terracotta)' }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>QR Ph / GCash</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Instant QR code scan</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`payment-option-card ${paymentMethod === 'bank_transfer' ? 'active' : ''}`}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: paymentMethod === 'bank_transfer' ? '2px solid var(--terracotta)' : '1px solid var(--line)',
                      background: paymentMethod === 'bank_transfer' ? 'var(--paper-warm)' : '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Building size={22} style={{ color: 'var(--gold-dark)' }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>Bank Transfer / Maya</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Direct deposit</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paymongo')}
                    className={`payment-option-card ${paymentMethod === 'paymongo' ? 'active' : ''}`}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: paymentMethod === 'paymongo' ? '2px solid var(--terracotta)' : '1px solid var(--line)',
                      background: paymentMethod === 'paymongo' ? 'var(--paper-warm)' : '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <CreditCard size={22} style={{ color: 'var(--terracotta)' }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>PayMongo Checkout</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>GCash, Maya, QR Ph, cards</span>
                    </div>
                  </button>
                </div>

                {/* QR Ph Container Display */}
                {paymentMethod !== 'paymongo' && (
                <div style={{ background: 'var(--paper-warm)', padding: '18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ width: '90px', height: '90px', background: '#FFF', padding: '6px', borderRadius: '8px', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
                      {/* Stylized QR Ph Visual Representation */}
                      <svg viewBox="0 0 100 100" width="76" height="76">
                        <rect width="100" height="100" fill="#FFF" />
                        <rect x="10" y="10" width="24" height="24" fill="#2C1A00" rx="3" />
                        <rect x="15" y="15" width="14" height="14" fill="#FFF" rx="2" />
                        <rect x="19" y="19" width="6" height="6" fill="#2C1A00" />
                        
                        <rect x="66" y="10" width="24" height="24" fill="#2C1A00" rx="3" />
                        <rect x="71" y="15" width="14" height="14" fill="#FFF" rx="2" />
                        <rect x="75" y="19" width="6" height="6" fill="#2C1A00" />

                        <rect x="10" y="66" width="24" height="24" fill="#2C1A00" rx="3" />
                        <rect x="15" y="71" width="14" height="14" fill="#FFF" rx="2" />
                        <rect x="19" y="75" width="6" height="6" fill="#2C1A00" />

                        <rect x="42" y="10" width="16" height="8" fill="#E8820A" />
                        <rect x="42" y="24" width="8" height="16" fill="#2C1A00" />
                        <rect x="56" y="28" width="6" height="14" fill="#E8820A" />
                        <rect x="42" y="46" width="16" height="16" fill="#2C1A00" rx="2" />
                        <rect x="66" y="46" width="24" height="8" fill="#2C1A00" />
                        <rect x="74" y="62" width="16" height="24" fill="#2C1A00" />
                        <rect x="42" y="70" width="18" height="16" fill="#E8820A" />
                      </svg>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--terracotta)' }}>
                        Official QR Ph / GCash Merchant
                      </span>
                      <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--ink)' }}>
                        Sinag's Catering Services (Sunshine C.)
                      </strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '2px' }}>
                        GCash Number: <strong>0928 714 4597</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--ink-light)', marginTop: '4px' }}>
                        Required 50% Downpayment: <strong style={{ color: 'var(--terracotta)' }}>{formatMoney(calculations.downpayment, currentPkg.currency)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {paymentMethod === 'paymongo' && (
                  <p role="note" style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px' }}>
                    Submitting will open PayMongo's secure hosted checkout. Your booking is saved only after the server validates the PHP package total.
                  </p>
                )}

                {/* Reference Number Field */}
                {paymentMethod !== 'paymongo' && (
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label>GCash / QR Ph Reference Number (If Paid)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 902148923019 (Optional upon initial request)"
                    value={gcashRefNumber}
                    onChange={(e) => setGcashRefNumber(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
                    Tip: You can submit your reference number now for faster verification, or provide it later in your Client Portal.
                  </span>
                </div>
                )}
              </div>
            </div>

            {/* Checklist Item 5 Task 2: Dynamic Image Gallery Container */}
            <div className="dynamic-showcase-gallery-container" style={{ background: '#FFFFFF', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '24px', height: 'fit-content', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ImageIcon size={18} style={{ color: 'var(--gold-dark)' }} />
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0 }}>
                    {eventType} Showcase Photos
                  </h3>
                </div>
                <span className="section-tag" style={{ margin: 0, fontSize: '0.7rem' }}>
                  {activeShowcasePhoto.tag}
                </span>
              </div>

              {/* Main Featured Photo */}
              <div style={{ width: '100%', height: '240px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '14px', position: 'relative', background: '#F1F5F9' }}>
                <img
                  src={activeShowcasePhoto.url}
                  alt={activeShowcasePhoto.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'all 0.4s ease' }}
                />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', padding: '16px', color: '#FFF' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 700 }}>
                    {activeShowcasePhoto.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>
                    {activeShowcasePhoto.caption}
                  </p>
                </div>
              </div>

              {/* Thumbnails Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {currentShowcasePhotos.map((photo, pIdx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedGalleryPhotoIndex(pIdx)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: selectedGalleryPhotoIndex === pIdx ? '2px solid var(--gold)' : '1px solid var(--line)',
                      padding: 0,
                      cursor: 'pointer',
                      opacity: selectedGalleryPhotoIndex === pIdx ? 1 : 0.65,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <img src={photo.url} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '20px', padding: '14px', background: 'var(--paper-warm)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '0.82rem', color: 'var(--muted)' }}>
                <ShieldCheck size={16} style={{ color: 'var(--gold)', verticalAlign: 'middle', marginRight: '6px' }} />
                All showcase setups can be fully customized with your child's favorite motif colors and character themes!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Review & Submit */}
      {currentStep === 4 && (
        <div className="wizard-step-content">
          <div className="wizard-step-header">
            <h2>Review Your Reservation</h2>
            <p>Confirm the details of your party package and payment verification before submitting.</p>
          </div>

          <div className="wizard-review-grid">
            <div className="wizard-review-card">
              <h4>Package Selection</h4>
              <p><strong>{currentPkg.name}</strong></p>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{currentPkg.description}</p>
            </div>

            <div className="wizard-review-card">
              <h4>Event Schedule & Category</h4>
              <p>
                <strong>
                  {eventType === 'Others (Please Specify)' && customEventType ? customEventType : eventType}
                </strong>
                {' '}— {eventDate}
              </p>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{guestCount} registered guests</p>
              {getBookingCountForDate(eventDate) > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#D97706' }}>
                  ⚠️ {getBookingCountForDate(eventDate)} booking already scheduled on this date
                </p>
              )}
            </div>

            <div className="wizard-review-card">
              <h4>Client Contact</h4>
              <p><strong>{currentUser?.name || clientName}</strong></p>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                {currentUser?.email || clientEmail} · {clientPhone}
              </p>
            </div>

            <div className="wizard-review-card">
              <h4>Payment & Downpayment</h4>
              <p className="font-number" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--terracotta)' }}>
                {formatMoney(calculations.totalPrice, currentPkg.currency)}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-light)' }}>
                50% Downpayment: <strong>{formatMoney(calculations.downpayment, currentPkg.currency)}</strong>
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px' }}>
                Method: <strong>{paymentMethod.toUpperCase()}</strong>
                {gcashRefNumber ? ` (Ref: ${gcashRefNumber})` : ' (Pending verification)'}
              </p>
            </div>

            {notes && (
              <div className="wizard-review-card" style={{ gridColumn: '1 / -1' }}>
                <h4>Venue & Special Notes</h4>
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
                <>⏳ Submitting Request...</>
              ) : (
                <>
                  <ShieldCheck size={18} /> Submit Reservation Request
                </>
              )}
            </button>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '12px' }}>
              Your reservation will be saved, and confirmation notifications will trigger via SMS and email.
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