import React, { useState, useMemo } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  Minus,
  Plus,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  UploadCloud,
  WandSparkles,
  CreditCard,
  QrCode,
  Image as ImageIcon,
  Building,
  User,
  Utensils,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  EXCESS_PAX_RATE,
  EXTRA_DESSERT_RATE,
  EXTRA_MAIN_RATE,
  EXTRA_PASTA_RATE,
  FOOD_BUFFER_PAX,
  MAIN_DISHES,
  PASTA_DISHES,
  DISH_DETAILS,
  findTierForGuestCount,
  recommendPackage,
} from '../data/packages'
import { CATEGORY_SHOWCASE_GALLERY } from '../data/eventGalleries'
import { AI_CATALOG_ADDONS, formatMoney } from '../data/packages'
import type { AIFormData } from '../lib/ai'

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
  const { blockedDates, bookings, createBooking, currentUser, packages } = useApp()

  const [currentStep, setCurrentStep] = useState(0)
  const [maxVisitedStep, setMaxVisitedStep] = useState(initialAIFormData ? 1 : 0)
  const initialPresetAppliedRef = React.useRef(false)

  // Step 1 — Package Selection & AI Recommendation Mode
  const [packageSelectMode, setPackageSelectMode] = useState<'standard' | 'ai'>('standard')
  const [selectedPkgIndex, setSelectedPkgIndex] = useState(() => {
    if (initialAIFormData?.package_id) {
      const idx = packages.findIndex((p) => p.id === initialAIFormData.package_id)
      if (idx !== -1) return idx
    }
    return 0
  })

  // Dedicated AI Recommendation Inputs (Step 1 AI Tab)
  const [aiBudget, setAiBudget] = useState(60000)
  const [aiGuestCount, setAiGuestCount] = useState(initialAIFormData?.guest_count || 70)
  const [aiAppliedBanner, setAiAppliedBanner] = useState(Boolean(initialAIFormData))

  // Step 2 — Customization (Pure Manual Customization)
  const [guestCount, setGuestCount] = useState(initialAIFormData?.guest_count || 70)
  const [selectedAIAddonIds, setSelectedAIAddonIds] = useState<string[]>(initialAIFormData?.addons ?? [])
  const [extraMain, setExtraMain] = useState(initialAIFormData?.extra_main_count || 0)
  const [extraPasta, setExtraPasta] = useState(initialAIFormData?.extra_pasta_count || 0)
  const [extraDessert, setExtraDessert] = useState(initialAIFormData?.extra_dessert_count || 0)
  const [selectedMainDishes, setSelectedMainDishes] = useState<string[]>([])
  const [selectedPastaDishes, setSelectedPastaDishes] = useState<string[]>([])
  const [extraMainDishes, setExtraMainDishes] = useState<string[]>([])
  const [extraPastaDishes, setExtraPastaDishes] = useState<string[]>([])

  // Step 3 — Calendar (14-Day Advance Booking Rule: initial focus starts on valid date)
  const getMinBookingDate = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 14)
    return d
  }
  const formatToDateStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const [eventDate, setEventDate] = useState(() => formatToDateStr(getMinBookingDate()))
  const [currentYear, setCurrentYear] = useState(() => getMinBookingDate().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => getMinBookingDate().getMonth())

  // Step 4 — Client Details & Category Selection
  const [clientName, setClientName] = useState(currentUser?.name || '')
  const [clientEmail, setClientEmail] = useState(currentUser?.email || '')
  const [clientPhone, setClientPhone] = useState(() => {
    if (currentUser?.phone) {
      return currentUser.phone.replace(/\D/g, '').slice(0, 11)
    }
    return ''
  })
  const [phoneTouched, setPhoneTouched] = useState(false)
  const isPhoneValid = useMemo(() => /^09\d{9}$/.test(clientPhone), [clientPhone])
  const [eventType, setEventType] = useState<'Kids Birthday' | 'Debut' | 'Wedding' | 'Others (Please Specify)'>('Kids Birthday')
  const [customEventType, setCustomEventType] = useState('')
  const [selectedGalleryPhotoIndex, setSelectedGalleryPhotoIndex] = useState(0)
  const [notes, setNotes] = useState(initialAIFormData?.notes || '')

  // Reactively auto-fill and advance wizard whenever an AI recommendation is applied
  React.useEffect(() => {
    if (initialAIFormData && !initialPresetAppliedRef.current) {
      initialPresetAppliedRef.current = true
      if (initialAIFormData.package_id) {
        const idx = packages.findIndex((p) => p.id === initialAIFormData.package_id)
        if (idx !== -1) setSelectedPkgIndex(idx)
      }
      if (initialAIFormData.guest_count) setGuestCount(initialAIFormData.guest_count)
      if (initialAIFormData.addons) setSelectedAIAddonIds(initialAIFormData.addons)
      if (initialAIFormData.extra_main_count !== undefined) setExtraMain(initialAIFormData.extra_main_count)
      if (initialAIFormData.extra_pasta_count !== undefined) setExtraPasta(initialAIFormData.extra_pasta_count)
      if (initialAIFormData.extra_dessert_count !== undefined) setExtraDessert(initialAIFormData.extra_dessert_count)
      if (initialAIFormData.event_type) {
        if (['Kids Birthday', 'Debut', 'Wedding'].includes(initialAIFormData.event_type)) {
          setEventType(initialAIFormData.event_type as any)
        } else {
          setEventType('Others (Please Specify)')
          setCustomEventType(initialAIFormData.event_type)
        }
      }
      if (initialAIFormData.notes) setNotes(initialAIFormData.notes)
      setAiAppliedBanner(true)
      setCurrentStep(1) // Jump straight to Customize step so all fields are visibly populated
      setMaxVisitedStep((prev) => Math.max(prev, 1))
    }
  }, [initialAIFormData, packages])

  // Step 4 — Dedicated Payment Method Section & Proof Upload
  const [paymentMethod, setPaymentMethod] = useState<'qrph' | 'bank_transfer'>('qrph')
  const [gcashRefNumber, setGcashRefNumber] = useState('')
  const [proofOfPaymentUrl, setProofOfPaymentUrl] = useState<string | null>(null)
  const [proofFileName, setProofFileName] = useState('')
  const [proofError, setProofError] = useState('')
  const [copiedAccount, setCopiedAccount] = useState(false)
  const [isDraggingProof, setIsDraggingProof] = useState(false)

  // Step 5 — Temporary Booking Reference ID & Timestamp for Digital Receipt
  const tempBookingRef = useMemo(() => {
    const cleanDate = (eventDate || '2026-10-27').replace(/-/g, '')
    const suffix = String(Math.abs(guestCount * 7 + 101) % 900 + 100).padStart(3, '0')
    return `#BK-${cleanDate}-${suffix}`
  }, [eventDate, guestCount])

  const bookingTimestamp = useMemo(() => {
    const d = new Date()
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  }, [])

  // Messages & Form Status
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentPkg = packages[selectedPkgIndex] ?? packages[0]

  // Task 3: Precise Math Logic for Package, Buffers, Add-ons & 50% Downpayment
  const calculations = useMemo(() => {
    if (!currentPkg) {
      return { tier: { pax: 0, price: 0 }, baseCost: 0, servicePax: 0, excessGuests: 0, excessPaxFee: 0, extraMainCost: 0, extraPastaCost: 0, extraDessertCost: 0, flatAddonsCost: 0, addOnCost: 0, totalPrice: 0, downpayment: 0 }
    }
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
    return recommendPackage(packages, aiGuestCount, aiBudget)
  }, [packages, aiGuestCount, aiBudget])



  const selectedDishCount = selectedMainDishes.length + selectedPastaDishes.length
  const toggleDish = (dish: string, kind: 'main' | 'pasta') => {
    if (kind === 'main') {
      setSelectedMainDishes((current) =>
        current.includes(dish)
          ? current.filter((value) => value !== dish)
          : current.length < 3
          ? [...current, dish]
          : current
      )
    } else {
      setSelectedPastaDishes((current) =>
        current.includes(dish)
          ? current.filter((value) => value !== dish)
          : current.length < 1
          ? [...current, dish]
          : current
      )
    }
  }

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

  const handleCopyAccount = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAccount(true)
    setTimeout(() => setCopiedAccount(false), 2200)
  }

  const handleProofFileChange = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProofError('Please upload an image receipt (PNG, JPG, or WEBP).')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setProofError('Receipt file exceeds 10MB limit. Please upload a smaller image.')
      return
    }
    setProofError('')
    setProofFileName(file.name)
    const reader = new FileReader()
    reader.onloadend = () => {
      setProofOfPaymentUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDateSelect = (dateStr: string) => {
    const minimumDate = new Date()
    minimumDate.setHours(0, 0, 0, 0)
    minimumDate.setDate(minimumDate.getDate() + 14)
    if (new Date(`${dateStr}T00:00:00`) < minimumDate) {
      setErrorMsg('Bookings require at least 14 days advance notice.')
      return
    }
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
    if (aiRecommendation.budgetExceeded) {
      setErrorMsg(`No standard package is available within your ₱${aiBudget.toLocaleString()} budget. Please increase the budget or compare the standard packages.`)
      return
    }
    const idx = packages.findIndex((pkg) => pkg.id === aiRecommendation.pkg.id)
    if (idx !== -1) {
      setSelectedPkgIndex(idx)
    }
    setGuestCount(aiGuestCount)
    setExtraMain(aiRecommendation.suggestedAddons.extraMain)
    setExtraPasta(aiRecommendation.suggestedAddons.extraPasta)
    setExtraDessert(aiRecommendation.suggestedAddons.extraDessert)
    setSelectedAIAddonIds(aiRecommendation.suggestedAddons.addonIds)
    setAiAppliedBanner(true)
    setPackageSelectMode('standard')
    setCurrentStep(1) // Advance directly to Customize step to review the configured package & add-ons
    setMaxVisitedStep((prev) => Math.max(prev, 1))
    setErrorMsg('')
  }

  // Step-level form validation guardrails
  const validateStep = (stepIndex: number): { valid: boolean; error?: string } => {
    if (stepIndex === 0) {
      if (selectedPkgIndex < 0 || selectedPkgIndex >= packages.length) {
        return { valid: false, error: 'Please choose a package to proceed.' }
      }
      return { valid: true }
    }
    if (stepIndex === 1) {
      if (guestCount < 1) {
        return { valid: false, error: 'Please specify a valid guest count.' }
      }
      return { valid: true }
    }
    if (stepIndex === 2) {
      if (!eventDate) {
        return { valid: false, error: 'Please select an available event date on the calendar.' }
      }
      return { valid: true }
    }
    if (stepIndex === 3) {
      if (!currentUser && (!clientName.trim() || !clientEmail.trim())) {
        return { valid: false, error: 'Please enter your full name and email address.' }
      }
      if (!isPhoneValid) {
        return { valid: false, error: 'Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g., 09123456789).' }
      }
      if (eventType === 'Others (Please Specify)' && !customEventType.trim()) {
        return { valid: false, error: 'Please specify your custom event type.' }
      }
      if (!gcashRefNumber.trim()) {
        return { valid: false, error: 'Please enter your payment transaction reference number.' }
      }
      if (!proofOfPaymentUrl) {
        return { valid: false, error: 'Please attach a screenshot proof of your 50% downpayment receipt.' }
      }
      return { valid: true }
    }
    return { valid: true }
  }

  // Navigation validation for primary next button
  const canGoNext = () => validateStep(currentStep).valid

  // Check if a step indicator in the header bar is clickable
  const isStepClickable = (idx: number) => {
    if (idx === currentStep) return false
    // Backward steps are always clickable
    if (idx < currentStep) return true
    // Immediate next step is clickable if current step inputs are valid
    if (idx === currentStep + 1) {
      return validateStep(currentStep).valid
    }
    // Future visited steps: only reachable if all prior steps currently validate
    if (idx <= maxVisitedStep) {
      for (let s = 0; s < idx; s++) {
        if (!validateStep(s).valid) return false
      }
      return true
    }
    return false
  }

  // Click handler for interactive step indicator buttons with validation guardrails
  const handleStepClick = (targetIndex: number) => {
    if (targetIndex === currentStep) return

    // Backward navigation: allow users to freely click backward to any previously completed step
    if (targetIndex < currentStep) {
      setErrorMsg('')
      setCurrentStep(targetIndex)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Forward navigation guardrails:
    // 1. Prevent jumping forward if the current step's required form inputs are invalid
    const currentValidation = validateStep(currentStep)
    if (!currentValidation.valid) {
      setErrorMsg(currentValidation.error || 'Please complete the required fields on this step before proceeding.')
      return
    }

    // 2. Validate all intermediate steps between current step and target step
    for (let s = currentStep; s < targetIndex; s++) {
      const stepVal = validateStep(s)
      if (!stepVal.valid) {
        setErrorMsg(stepVal.error || `Please complete Step ${s + 1} (${STEP_LABELS[s]}) first.`)
        setCurrentStep(s)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    // 3. Prevent jumping past uncompleted steps far ahead
    if (targetIndex > maxVisitedStep && targetIndex > currentStep + 1) {
      setErrorMsg(`Please complete each step in order before jumping to Step ${targetIndex + 1}.`)
      return
    }

    setErrorMsg('')
    setMaxVisitedStep((prev) => Math.max(prev, targetIndex))
    setCurrentStep(targetIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goNext = () => {
    setErrorMsg('')
    if (currentStep === 3) {
      setPhoneTouched(true)
    }
    const check = validateStep(currentStep)
    if (!check.valid) {
      setErrorMsg(check.error || 'Please complete the required fields to continue.')
      return
    }
    if (currentStep < STEP_LABELS.length - 1) {
      const nextStep = currentStep + 1
      setMaxVisitedStep((prev) => Math.max(prev, nextStep))
      setCurrentStep(nextStep)
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

    if (!currentUser && (!clientName.trim() || !clientEmail.trim())) {
      setErrorMsg('Missing contact details.')
      setIsSubmitting(false)
      return
    }

    if (!isPhoneValid) {
      setPhoneTouched(true)
      setErrorMsg('Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g., 09123456789).')
      setIsSubmitting(false)
      return
    }

    const minBookingLeadTime = getMinBookingDate()
    if (!eventDate || new Date(`${eventDate}T00:00:00`) < minBookingLeadTime) {
      setErrorMsg('Bookings require at least 14 days advance notice. Please select an eligible date.')
      setIsSubmitting(false)
      return
    }

    if (extraMain > 0 && (extraMainDishes.slice(0, extraMain).some((dish) => !dish) || new Set(extraMainDishes.slice(0, extraMain)).size !== extraMain)) {
      setErrorMsg('Please choose a different main dish for every extra main-dish add-on.')
      setIsSubmitting(false)
      return
    }
    if (extraPasta > 0 && (extraPastaDishes.slice(0, extraPasta).some((dish) => !dish) || new Set(extraPastaDishes.slice(0, extraPasta)).size !== extraPasta)) {
      setErrorMsg('Please choose a different pasta dish for every extra pasta add-on.')
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
        selectedMainDishes,
        selectedPastaDishes,
        extraMainDishes: extraMainDishes.slice(0, extraMain),
        extraPastaDishes: extraPastaDishes.slice(0, extraPasta),
      },
      totalPrice: calculations.totalPrice,
      downpaymentAmount: calculations.downpayment,
      paymentMethod,
      gcashRefNumber: gcashRefNumber.trim(),
      proofOfPaymentUrl: proofOfPaymentUrl || null,
      notes: `${currentPkg.pricePerHead !== undefined ? 'Per-head pricing; ' : `Tier: ${calculations.tier.pax} pax + ${FOOD_BUFFER_PAX} pax buffer. `}Selected mains: ${selectedMainDishes.join(', ') || 'none'}. Selected pasta: ${selectedPastaDishes.join(', ') || 'none'}. Extra mains: ${extraMainDishes.slice(0, extraMain).join(', ') || 'none'}. Extra pasta: ${extraPastaDishes.slice(0, extraPasta).join(', ') || 'none'}. Extra Dessert: ${extraDessert}. Flat add-ons: ${selectedAIAddonIds.join(', ') || 'none'}.\nPayment: ${paymentMethod === 'bank_transfer' ? 'MARIBANK / BANK TRANSFER' : 'QR PH / GCASH'} (Ref: ${gcashRefNumber.trim()}). Receipt proof attached.\n${notes}`,
    }

    createBooking(bookingData)

    setSuccessMsg('Booking submitted successfully! You will receive an SMS and email notification with your booking reference. Please wait for downpayment verification.')
    setIsSubmitting(false)
    setTimeout(onComplete, 2400)
  }

  // Active showcase photos for selected category (Checklist Item 5)
  const currentShowcasePhotos = CATEGORY_SHOWCASE_GALLERY[eventType] || CATEGORY_SHOWCASE_GALLERY['Kids Birthday']
  const activeShowcasePhoto = currentShowcasePhotos[selectedGalleryPhotoIndex] || currentShowcasePhotos[0]

  return (
    <div className="wizard-container">
      {/* Step Indicators */}
      <div className="wizard-progress" role="navigation" aria-label="Booking Progress Stepper">
        {STEP_LABELS.map((label, idx) => {
          const isCompleted = idx < currentStep
          const isActive = idx === currentStep
          const isReachable = isStepClickable(idx)
          const isLocked = !isActive && !isReachable

          return (
            <button
              key={label}
              type="button"
              className={`wizard-step-indicator ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isReachable ? 'clickable' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => handleStepClick(idx)}
              aria-current={isActive ? 'step' : undefined}
              aria-disabled={isLocked}
              title={
                isActive
                  ? `Current Step: ${label}`
                  : isCompleted
                  ? `Return to Step ${idx + 1}: ${label}`
                  : isReachable
                  ? `Jump to Step ${idx + 1}: ${label}`
                  : `Complete previous steps to unlock Step ${idx + 1}: ${label}`
              }
            >
              <div className="wizard-step-dot">
                {isCompleted ? <Check size={14} /> : <span>{idx + 1}</span>}
              </div>
              <span className="wizard-step-label">{label}</span>
            </button>
          )
        })}
      </div>

      {aiAppliedBanner && (
        <div className="alert-box success" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #FFFDF0 0%, #FFF3D6 100%)', border: '1px solid var(--gold)' }}>
          <Sparkles size={18} style={{ color: 'var(--gold-dark)', flexShrink: 0 }} />
          <span>
            <strong>AI Package Preset Applied:</strong> Recommended package (<strong>{currentPkg.shortName}</strong>) and <strong>{guestCount} guests</strong> have been configured for your event!
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
              {packages.map((pkg, idx) => (
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '22px' }}>
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
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'block' }}>{aiRecommendation.budgetExceeded ? 'Minimum package price' : 'Estimated Total'}</span>
                    <strong className="font-number" style={{ fontSize: '1.4rem', color: 'var(--terracotta)' }}>
                      PHP {(aiRecommendation.budgetExceeded ? aiRecommendation.tier.price : aiRecommendation.estimatedTotal).toLocaleString()}
                    </strong>
                    {!aiRecommendation.budgetExceeded && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block' }}>
                      50% Downpayment: PHP {Math.round(aiRecommendation.estimatedTotal * 0.5).toLocaleString()}
                    </span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--ink-light)', borderTop: '1px solid rgba(245, 196, 0, 0.3)', paddingTop: '14px' }}>
                  <span>✓ <strong>{aiRecommendation.tier.pax} pax base tier</strong></span>
                  <span>✓ <strong>+{FOOD_BUFFER_PAX} pax buffer</strong> (covers {aiRecommendation.tier.pax + FOOD_BUFFER_PAX} pax)</span>
                  <span>✓ <strong>{aiRecommendation.pkg.freebies.length} freebies</strong></span>
                  <span>✓ <strong>{aiRecommendation.pkg.entertainment.length} entertainment</strong></span>
                </div>

                {aiRecommendation.customizationNotes.length > 0 && (
                  <div style={{ marginTop: '12px', background: '#FEF3C7', border: '1px solid #FDE68A', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#92400E' }}>
                    <strong style={{ display: 'block', marginBottom: '2px', color: '#78350F' }}>{aiRecommendation.budgetExceeded ? `No package within ₱${aiBudget.toLocaleString()}:` : `Optimal Budget Fit (Maximized within ₱${aiBudget.toLocaleString()} limit):`}</strong>
                    {aiRecommendation.customizationNotes.join(' · ')}
                  </div>
                )}
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
                  disabled={aiRecommendation.budgetExceeded}
                  className="btn-hero-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: aiRecommendation.budgetExceeded ? 0.55 : 1, cursor: aiRecommendation.budgetExceeded ? 'not-allowed' : 'pointer' }}
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

              {/* Checklist Item 4: Interactive Menu Selection Grid (Main Dishes & Pasta) */}
              <div className="dish-swap-box" style={{ background: '#FFFDF9', border: '1.5px solid var(--gold)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 className="dish-swap-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink)' }}>
                      Select Your 4 Included Dishes: 3 Main Courses + 1 Pasta Dish
                    </h4>
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '5px 0 0' }}>
                      Tailor your banquet buffet spread. Choose exactly 3 signature main courses and 1 pasta dish included with your package.
                    </p>
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    background: (selectedMainDishes.length === 3 && selectedPastaDishes.length === 1) ? '#ECFDF5' : '#FEF3C7',
                    color: (selectedMainDishes.length === 3 && selectedPastaDishes.length === 1) ? '#059669' : '#D97706',
                    border: `1.5px solid ${(selectedMainDishes.length === 3 && selectedPastaDishes.length === 1) ? '#A7F3D0' : '#FDE68A'}`,
                  }}>
                    {(selectedMainDishes.length === 3 && selectedPastaDishes.length === 1) ? (
                      <>
                        <Check size={14} /> 4 / 4 Dishes Complete
                      </>
                    ) : (
                      <>
                        {selectedDishCount} / 4 Included Dishes Selected
                      </>
                    )}
                  </div>
                </div>

                {/* Main Dishes (Red Box Area) */}
                <div
                  style={{
                    marginBottom: '22px',
                    border: '1.5px solid #FCA5A5',
                    background: '#FFF8F8',
                    borderRadius: '12px',
                    padding: '18px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                        Main Dishes (Choose 3)
                      </h5>
                      <span style={{ fontSize: '0.78rem', color: '#7F1D1D' }}>
                        Select 3 savory viands for your guest buffet table
                      </span>
                    </div>
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: selectedMainDishes.length === 3 ? '#ECFDF5' : '#FEE2E2',
                        color: selectedMainDishes.length === 3 ? '#065F46' : '#991B1B',
                        border: `1px solid ${selectedMainDishes.length === 3 ? '#A7F3D0' : '#FCA5A5'}`,
                      }}
                    >
                      [ {selectedMainDishes.length} / 3 Selected ]
                    </div>
                  </div>

                  <div className="dish-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                    {MAIN_DISHES.map((dish) => {
                      const isSelected = selectedMainDishes.includes(dish)
                      const isDisabled = !isSelected && selectedMainDishes.length >= 3
                      const details = DISH_DETAILS[dish]
                      return (
                        <label
                          key={dish}
                          style={{
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.45 : 1,
                            background: isSelected ? '#FFFBEB' : '#FFFFFF',
                            borderColor: isSelected ? 'var(--gold)' : '#E5E7EB',
                            borderWidth: isSelected ? '2px' : '1px',
                            borderStyle: 'solid',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isSelected ? '0 4px 12px rgba(217, 119, 6, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            userSelect: 'none',
                          }}
                        >
                          {/* Visual Dish Media / Thumbnail */}
                          <div style={{ width: '100%', height: '115px', position: 'relative', overflow: 'hidden', background: '#F3F4F6' }}>
                            <img
                              src={details?.image || ''}
                              alt={dish}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'transform 0.3s ease',
                              }}
                            />
                            {isSelected && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  background: '#059669',
                                  color: '#FFFFFF',
                                  borderRadius: '12px',
                                  padding: '2px 8px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                              >
                                <Check size={12} /> Selected
                              </div>
                            )}
                          </div>

                          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.25 }}>
                                  {dish}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => toggleDish(dish, 'main')}
                                  style={{
                                    marginTop: '2px',
                                    accentColor: 'var(--gold)',
                                    width: '16px',
                                    height: '16px',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  }}
                                />
                              </div>
                              {details?.tag && (
                                <span style={{ fontSize: '0.74rem', color: '#991B1B', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                                  {details.tag}
                                </span>
                              )}
                              {details?.description && (
                                <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.3 }}>
                                  {details.description}
                                </p>
                              )}
                            </div>

                            <div style={{ paddingTop: '6px', borderTop: '1px dashed #F3F4F6', fontSize: '0.75rem', fontWeight: 600, color: isSelected ? '#059669' : isDisabled ? 'var(--muted)' : 'var(--terracotta)' }}>
                              {isSelected ? '✓ In Buffet Spread' : isDisabled ? 'Max 3 mains reached' : '+ Select main dish'}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Pasta Dishes (Blue Box Area) */}
                <div
                  style={{
                    border: '1.5px solid #93C5FD',
                    background: '#F0F7FF',
                    borderRadius: '12px',
                    padding: '18px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                        Pasta Dishes (Choose 1)
                      </h5>
                      <span style={{ fontSize: '0.78rem', color: '#1E3A8A' }}>
                        Select 1 savory pasta specialty to complement your buffet
                      </span>
                    </div>
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: selectedPastaDishes.length === 1 ? '#ECFDF5' : '#DBEAFE',
                        color: selectedPastaDishes.length === 1 ? '#065F46' : '#1E40AF',
                        border: `1px solid ${selectedPastaDishes.length === 1 ? '#A7F3D0' : '#93C5FD'}`,
                      }}
                    >
                      [ {selectedPastaDishes.length} / 1 Selected ]
                    </div>
                  </div>

                  <div className="dish-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                    {PASTA_DISHES.map((dish) => {
                      const isSelected = selectedPastaDishes.includes(dish)
                      const isDisabled = !isSelected && selectedPastaDishes.length >= 1
                      const details = DISH_DETAILS[dish]
                      return (
                        <label
                          key={dish}
                          style={{
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.45 : 1,
                            background: isSelected ? '#F0FDF4' : '#FFFFFF',
                            borderColor: isSelected ? '#10B981' : '#E5E7EB',
                            borderWidth: isSelected ? '2px' : '1px',
                            borderStyle: 'solid',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isSelected ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            userSelect: 'none',
                          }}
                        >
                          {/* Visual Dish Media / Thumbnail */}
                          <div style={{ width: '100%', height: '115px', position: 'relative', overflow: 'hidden', background: '#F3F4F6' }}>
                            <img
                              src={details?.image || ''}
                              alt={dish}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'transform 0.3s ease',
                              }}
                            />
                            {isSelected && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  background: '#059669',
                                  color: '#FFFFFF',
                                  borderRadius: '12px',
                                  padding: '2px 8px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }}
                              >
                                <Check size={12} /> Selected
                              </div>
                            )}
                          </div>

                          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.25 }}>
                                  {dish}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={() => toggleDish(dish, 'pasta')}
                                  style={{
                                    marginTop: '2px',
                                    accentColor: '#10B981',
                                    width: '16px',
                                    height: '16px',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  }}
                                />
                              </div>
                              {details?.tag && (
                                <span style={{ fontSize: '0.74rem', color: '#1E40AF', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                                  {details.tag}
                                </span>
                              )}
                              {details?.description && (
                                <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.3 }}>
                                  {details.description}
                                </p>
                              )}
                            </div>

                            <div style={{ paddingTop: '6px', borderTop: '1px dashed #F3F4F6', fontSize: '0.75rem', fontWeight: 600, color: isSelected ? '#059669' : isDisabled ? 'var(--muted)' : '#1E40AF' }}>
                              {isSelected ? '✓ In Buffet Spread' : isDisabled ? 'Max 1 pasta reached' : '+ Select pasta dish'}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {selectedMainDishes.length === 3 && selectedPastaDishes.length === 1 && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
                    <Check size={18} style={{ color: '#059669', flexShrink: 0 }} />
                    <span>All 4 included dishes chosen (3 Main Courses + 1 Pasta Dish). You can add extra courses or flat add-ons below if needed!</span>
                  </div>
                )}
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

              {/* Hybrid Add-ons Section (Per-Pax Extra Dishes + Flat-Rate Enhancements) */}
              <div style={{ marginTop: '36px', paddingTop: '28px', borderTop: '1px solid var(--line)' }}>
                <div style={{ marginBottom: '22px' }}>
                  <h4 className="dish-swap-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--ink)' }}>
                    Optional Add-ons & Extra Courses
                  </h4>
                  <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '4px 0 0' }}>
                    Select additional viands or pasta courses for your catering buffet, or add flat-rate celebration enhancements.
                  </p>
                </div>

                {/* Sub-section 1: Per-Guest Extra Food Add-ons */}
                <div style={{ marginBottom: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--terracotta)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                        Per-Guest Extra Food Add-ons
                      </h5>
                      <span style={{ fontSize: '0.74rem', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        Calculated × {guestCount} guests
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      Spawns dish selector dropdowns as counter increases
                    </span>
                  </div>

                  <div className="addon-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', alignItems: 'start', gap: '16px' }}>
                    {/* Extra Main Dish Card with Dynamic Selector Dropdowns */}
                    <div className="addon-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '18px', background: extraMain > 0 ? '#FFFBF6' : '#FFFFFF', borderColor: extraMain > 0 ? 'var(--gold)' : 'var(--line)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--ink)' }}>Extra Main Dish</strong>
                          <small style={{ color: 'var(--terracotta)', fontWeight: 600 }}>+PHP {EXTRA_MAIN_RATE} / pax</small>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" className="stepper-btn" onClick={() => setExtraMain((prev) => Math.max(0, prev - 1))}>
                            <Minus size={14} />
                          </button>
                          <strong style={{ minWidth: '22px', textAlign: 'center', fontSize: '1rem' }}>{extraMain}</strong>
                          <button type="button" className="stepper-btn" onClick={() => setExtraMain((prev) => prev + 1)}>
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      {extraMain > 0 && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--terracotta)', fontWeight: 700, background: '#FFF5EB', padding: '6px 10px', borderRadius: '6px' }}>
                          +PHP {calculations.extraMainCost.toLocaleString()} ({extraMain} extra main{extraMain > 1 ? 's' : ''} × ₱{EXTRA_MAIN_RATE} × {guestCount} guests)
                        </div>
                      )}

                      {/* Dynamically spawned dropdowns for Extra Main Dish */}
                      {extraMain > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', borderTop: '1px dashed var(--line)', paddingTop: '12px' }}>
                          {Array.from({ length: extraMain }).map((_, index) => (
                            <div key={`extra-main-${index}`}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                Extra Main Dish #{index + 1} Selection:
                              </label>
                              <select
                                className="input-field"
                                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                value={extraMainDishes[index] || ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setExtraMainDishes((prev) => {
                                    const next = [...prev]
                                    next[index] = val
                                    return next
                                  })
                                }}
                              >
                                <option value="">-- Choose Extra Main Dish #{index + 1} --</option>
                                {MAIN_DISHES.map((dish) => (
                                  <option key={dish} value={dish} disabled={extraMainDishes.some((selected, selectedIndex) => selectedIndex !== index && selected === dish)}>{dish}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Extra Pasta Dish Card with Dynamic Selector Dropdowns */}
                    <div className="addon-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '18px', background: extraPasta > 0 ? '#F8FAFF' : '#FFFFFF', borderColor: extraPasta > 0 ? '#60A5FA' : 'var(--line)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--ink)' }}>Extra Pasta Dish</strong>
                          <small style={{ color: '#2563EB', fontWeight: 600 }}>+PHP {EXTRA_PASTA_RATE} / pax</small>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" className="stepper-btn" onClick={() => setExtraPasta((prev) => Math.max(0, prev - 1))}>
                            <Minus size={14} />
                          </button>
                          <strong style={{ minWidth: '22px', textAlign: 'center', fontSize: '1rem' }}>{extraPasta}</strong>
                          <button type="button" className="stepper-btn" onClick={() => setExtraPasta((prev) => prev + 1)}>
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      {extraPasta > 0 && (
                        <div style={{ fontSize: '0.82rem', color: '#1E40AF', fontWeight: 700, background: '#EFF6FF', padding: '6px 10px', borderRadius: '6px' }}>
                          +PHP {calculations.extraPastaCost.toLocaleString()} ({extraPasta} extra pasta × ₱{EXTRA_PASTA_RATE} × {guestCount} guests)
                        </div>
                      )}

                      {/* Dynamically spawned dropdowns for Extra Pasta Dish */}
                      {extraPasta > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', borderTop: '1px dashed var(--line)', paddingTop: '12px' }}>
                          {Array.from({ length: extraPasta }).map((_, index) => (
                            <div key={`extra-pasta-${index}`}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                Extra Pasta Dish #{index + 1} Selection:
                              </label>
                              <select
                                className="input-field"
                                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                value={extraPastaDishes[index] || ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setExtraPastaDishes((prev) => {
                                    const next = [...prev]
                                    next[index] = val
                                    return next
                                  })
                                }}
                              >
                                <option value="">-- Choose Extra Pasta Dish #{index + 1} --</option>
                                {PASTA_DISHES.map((dish) => (
                                  <option key={dish} value={dish} disabled={extraPastaDishes.some((selected, selectedIndex) => selectedIndex !== index && selected === dish)}>{dish}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Extra Dessert Card */}
                    <div className="addon-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '18px', background: extraDessert > 0 ? '#FFFDF5' : '#FFFFFF', borderColor: extraDessert > 0 ? 'var(--gold)' : 'var(--line)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--ink)' }}>Extra Dessert</strong>
                          <small style={{ color: 'var(--terracotta)', fontWeight: 600 }}>+PHP {EXTRA_DESSERT_RATE} / pax</small>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button type="button" className="stepper-btn" onClick={() => setExtraDessert((prev) => Math.max(0, prev - 1))}>
                            <Minus size={14} />
                          </button>
                          <strong style={{ minWidth: '22px', textAlign: 'center', fontSize: '1rem' }}>{extraDessert}</strong>
                          <button type="button" className="stepper-btn" onClick={() => setExtraDessert((prev) => prev + 1)}>
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      {extraDessert > 0 && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--terracotta)', fontWeight: 700, background: '#FFFBEB', padding: '6px 10px', borderRadius: '6px' }}>
                          +PHP {calculations.extraDessertCost.toLocaleString()} (+₱{EXTRA_DESSERT_RATE} × {guestCount} guests)
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub-section 2: Flat-Rate Enhancements */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      Celebration Enhancements (Flat Rate)
                    </h5>
                    <span style={{ fontSize: '0.74rem', background: '#F3F4F6', color: '#4B5563', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                      Optional flat event additions
                    </span>
                  </div>

                  <div className="addon-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                    {AI_CATALOG_ADDONS.map((addon) => {
                      const isChecked = selectedAIAddonIds.includes(addon.id)
                      return (
                        <label
                          key={addon.id}
                          className="addon-card"
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '16px',
                            background: isChecked ? '#FFFBEB' : '#FFFFFF',
                            borderColor: isChecked ? 'var(--gold)' : 'var(--line)',
                            borderWidth: isChecked ? '2px' : '1px',
                            borderRadius: '10px',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <strong style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.3 }}>{addon.name}</strong>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => setSelectedAIAddonIds((current) =>
                                event.target.checked
                                  ? [...new Set([...current, addon.id])]
                                  : current.filter((id) => id !== addon.id),
                              )}
                              style={{ accentColor: 'var(--gold)', width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer' }}
                            />
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--terracotta)' }}>
                              +{formatMoney(addon.price, addon.currency)}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: isChecked ? '#059669' : 'var(--muted)', fontWeight: 600 }}>
                              {isChecked ? '✓ Added' : '+ Add flat'}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
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
                <CreditCard size={22} style={{ color: '#B45309', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Required 50% Downpayment:
                  </strong>
                  <div className="font-number" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#18181B', marginTop: '2px', lineHeight: 1.2 }}>
                    {formatMoney(calculations.downpayment, currentPkg.currency)}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#4B5563', marginTop: '4px', fontWeight: 500 }}>
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
                const minValidDate = getMinBookingDate()
                const isTooSoon = new Date(`${item.dateStr}T00:00:00`) < minValidDate
                const isBooked = bookings.some((b) => b.eventDate === item.dateStr && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit')
                const bookingCount = getBookingCountForDate(item.dateStr)
                const hasPending = hasPendingBookings(item.dateStr)

                const isClickable = !isTooSoon && !isBlocked && !isBooked
                const isSelected = eventDate === item.dateStr && isClickable

                let stateClass = 'available'
                if (isTooSoon) stateClass = 'lead-time-disabled'
                else if (isBlocked) stateClass = 'blocked'
                else if (isBooked) stateClass = 'booked'
                else if (hasPending) stateClass = 'pending-booking'

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    className={`calendar-day-cell ${stateClass} ${isSelected ? 'selected' : ''} ${!isClickable ? 'disabled' : ''}`}
                    onClick={() => isClickable && handleDateSelect(item.dateStr)}
                    disabled={!isClickable}
                    title={isTooSoon ? 'Requires at least 14 days advance booking' : isBlocked ? 'Blocked date' : isBooked ? 'Already reserved' : 'Available for booking'}
                  >
                    <span className="calendar-day-number">{item.day}</span>
                    {isTooSoon ? (
                      <span className="calendar-lead-time-tag">14d notice</span>
                    ) : isBlocked ? (
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

            {/* Calendar Legend Bar with 14-day notice status */}
            <div className="calendar-legend-bar">
              <div className="legend-item"><span className="legend-dot available" /> Available</div>
              <div className="legend-item"><span className="legend-dot booked" /> Reserved</div>
              <div className="legend-item"><span className="legend-dot blocked" /> Blocked</div>
              <div className="legend-item"><span className="legend-dot pending-booking" /> Pending Request</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#9CA3AF' }} /> 14-Day Lead Buffer</div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0 }}>Mobile Number (For Semaphore SMS)</label>
                    <span style={{ fontSize: '0.75rem', color: clientPhone.length === 11 ? (isPhoneValid ? '#059669' : '#DC2626') : 'var(--muted)', fontWeight: 600 }}>
                      {clientPhone.length}/11 Digits
                    </span>
                  </div>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="09123456789"
                    maxLength={11}
                    value={clientPhone}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11)
                      setClientPhone(digitsOnly)
                      setPhoneTouched(true)
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    required
                    style={{
                      borderColor: (phoneTouched || clientPhone.length > 0) && !isPhoneValid ? '#DC2626' : undefined,
                      backgroundColor: (phoneTouched || clientPhone.length > 0) && !isPhoneValid ? '#FEF2F2' : undefined,
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                  />
                  {(phoneTouched || clientPhone.length > 0) && !isPhoneValid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#DC2626', fontSize: '0.8rem', fontWeight: 500 }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g., 09123456789).</span>
                    </div>
                  )}
                  {isPhoneValid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#059669', fontSize: '0.8rem', fontWeight: 500 }}>
                      <CheckCircle size={14} style={{ flexShrink: 0 }} />
                      <span>Valid 11-digit Philippine mobile format</span>
                    </div>
                  )}
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
                  To reserve and lock your celebration date, a required <strong>50% downpayment</strong> ({formatMoney(calculations.downpayment, currentPkg.currency)}) is required. Please transfer via QR Ph / GCash or MariBank and attach your proof below.
                </p>

                {/* Streamlined Payment Method Tabs (Action Item 1) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('qrph')}
                    className={`payment-option-card ${paymentMethod === 'qrph' ? 'active' : ''}`}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      border: paymentMethod === 'qrph' ? '2px solid var(--terracotta)' : '1px solid var(--line)',
                      background: paymentMethod === 'qrph' ? 'var(--paper-warm)' : '#FFF',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <QrCode size={22} style={{ color: 'var(--terracotta)' }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--ink)' }}>QR Ph / GCash</strong>
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
                      gap: '12px',
                    }}
                  >
                    <Building size={22} style={{ color: 'var(--gold-dark)' }} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--ink)' }}>MariBank / Bank Transfer</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Direct bank transfer</span>
                    </div>
                  </button>
                </div>

                {/* Tab 1: QR Ph / GCash Showcase */}
                {paymentMethod === 'qrph' && (
                  <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: 'var(--radius-md)', border: '1.5px solid #005CE6', marginBottom: '18px', boxShadow: '0 4px 14px rgba(0, 92, 230, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ background: '#F0F7FF', padding: '10px', borderRadius: '10px', border: '1px solid #BFDBFE', textAlign: 'center', flexShrink: 0 }}>
                        <img
                          src="/sinag_gcash_qr.png"
                          alt="Official Sinag Catering GCash / QR Ph Code"
                          style={{ width: '130px', height: '130px', display: 'block', borderRadius: '6px', objectFit: 'contain' }}
                        />
                        <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#005CE6', letterSpacing: '0.04em', marginTop: '6px', display: 'block' }}>
                          SCAN TO PAY (QR PH / GCASH)
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1E40AF', background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px', marginBottom: '6px' }}>
                          Official Merchant QR Code
                        </span>
                        <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--ink)' }}>
                          Sinag's Catering Services (Sunshine C.)
                        </strong>
                        <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Mobile Hotline: <strong style={{ color: 'var(--ink)' }}>0928 714 4597</strong></span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount('0928 714 4597')}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'var(--ink)',
                            }}
                          >
                            <Copy size={12} /> {copiedAccount ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--ink-light)', marginTop: '6px' }}>
                          Required 50% Downpayment: <strong style={{ color: 'var(--terracotta)', fontSize: '1.05rem' }}>{formatMoney(calculations.downpayment, currentPkg.currency)}</strong>
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          Open your GCash or any QR Ph banking app (BDO, BPI, Maya, UnionBank, etc.), scan this code, and confirm transfer to <strong>Sunshine C. (0928 714 4597)</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: MariBank / Bank Transfer Showcase */}
                {paymentMethod === 'bank_transfer' && (
                  <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--gold-dark)', marginBottom: '18px', boxShadow: '0 4px 14px rgba(184, 134, 11, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '10px', border: '1px solid #FDE68A', textAlign: 'center', flexShrink: 0, minWidth: '120px' }}>
                        <Building size={36} style={{ color: 'var(--gold-dark)', margin: '0 auto 8px', display: 'block' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--gold-dark)', letterSpacing: '0.04em', display: 'block' }}>
                          MARIBANK
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Direct Transfer</span>
                      </div>

                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400E', background: '#FEF3C7', padding: '2px 8px', borderRadius: '4px', marginBottom: '6px' }}>
                          Direct Bank Account
                        </span>
                        <strong style={{ display: 'block', fontSize: '1.1rem', color: 'var(--ink)' }}>
                          MariBank Philippines
                        </strong>
                        <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '4px' }}>
                          Account Name: <strong style={{ color: 'var(--ink)' }}>Sinag Catering Services / Sunshine C.</strong>
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Account / Mobile No: <strong style={{ color: 'var(--ink)' }}>0928 714 4597</strong></span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount('0928 714 4597')}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'var(--ink)',
                            }}
                          >
                            <Copy size={12} /> {copiedAccount ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--ink-light)', marginTop: '6px' }}>
                          Required 50% Downpayment: <strong style={{ color: 'var(--terracotta)', fontSize: '1.05rem' }}>{formatMoney(calculations.downpayment, currentPkg.currency)}</strong>
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          Transfer via MariBank app or InstaPay / PESONet from any bank. Enter account number <strong>0928 714 4597</strong> under <strong>Sunshine C.</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Item 2: Integrated Mandatory Proof Upload Panel (PHOTO 4B) */}
                <div style={{ background: '#FAF8F5', border: '1.5px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '20px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Receipt size={18} style={{ color: 'var(--terracotta)' }} />
                      <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'var(--ink)' }}>
                        Submit Transaction Proof
                      </h4>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', padding: '3px 10px', borderRadius: '999px', fontWeight: 700, letterSpacing: '0.04em' }}>
                      Required to Confirm
                    </span>
                  </div>

                  <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                    Enter your GCash / MariBank reference number and attach your payment receipt screenshot below so our admin team can verify and lock in your reservation date.
                  </p>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                      <Receipt size={13} style={{ color: 'var(--terracotta)' }} />
                      <span>Reference Number <strong style={{ color: '#DC2626' }}>*</strong></span>
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 902148923019 or MariBank transaction ID"
                      value={gcashRefNumber}
                      onChange={(e) => setGcashRefNumber(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                      Found on your GCash SMS / receipt or banking app transfer confirmation screen.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                      <UploadCloud size={13} style={{ color: 'var(--terracotta)' }} />
                      <span>Screenshot Proof <strong style={{ color: '#DC2626' }}>*</strong></span>
                    </label>

                    <label
                      htmlFor="booking-proof-upload"
                      className={`portal-dropzone ${proofOfPaymentUrl ? 'has-file' : ''} ${isDraggingProof ? 'drag-over' : ''} ${errorMsg && !proofOfPaymentUrl ? 'dropzone-error' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDraggingProof(true)
                      }}
                      onDragLeave={() => setIsDraggingProof(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDraggingProof(false)
                        handleProofFileChange(e.dataTransfer.files?.[0])
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        id="booking-proof-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={(e) => handleProofFileChange(e.target.files?.[0])}
                      />
                      {proofOfPaymentUrl ? (
                        <div className="portal-dropzone-selected">
                          <img src={proofOfPaymentUrl} alt="Receipt thumbnail" className="portal-receipt-thumbnail" />
                          <div className="portal-dropzone-fileinfo" style={{ flex: 1 }}>
                            <span className="portal-dropzone-filename">{proofFileName || 'receipt_screenshot.png'}</span>
                            <span className="portal-dropzone-change"><CheckCircle size={13} /> Ready for verification · Click or drag to change receipt</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setProofOfPaymentUrl(null)
                              setProofFileName('')
                            }}
                            style={{
                              background: '#FEE2E2',
                              border: '1px solid #FCA5A5',
                              color: '#991B1B',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="portal-dropzone-empty">
                          <div className="portal-upload-icon-circle">
                            <UploadCloud size={20} style={{ color: 'var(--terracotta)' }} />
                          </div>
                          <div className="portal-dropzone-text">
                            <strong>Click or drag & drop payment receipt screenshot</strong>
                            <span>
                              PNG, JPG, or WEBP up to 10MB (or{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setProofOfPaymentUrl('/sinag_gcash_qr.png')
                                  setProofFileName('gcash_downpayment_receipt.png')
                                  setProofError('')
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--terracotta)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                }}
                              >
                                use sample receipt
                              </button>
                              )
                            </span>
                          </div>
                        </div>
                      )}
                    </label>

                    {proofError && (
                      <span style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '6px', display: 'block' }}>
                        {proofError}
                      </span>
                    )}

                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
                      Both Reference Number and Receipt Screenshot are required before proceeding to confirmation.
                    </span>
                  </div>
                </div>
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

          {/* Single Centered Digital Receipt Card */}
          <div
            className="digital-receipt-container"
            style={{
              maxWidth: '680px',
              margin: '0 auto',
              background: '#FFFFFF',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              boxShadow: '0 12px 36px rgba(44, 26, 0, 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Clean Top Header Band */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1C1917 0%, #292524 100%)',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--terracotta)',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FAF5EE', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <Sparkles size={14} style={{ color: 'var(--gold)' }} />
                Sinag Catering Services – Provisional Booking Summary
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  background: 'rgba(217, 119, 6, 0.25)',
                  color: '#FBBF24',
                  border: '1px solid #D97706',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.05em',
                }}
              >
                ITEMIZED DIGITAL RECEIPT
              </span>
            </div>

            {/* Receipt Card Body */}
            <div style={{ padding: '28px 32px' }}>
              {/* Header Block: Brand Logo & Title */}
              <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1.5px dashed var(--line)' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <img
                    src="/sinag_logo.png"
                    alt="Sinag Catering"
                    style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                    Sinag's Catering Services
                  </h3>
                </div>
                <p style={{ margin: '0 0 2px', fontSize: '0.82rem', color: 'var(--muted)', letterSpacing: '0.02em' }}>
                  Authentic Filipino Celebrations & Catering Banquet · Baliwag, Bulacan
                </p>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--ink-light)' }}>
                  Mobile Hotline: <strong>0928 714 4597</strong> · contact@sinagcateringservices.com
                </p>
              </div>

              {/* Reference & Date Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '12px',
                  padding: '16px 0',
                  borderBottom: '1.5px dashed var(--line)',
                  background: '#FCFBF9',
                  margin: '0 -32px',
                  paddingLeft: '32px',
                  paddingRight: '32px',
                }}
              >
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                    Reference ID
                  </span>
                  <strong style={{ fontSize: '0.98rem', color: 'var(--terracotta)', fontFamily: 'monospace' }}>
                    {tempBookingRef}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                    Booking Timestamp
                  </span>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>
                    {bookingTimestamp}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                    Selected Event Date
                  </span>
                  <strong style={{ fontSize: '0.86rem', color: 'var(--ink)' }}>
                    {new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
              </div>

              {/* Client Details Section */}
              <div style={{ padding: '18px 0', borderBottom: '1.5px dashed var(--line)' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} style={{ color: 'var(--terracotta)' }} /> Client & Event Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 16px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--muted)', display: 'inline-block', width: '92px' }}>Client Name:</span>
                    <strong style={{ color: 'var(--ink)' }}>{currentUser?.name || clientName || 'Guest User'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', display: 'inline-block', width: '92px' }}>Contact No:</span>
                    <strong style={{ color: 'var(--ink)' }}>{clientPhone || '0928 714 4597'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', display: 'inline-block', width: '92px' }}>Email:</span>
                    <span style={{ color: 'var(--ink)' }}>{currentUser?.email || clientEmail}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', display: 'inline-block', width: '92px' }}>Category:</span>
                    <strong style={{ color: 'var(--ink)' }}>
                      {eventType === 'Others (Please Specify)' && customEventType ? customEventType : eventType}
                    </strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--muted)', display: 'inline-block', width: '92px' }}>Venue / Notes:</span>
                    <span style={{ color: 'var(--ink)', fontStyle: notes ? 'normal' : 'italic' }}>
                      {notes ? notes : 'To be confirmed / On-site catering banquet'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Order Breakdown Table */}
              <div style={{ padding: '20px 0', borderBottom: '1.5px dashed var(--line)' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Utensils size={13} style={{ color: 'var(--terracotta)' }} /> Itemized Order Breakdown
                </h4>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1.5px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '8px 4px', fontWeight: 700 }}>Item & Specification</th>
                      <th style={{ padding: '8px 8px', fontWeight: 700, textAlign: 'center' }}>Pax / Qty</th>
                      <th style={{ padding: '8px 4px', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Base Package Tier */}
                    <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 4px', verticalAlign: 'top' }}>
                        <strong style={{ display: 'block', color: 'var(--ink)', fontSize: '0.92rem' }}>
                          {currentPkg.name}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {currentPkg.description}
                        </span>

                        {/* Selected 4 Included Dishes */}
                        <div style={{ marginTop: '8px', padding: '8px 10px', background: '#FFFDF9', border: '1px solid #FED7AA', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>
                            Included 4 Courses (3 Mains + 1 Pasta):
                          </div>
                          <div style={{ fontSize: '0.79rem', color: 'var(--ink-light)', lineHeight: 1.45 }}>
                            <span style={{ color: '#991B1B', fontWeight: 600 }}>• 3 Mains:</span> {selectedMainDishes.join(', ') || '3 main dishes selected'}<br />
                            <span style={{ color: '#1E40AF', fontWeight: 600 }}>• 1 Pasta:</span> {selectedPastaDishes.join(', ') || '1 pasta dish selected'}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', verticalAlign: 'top', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{guestCount} Pax</span>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                          {currentPkg.pricePerHead !== undefined ? `₱${currentPkg.pricePerHead}/head` : `+${FOOD_BUFFER_PAX} buffer pax`}
                        </div>
                      </td>
                      <td style={{ padding: '12px 4px', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {formatMoney(calculations.baseCost, currentPkg.currency)}
                      </td>
                    </tr>

                    {/* Excess Guests if any */}
                    {calculations.excessGuests > 0 && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Excess Pax Buffer Charge</div>
                          <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                            {calculations.excessGuests} extra guest{calculations.excessGuests > 1 ? 's' : ''} over {calculations.servicePax} pax tier buffer (₱{EXCESS_PAX_RATE}/pax)
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          +{calculations.excessGuests} pax
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                          {formatMoney(calculations.excessPaxFee, currentPkg.currency)}
                        </td>
                      </tr>
                    )}

                    {/* Extra Main Dish Add-on */}
                    {extraMain > 0 && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <div style={{ fontWeight: 600, color: '#9A3412' }}>
                            Extra Main Course ({extraMain} dish{extraMain > 1 ? 'es' : ''} × ₱{EXTRA_MAIN_RATE}/pax)
                          </div>
                          <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                            Selected: {extraMainDishes.slice(0, extraMain).filter(Boolean).join(' · ') || 'Dishes to confirm'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {guestCount} pax
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                          {formatMoney(calculations.extraMainCost, currentPkg.currency)}
                        </td>
                      </tr>
                    )}

                    {/* Extra Pasta Dish Add-on */}
                    {extraPasta > 0 && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <div style={{ fontWeight: 600, color: '#1E40AF' }}>
                            Extra Pasta Course ({extraPasta} dish{extraPasta > 1 ? 'es' : ''} × ₱{EXTRA_PASTA_RATE}/pax)
                          </div>
                          <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                            Selected: {extraPastaDishes.slice(0, extraPasta).filter(Boolean).join(' · ') || 'Dishes to confirm'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {guestCount} pax
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                          {formatMoney(calculations.extraPastaCost, currentPkg.currency)}
                        </td>
                      </tr>
                    )}

                    {/* Extra Dessert Course Add-on */}
                    {extraDessert > 0 && (
                      <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 4px' }}>
                          <div style={{ fontWeight: 600, color: '#92400E' }}>
                            Extra Dessert Course ({extraDessert} serving{extraDessert > 1 ? 's' : ''} × ₱{EXTRA_DESSERT_RATE}/pax)
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {guestCount} pax
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                          {formatMoney(calculations.extraDessertCost, currentPkg.currency)}
                        </td>
                      </tr>
                    )}

                    {/* Flat-rate Celebrations Add-ons */}
                    {selectedAIAddonIds.map((id) => {
                      const addon = AI_CATALOG_ADDONS.find((a) => a.id === id)
                      if (!addon) return null
                      return (
                        <tr key={id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 4px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{addon.name}</div>
                            <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Celebration event enhancement</span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            1 Flat
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                            {formatMoney(addon.price, currentPkg.currency)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Calculations Summary */}
              <div style={{ padding: '20px 0', borderBottom: '1.5px dashed var(--line)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px', marginLeft: 'auto', fontSize: '0.88rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                    <span>Base Package Amount:</span>
                    <strong style={{ color: 'var(--ink)' }}>{formatMoney(calculations.baseCost, currentPkg.currency)}</strong>
                  </div>
                  {calculations.excessPaxFee + calculations.addOnCost > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                      <span>Add-ons Total:</span>
                      <strong style={{ color: 'var(--ink)' }}>{formatMoney(calculations.excessPaxFee + calculations.addOnCost, currentPkg.currency)}</strong>
                    </div>
                  )}
                  <div style={{ borderTop: '1.5px solid var(--line)', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--ink)' }}>Grand Total Amount:</span>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--terracotta)' }}>
                      {formatMoney(calculations.totalPrice, currentPkg.currency)}
                    </span>
                  </div>
                </div>

                {/* Highlighted 50% Downpayment Banner */}
                <div
                  style={{
                    marginTop: '18px',
                    background: '#FFF7ED',
                    border: '1.5px solid #FDBA74',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Lock-In Requirement
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: '#9A3412', display: 'block' }}>
                      Required 50% Downpayment: {formatMoney(calculations.downpayment, currentPkg.currency)}
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: '#B45309' }}>
                      Remaining 50% balance ({formatMoney(calculations.totalPrice - calculations.downpayment, currentPkg.currency)}) payable on event day.
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--terracotta)' }}>
                      {formatMoney(calculations.downpayment, currentPkg.currency)}
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#EA580C', color: '#FFF', padding: '2px 8px', borderRadius: '4px' }}>
                      DUE UPON RESERVATION
                    </span>
                  </div>
                </div>
              </div>

              {/* Submitted Payment Details */}
              <div style={{ padding: '20px 0 6px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={13} style={{ color: 'var(--terracotta)' }} /> Submitted Payment Details
                </h4>

                <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: proofOfPaymentUrl ? '12px' : '0' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700, letterSpacing: '0.05em' }}>
                        Selected Payment Method
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: '#14532D' }}>
                        {paymentMethod === 'bank_transfer' ? 'MariBank / Bank Transfer' : 'QR Ph / GCash'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700, letterSpacing: '0.05em' }}>
                        Entered Reference Number
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: '#14532D', fontFamily: 'monospace' }}>
                        {gcashRefNumber || 'N/A'}
                      </strong>
                    </div>
                  </div>

                  {proofOfPaymentUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#FFFFFF', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '8px' }}>
                      <img
                        src={proofOfPaymentUrl}
                        alt="Payment receipt proof"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86EFAC', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={15} style={{ color: '#16A34A', flexShrink: 0 }} />
                          <strong style={{ fontSize: '0.85rem', color: '#14532D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {proofFileName || 'receipt_screenshot.png'}
                          </strong>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#15803D', display: 'block', marginTop: '2px' }}>
                          Screenshot File Attached · Ready for Admin Downpayment Verification
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <p style={{ margin: '14px 0 0', fontSize: '0.74rem', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.4 }}>
                  * This digital provisional summary confirms your booking submission. A binding catering contract and official invoice will be generated upon downpayment clearance by our banquet team.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      {!successMsg && (
        <div className="wizard-nav-buttons">
          <button
            type="button"
            className="btn-hero-outline wizard-back-btn"
            onClick={goBack}
            disabled={isSubmitting}
          >
            <ArrowLeft size={16} /> {currentStep === 0 ? 'Back to Home' : 'Previous Step'}
          </button>

          {currentStep < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              className="btn-hero-primary wizard-next-btn"
              onClick={goNext}
              disabled={!canGoNext() || isSubmitting}
            >
              Next Step <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-hero-primary wizard-submit-btn"
              style={{ fontSize: '1rem', padding: '14px 32px' }}
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
          )}
        </div>
      )}

      {currentStep === 4 && !successMsg && (
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '14px' }}>
          Your reservation will be saved, and confirmation notifications will trigger via SMS and email.
        </p>
      )}
    </div>
  )
}
