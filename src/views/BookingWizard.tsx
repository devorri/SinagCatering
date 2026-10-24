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
  CupSoda,
  ChevronDown,
  ChevronUp,
  Maximize2,
  X,
  Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useConfirm } from '../context/ConfirmContext'
import { uploadImageToStorage } from '../lib/storage'
import {
  EXCESS_PAX_RATE,
  EXTRA_DESSERT_RATE,
  EXTRA_MAIN_RATE,
  EXTRA_PASTA_RATE,
  FOOD_BUFFER_PAX,
  MAIN_DISHES,
  PASTA_DISHES,
  DISH_DETAILS,
  DRINK_OPTIONS,
  DRINK_DETAILS,
  findTierForGuestCount,
  recommendPackage,
} from '../data/packages'
import { CATEGORY_SHOWCASE_GALLERY } from '../data/eventGalleries'
import { AI_CATALOG_ADDONS, formatMoney, SINAG_PACKAGES } from '../data/packages'
import type { AIFormData } from '../lib/ai'
import { EmbeddedCheckoutModal } from '../components/EmbeddedCheckoutModal'

interface BookingWizardProps {
  onComplete: () => void
  onBack: () => void
  initialAIFormData?: AIFormData
  initialDate?: string
  initialPackageId?: string
}

const STEP_LABELS = ['Select Package', 'Customize', 'Pick Date', 'Your Details', 'Review & Submit']

export const BookingWizard: React.FC<BookingWizardProps> = ({
  onComplete,
  onBack,
  initialAIFormData,
  initialDate,
  initialPackageId,
}) => {
  const { blockedDates, bookings, createBooking, currentUser, packages, menuItems, addons } = useApp()
  const { confirm } = useConfirm()

  // Dynamically managed catalog with safe fallbacks
  const availableMainDishes = useMemo(() => {
    const fromDb = menuItems.filter((m) => m.category === 'main' && m.active).map((m) => m.name)
    return fromDb.length > 0 ? fromDb : MAIN_DISHES
  }, [menuItems])

  const availablePastaDishes = useMemo(() => {
    const fromDb = menuItems.filter((m) => m.category === 'pasta' && m.active).map((m) => m.name)
    return fromDb.length > 0 ? fromDb : PASTA_DISHES
  }, [menuItems])

  const availableDrinkOptions = useMemo(() => {
    const fromDb = menuItems.filter((m) => m.category === 'drink' && m.active).map((m) => m.name)
    return fromDb.length > 0 ? fromDb : [...DRINK_OPTIONS]
  }, [menuItems])

  const availableAddons = useMemo(() => {
    return addons && addons.length > 0 ? addons : AI_CATALOG_ADDONS
  }, [addons])

  const getDishMeta = (dishName: string) => {
    const found = menuItems.find((m) => m.name.toLowerCase() === dishName.toLowerCase())
    if (found) {
      return {
        name: found.name,
        category: found.category as 'main' | 'pasta',
        tag: found.tag || (found.category === 'main' ? 'Main Dish' : 'Gourmet Pasta'),
        description: found.description || '',
        image: found.imageUrl || DISH_DETAILS[dishName]?.image || '',
      }
    }
    return DISH_DETAILS[dishName] || {
      name: dishName,
      category: 'main' as const,
      tag: 'Chef Special',
      description: 'Handcrafted signature dish prepared fresh for your event.',
      image: '',
    }
  }

  const getDrinkMeta = (drinkName: string) => {
    const found = menuItems.find((m) => m.name.toLowerCase() === drinkName.toLowerCase() && m.category === 'drink')
    if (found) {
      return {
        name: found.name,
        tag: found.tag || 'Chilled Beverage',
        description: found.description || '',
        image: found.imageUrl || DRINK_DETAILS[drinkName]?.image || '',
        color: found.color || DRINK_DETAILS[drinkName]?.color || '#0284C7',
        accentColor: found.accentColor || DRINK_DETAILS[drinkName]?.accentColor || '#F0F9FF',
      }
    }
    return DRINK_DETAILS[drinkName] || {
      name: drinkName,
      tag: 'Chilled Beverage',
      description: 'Refreshing chilled celebration drink.',
      image: '',
      color: '#0284C7',
      accentColor: '#F0F9FF',
    }
  }

  // Package Selection by ID (resilient to dynamic catalog re-fetching and sorting)
  const [selectedPkgId, setSelectedPkgId] = useState<string>(() => {
    if (initialAIFormData?.package_id) return initialAIFormData.package_id
    if (initialPackageId) return initialPackageId
    return packages[0]?.id || 'budget-basic'
  })

  // Start directly on Step 1 (Customize Menu) if arriving with a preselected package or AI recommendation
  const [currentStep, setCurrentStep] = useState<number>(() => (initialAIFormData || initialPackageId) ? 1 : 0)
  const [maxVisitedStep, setMaxVisitedStep] = useState<number>(() => (initialAIFormData || initialPackageId) ? 1 : 0)
  const initialPresetAppliedRef = React.useRef(false)

  // Step 1 — Package Selection & AI Recommendation Mode
  const [packageSelectMode, setPackageSelectMode] = useState<'standard' | 'ai'>('standard')

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
  const [selectedDrinks, setSelectedDrinks] = useState<string[]>(initialAIFormData?.selected_drinks ?? [])
  const [extraMainDishes, setExtraMainDishes] = useState<string[]>([])
  const [extraPastaDishes, setExtraPastaDishes] = useState<string[]>([])
  const [showExtraDishErrors, setShowExtraDishErrors] = useState(false)
  const [isIncludedDishesCollapsed, setIsIncludedDishesCollapsed] = useState(false)
  const [isMainDishesCollapsed, setIsMainDishesCollapsed] = useState(false)
  const [isPastaDishesCollapsed, setIsPastaDishesCollapsed] = useState(false)
  const [isDrinksCollapsed, setIsDrinksCollapsed] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // Screen/Element vibration and smooth scroll for validation
  const [shakeSection, setShakeSection] = useState<'mains' | 'pasta' | 'drinks' | 'extraDishes' | null>(null)
  const [attemptedStep1Next, setAttemptedStep1Next] = useState(false)

  const triggerSectionAttention = (
    section: 'mains' | 'pasta' | 'drinks' | 'extraDishes',
    elementId: string
  ) => {
    setAttemptedStep1Next(true)
    setShakeSection(section)

    if (section === 'mains') {
      setIsIncludedDishesCollapsed(false)
      setIsMainDishesCollapsed(false)
    } else if (section === 'pasta') {
      setIsIncludedDishesCollapsed(false)
      setIsPastaDishesCollapsed(false)
    } else if (section === 'drinks') {
      setIsDrinksCollapsed(false)
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([120, 60, 120, 60, 200])
      } catch {
        // Safe fallback
      }
    }

    setTimeout(() => {
      const el = document.getElementById(elementId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 60)

    setTimeout(() => {
      setShakeSection((prev) => (prev === section ? null : prev))
    }, 1200)
  }

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

  const [eventDate, setEventDate] = useState(() => initialDate || formatToDateStr(getMinBookingDate()))
  const [currentYear, setCurrentYear] = useState(() => {
    if (initialDate) {
      const d = new Date(`${initialDate}T00:00:00`)
      if (!isNaN(d.getTime())) return d.getFullYear()
    }
    return getMinBookingDate().getFullYear()
  })
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialDate) {
      const d = new Date(`${initialDate}T00:00:00`)
      if (!isNaN(d.getTime())) return d.getMonth()
    }
    return getMinBookingDate().getMonth()
  })

  // Payment Term Option (50% Downpayment vs. 100% Full Payment Upfront)
  const [paymentTerm, setPaymentTerm] = useState<'downpayment' | 'full'>('downpayment')

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

  // Reactively sync selected package whenever initialPackageId or packages list updates
  React.useEffect(() => {
    if (initialPackageId) {
      setSelectedPkgId(initialPackageId)
      setCurrentStep(1)
      setMaxVisitedStep((prev) => Math.max(prev, 1))
      const match = packages.find((p) => p.id === initialPackageId)
      if (match && match.defaultPax) {
        setGuestCount(match.defaultPax)
      }
    }
  }, [initialPackageId, packages])

  // Reactively auto-fill and advance wizard whenever an AI recommendation is applied
  React.useEffect(() => {
    if (initialAIFormData && !initialPresetAppliedRef.current) {
      initialPresetAppliedRef.current = true
      if (initialAIFormData.package_id) {
        setSelectedPkgId(initialAIFormData.package_id)
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
  const [isUploadingProof, setIsUploadingProof] = useState(false)
  const [qrModalInfo, setQrModalInfo] = useState<{
    isOpen: boolean
    title: string
    imageSrc: string
    subtitle: string
    accountName: string
    accountNo: string
  } | null>(null)
  const [isPayMongoModalOpen, setIsPayMongoModalOpen] = useState(false)

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

  const selectedPkgIndex = useMemo(() => {
    const idx = packages.findIndex((p) => p.id === selectedPkgId)
    return idx !== -1 ? idx : 0
  }, [packages, selectedPkgId])

  const setSelectedPkgIndex = (idx: number) => {
    if (packages[idx]) {
      setSelectedPkgId(packages[idx].id)
    }
  }

  const currentPkg = useMemo(() => {
    return packages.find((p) => p.id === selectedPkgId) ?? packages[0] ?? SINAG_PACKAGES[0]
  }, [packages, selectedPkgId])

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
    const flatAddonsCost = availableAddons
      .filter((addon) => selectedAIAddonIds.includes(addon.id))
      .reduce((sum, addon) => {
        const rate = addon.rateType === 'per_head' ? addon.price * guestCount : addon.price
        return sum + rate
      }, 0)
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
  }, [currentPkg, guestCount, extraMain, extraPasta, extraDessert, selectedAIAddonIds, availableAddons])

  // Dynamic payable amount based on payment term (50% downpayment vs. 100% full payment)
  const payableAmount = useMemo(() => {
    return paymentTerm === 'full' ? calculations.totalPrice : calculations.downpayment
  }, [paymentTerm, calculations.totalPrice, calculations.downpayment])

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

  const toggleDrink = (drink: string) => {
    setSelectedDrinks((current) =>
      current.includes(drink)
        ? []
        : [drink]
    )
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

  const handleProofFileChange = async (file: File | undefined) => {
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
    setIsUploadingProof(true)
    try {
      const res = await uploadImageToStorage(file, 'receipts')
      if (res.url) {
        setProofOfPaymentUrl(res.url)
      } else {
        setProofError(res.error || 'Failed to upload receipt screenshot.')
      }
    } catch {
      // Graceful fallback to DataURL
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofOfPaymentUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    } finally {
      setIsUploadingProof(false)
    }
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
      if (selectedMainDishes.length !== 3) {
        return {
          valid: false,
          error: `Please select 3 main dishes (${selectedMainDishes.length}/3 selected).`,
        }
      }
      if (selectedPastaDishes.length !== 1) {
        return {
          valid: false,
          error: `Please select 1 pasta dish (${selectedPastaDishes.length}/1 selected).`,
        }
      }
      if (selectedDrinks.length !== 1) {
        return {
          valid: false,
          error: 'Please select 1 included buffet drink (Blue Lemonade, Iced Tea, or Cucumber).',
        }
      }
      if (extraMain > 0) {
        const chosenMains = extraMainDishes.slice(0, extraMain)
        if (chosenMains.length < extraMain || chosenMains.some((dish) => !dish || !dish.trim())) {
          return {
            valid: false,
            error: 'Please select a specific dish for your extra main course before proceeding.',
          }
        }
      }
      if (extraPasta > 0) {
        const chosenPastas = extraPastaDishes.slice(0, extraPasta)
        if (chosenPastas.length < extraPasta || chosenPastas.some((dish) => !dish || !dish.trim())) {
          return {
            valid: false,
            error: 'Please select a specific dish for your extra pasta course before proceeding.',
          }
        }
      }
      return { valid: true }
    }
    if (stepIndex === 2) {
      if (!eventDate) {
        return { valid: false, error: 'Please select an available event date on the calendar.' }
      }
      if (blockedDates.includes(eventDate)) {
        return { valid: false, error: 'Selected date is currently blocked. Please choose another date.' }
      }
      const minValidDate = getMinBookingDate()
      if (new Date(`${eventDate}T00:00:00`) < minValidDate) {
        return { valid: false, error: 'Selected date requires at least 14 days advance booking.' }
      }
      const isBooked = bookings.some((b) => b.eventDate === eventDate && b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit')
      if (isBooked) {
        return { valid: false, error: 'Selected date is already reserved. Please choose another date.' }
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
        return { valid: false, error: `Please attach a screenshot proof of your ${paymentTerm === 'full' ? 'full payment' : '50% downpayment'} receipt.` }
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
    // 1. Backward steps are always freely accessible
    if (idx < currentStep) return true

    // 2. Forward steps: ALL preceding steps up to idx - 1 must be strictly valid
    for (let s = 0; s < idx; s++) {
      if (!validateStep(s).valid) return false
    }

    // 3. Block skipping ahead past unvisited steps
    if (idx > currentStep + 1 && idx > maxVisitedStep) {
      return false
    }

    return true
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
    if (!isStepClickable(targetIndex)) {
      for (let s = 0; s < targetIndex; s++) {
        const val = validateStep(s)
        if (!val.valid) {
          if (s === 1) {
            if (selectedMainDishes.length !== 3) {
              triggerSectionAttention('mains', 'booking-main-dishes-section')
            } else if (selectedPastaDishes.length !== 1) {
              triggerSectionAttention('pasta', 'booking-pasta-dishes-section')
            } else if (selectedDrinks.length !== 1) {
              triggerSectionAttention('drinks', 'booking-drinks-section')
            } else {
              setShowExtraDishErrors(true)
              triggerSectionAttention('extraDishes', 'booking-extra-dishes-section')
              confirm({
                title: 'Incomplete Extra Course Selection',
                message: 'Please select a specific dish for your extra main or pasta course before proceeding.',
                confirmText: 'Select Dishes',
                cancelText: 'Dismiss',
                variant: 'warning',
              })
            }
          }
          setErrorMsg(val.error || `Please complete Step ${s + 1} (${STEP_LABELS[s]}) first.`)
          if (s !== currentStep) {
            setCurrentStep(s)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
          return
        }
      }
      setErrorMsg(`Please complete each step in order before jumping to Step ${targetIndex + 1}.`)
      return
    }

    setErrorMsg('')
    setMaxVisitedStep((prev) => Math.max(prev, targetIndex))
    setCurrentStep(targetIndex)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goNext = async () => {
    setErrorMsg('')
    if (currentStep === 3) {
      setPhoneTouched(true)
    }

    if (currentStep === 1) {
      if (selectedMainDishes.length !== 3) {
        triggerSectionAttention('mains', 'booking-main-dishes-section')
        setErrorMsg(`Please select 3 main dishes (${selectedMainDishes.length}/3 selected).`)
        return
      }
      if (selectedPastaDishes.length !== 1) {
        triggerSectionAttention('pasta', 'booking-pasta-dishes-section')
        setErrorMsg(`Please select 1 pasta dish (${selectedPastaDishes.length}/1 selected).`)
        return
      }
      if (selectedDrinks.length !== 1) {
        triggerSectionAttention('drinks', 'booking-drinks-section')
        setErrorMsg('Please select 1 included buffet drink (Blue Lemonade, Iced Tea, or Cucumber).')
        return
      }
      if (extraMain > 0 && extraMainDishes.slice(0, extraMain).some((dish) => !dish || !dish.trim())) {
        setShowExtraDishErrors(true)
        triggerSectionAttention('extraDishes', 'booking-extra-dishes-section')
        await confirm({
          title: 'Incomplete Extra Course Selection',
          message: 'Please select a specific dish for your extra main course before proceeding.',
          confirmText: 'Select Dishes',
          cancelText: 'Dismiss',
          variant: 'warning',
        })
        setErrorMsg('Please select a specific dish for your extra main course before proceeding.')
        return
      }
      if (extraPasta > 0 && extraPastaDishes.slice(0, extraPasta).some((dish) => !dish || !dish.trim())) {
        setShowExtraDishErrors(true)
        triggerSectionAttention('extraDishes', 'booking-extra-dishes-section')
        await confirm({
          title: 'Incomplete Extra Course Selection',
          message: 'Please select a specific dish for your extra pasta course before proceeding.',
          confirmText: 'Select Dishes',
          cancelText: 'Dismiss',
          variant: 'warning',
        })
        setErrorMsg('Please select a specific dish for your extra pasta course before proceeding.')
        return
      }
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

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isCompleted && (currentStep > 0 || isSubmitting)) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [currentStep, isSubmitting, isCompleted])

  const goBack = async () => {
    setErrorMsg('')
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      const ok = await confirm({
        title: 'Exit Booking Wizard?',
        message: 'Are you sure you want to exit the booking wizard? Any event selections and customizations will be discarded.',
        confirmText: 'Yes, Discard & Exit',
        cancelText: 'Stay and Continue Booking',
        variant: 'warning',
      })
      if (ok) onBack()
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

    if (extraMain > 0 && extraMainDishes.slice(0, extraMain).some((dish) => !dish || !dish.trim())) {
      setErrorMsg('Please choose a main dish for every extra main-dish add-on.')
      setIsSubmitting(false)
      return
    }
    if (extraPasta > 0 && extraPastaDishes.slice(0, extraPasta).some((dish) => !dish || !dish.trim())) {
      setErrorMsg('Please choose a pasta dish for every extra pasta add-on.')
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
        selectedDrinks,
        extraMainDishes: extraMainDishes.slice(0, extraMain),
        extraPastaDishes: extraPastaDishes.slice(0, extraPasta),
      },
      totalPrice: calculations.totalPrice,
      downpaymentAmount: payableAmount,
      paymentTerm,
      paymentMethod,
      gcashRefNumber: gcashRefNumber.trim(),
      proofOfPaymentUrl: proofOfPaymentUrl || null,
      notes: `${currentPkg.pricePerHead !== undefined ? 'Per-head pricing; ' : `Tier: ${calculations.tier.pax} pax + ${FOOD_BUFFER_PAX} pax buffer. `}Selected mains: ${selectedMainDishes.join(', ') || 'none'}. Selected pasta: ${selectedPastaDishes.join(', ') || 'none'}. Selected drink: ${selectedDrinks.join(', ') || 'none'}. Extra mains: ${extraMainDishes.slice(0, extraMain).join(', ') || 'none'}. Extra pasta: ${extraPastaDishes.slice(0, extraPasta).join(', ') || 'none'}. Extra Dessert: ${extraDessert}. Flat add-ons: ${selectedAIAddonIds.join(', ') || 'none'}.\nPayment Term: ${paymentTerm === 'full' ? '100% FULL PAYMENT UPFRONT' : '50% DOWNPAYMENT'}. Payment: ${paymentMethod === 'bank_transfer' ? 'MARIBANK / BANK TRANSFER' : 'QR PH / GCASH'} (Ref: ${gcashRefNumber.trim()}). Receipt proof attached.\n${notes}`,
    }

    const confirmed = await confirm({
      title: 'Confirm Event Reservation',
      message: `Are you ready to submit your catering booking for ${guestCount} guests on ${eventDate} (${currentPkg.name})?\n\nTotal package amount: ₱${calculations.totalPrice.toLocaleString()} (${paymentTerm === 'full' ? '100% Full Payment Upfront' : '50% Downpayment'}: ₱${payableAmount.toLocaleString()}).`,
      confirmText: 'Submit Reservation',
      cancelText: 'Review Details',
      variant: 'primary',
    })
    if (!confirmed) {
      setIsSubmitting(false)
      return
    }

    createBooking(bookingData)

    setIsCompleted(true)
    setSuccessMsg(paymentTerm === 'full'
      ? 'Booking submitted successfully! You will receive an SMS and email notification with your booking reference. Please wait for payment verification.'
      : 'Booking submitted successfully! You will receive an SMS and email notification with your booking reference. Please wait for downpayment verification.')
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
              disabled={isLocked}
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
              {packages.map((pkg, idx) => {
                const isSelected = selectedPkgId === pkg.id || (selectedPkgIndex === idx && !packages.some((p) => p.id === selectedPkgId))
                const firstTierPax = pkg.tiers?.[0]?.pax ?? 50
                const firstTierPrice = pkg.tiers?.[0]?.price ?? 35000
                const startingPrice = pkg.pricePerHead !== undefined
                  ? pkg.pricePerHead * (pkg.defaultPax ?? firstTierPax)
                  : firstTierPrice

                return (
                  <div
                    key={pkg.id}
                    className={`wizard-package-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedPkgId(pkg.id)
                      setGuestCount(pkg.defaultPax ?? firstTierPax)
                      if (pkg.pricePerHead === undefined) setSelectedAIAddonIds([])
                      setCurrentStep(1)
                      setMaxVisitedStep((prev) => Math.max(prev, 1))
                    }}
                  >
                    {idx === 1 && <div className="wizard-pkg-badge">Most Popular</div>}
                    {pkg.imageUrl && (
                      <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px', background: '#F1F5F9' }}>
                        <img
                          src={pkg.imageUrl}
                          alt={pkg.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            ;(e.currentTarget as HTMLElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <h3>{pkg.shortName}</h3>
                    <p className="wizard-pkg-desc">{pkg.description}</p>

                    <div className="wizard-pkg-price">
                      Starting at <strong>{formatMoney(startingPrice, pkg.currency)}</strong>
                      <span>{pkg.pricePerHead !== undefined
                        ? ` / ${pkg.defaultPax ?? firstTierPax} pax`
                        : ` / ${firstTierPax} pax (+${FOOD_BUFFER_PAX} buffer)`}</span>
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
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPkgId(pkg.id)
                        setGuestCount(pkg.defaultPax ?? firstTierPax)
                        if (pkg.pricePerHead === undefined) setSelectedAIAddonIds([])
                        setCurrentStep(1)
                        setMaxVisitedStep((prev) => Math.max(prev, 1))
                      }}
                      className={`wizard-pkg-select-btn ${isSelected ? 'active' : ''}`}
                    >
                      {isSelected ? '✓ Selected · Customize Menu →' : 'Select Package & Customize Menu →'}
                    </button>
                  </div>
                )
              })}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 className="pkg-title" style={{ margin: 0 }}>{currentPkg.name}</h3>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(0)}
                      style={{
                        background: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        color: '#92400E',
                        borderRadius: '20px',
                        padding: '3px 12px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      ← Change Package
                    </button>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>{currentPkg.description}</span>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <div className="pkg-rate">
                    {formatMoney(calculations.totalPrice, currentPkg.currency)}{' '}
                    <span>/{currentPkg.pricePerHead !== undefined ? `${guestCount} pax` : `${calculations.tier.pax} pax`}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px', fontWeight: 500 }}>
                    {calculations.totalPrice > calculations.baseCost
                      ? '(Includes Base + Selected Add-ons)'
                      : '(Base Package Rate)'}
                  </span>
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

              {/* Checklist Item 4: Interactive Menu Selection Grid (Main Dishes & Pasta) — Collapsible / Foldable */}
              <div
                className="dish-swap-box"
                style={{
                  background: '#FFFDF9',
                  border: '1.5px solid var(--gold)',
                  borderRadius: 'var(--radius-md)',
                  padding: isIncludedDishesCollapsed ? '18px 24px' : '24px',
                  marginBottom: '24px',
                  transition: 'all 0.25s ease',
                  boxShadow: isIncludedDishesCollapsed ? '0 1px 4px rgba(0,0,0,0.04)' : '0 4px 16px rgba(184,137,66,0.08)',
                }}
              >
                {/* Collapsible Header */}
                <div
                  onClick={() => setIsIncludedDishesCollapsed(!isIncludedDishesCollapsed)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isIncludedDishesCollapsed ? 0 : '20px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title={isIncludedDishesCollapsed ? 'Click to expand dishes selection' : 'Click to fold dishes selection'}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Utensils size={20} style={{ color: 'var(--gold-dark)', flexShrink: 0 }} />
                      <h4 className="dish-swap-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink)' }}>
                        Select Your 4 Included Dishes: 3 Main Courses + 1 Pasta Dish
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '5px 0 0', paddingLeft: '28px' }}>
                      Tailor your banquet buffet spread. Choose exactly 3 signature main courses and 1 pasta dish included with your package.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Counter Badge */}
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

                    {/* Fold / Unfold Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsIncludedDishesCollapsed(!isIncludedDishesCollapsed)
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: isIncludedDishesCollapsed ? 'var(--obsidian)' : '#FFFFFF',
                        color: isIncludedDishesCollapsed ? '#FFFFFF' : 'var(--ink)',
                        border: '1.5px solid var(--line-dark)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      {isIncludedDishesCollapsed ? (
                        <>
                          <ChevronDown size={16} /> Unfold Dishes Menu
                        </>
                      ) : (
                        <>
                          <ChevronUp size={16} /> Fold / Hide Menu
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsed State Summary Card */}
                {isIncludedDishesCollapsed && (
                  <div
                    onClick={() => setIsIncludedDishesCollapsed(false)}
                    style={{
                      marginTop: '14px',
                      padding: '14px 18px',
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px dashed var(--gold)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Selected Buffet Inclusions Preview:
                      </span>
                      <div style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
                        {selectedMainDishes.length > 0 || selectedPastaDishes.length > 0 || selectedDrinks.length > 0 ? (
                          <>
                            <strong style={{ color: '#991B1B' }}>3 Mains:</strong>{' '}
                            {selectedMainDishes.length > 0 ? selectedMainDishes.join(', ') : <span style={{ color: '#991B1B', fontStyle: 'italic' }}>Pending selection ({3 - selectedMainDishes.length} remaining)</span>}
                            &nbsp;&nbsp;•&nbsp;&nbsp;
                            <strong style={{ color: '#1E40AF' }}>1 Pasta:</strong>{' '}
                            {selectedPastaDishes.length > 0 ? selectedPastaDishes.join(', ') : <span style={{ color: '#1E40AF', fontStyle: 'italic' }}>Pending selection</span>}
                            {selectedDrinks.length > 0 && (
                              <>
                                &nbsp;&nbsp;•&nbsp;&nbsp;
                                <strong style={{ color: '#059669' }}>1 Drink:</strong> {selectedDrinks.join(', ')}
                              </>
                            )}
                          </>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                            No dishes selected yet. Click to unfold and pick your 3 main courses and 1 pasta dish.
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gold-dark)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Click to expand & edit <ChevronDown size={14} />
                    </span>
                  </div>
                )}

                {/* Expanded Full Menu Cards */}
                {!isIncludedDishesCollapsed && (
                  <>
                    {/* Main Dishes (Red Box Area) */}
                    <div
                      id="booking-main-dishes-section"
                      className={`dish-section-box ${shakeSection === 'mains' ? 'shake-vibrate' : ''}`}
                      style={{
                        marginBottom: '22px',
                        border: (attemptedStep1Next && selectedMainDishes.length !== 3) ? '2.5px solid #EF4444' : '1.5px solid #FCA5A5',
                        background: (attemptedStep1Next && selectedMainDishes.length !== 3) ? '#FEF2F2' : '#FFF8F8',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div
                        onClick={() => setIsMainDishesCollapsed(!isMainDishesCollapsed)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMainDishesCollapsed ? 0 : '14px', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                              Main Dishes (Choose 3)
                            </h5>
                            <span style={{ fontSize: '0.72rem', color: '#991B1B', background: '#FEE2E2', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                              {isMainDishesCollapsed ? '▸ Expand Mains' : '▾ Fold'}
                            </span>
                          </div>
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
                            border: `1.5px solid ${selectedMainDishes.length === 3 ? '#A7F3D0' : '#EF4444'}`,
                          }}
                        >
                          [ {selectedMainDishes.length} / 3 Selected ]
                        </div>
                      </div>

                      {/* Red indicator banner when needed to be filled */}
                      {attemptedStep1Next && selectedMainDishes.length !== 3 && (
                        <div style={{ background: '#FEE2E2', border: '1.5px solid #EF4444', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
                          <span>Action Required: Please select 3 main dishes ({selectedMainDishes.length}/3 selected).</span>
                        </div>
                      )}

                      {!isMainDishesCollapsed && (
                        <div className="dish-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                          {availableMainDishes.map((dish) => {
                            const isSelected = selectedMainDishes.includes(dish)
                            const isDisabled = !isSelected && selectedMainDishes.length >= 3
                            const details = getDishMeta(dish)
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
                      )}
                    </div>

                    {/* Pasta Dishes (Blue Box Area) */}
                    <div
                      id="booking-pasta-dishes-section"
                      className={`dish-section-box ${shakeSection === 'pasta' ? 'shake-vibrate' : ''}`}
                      style={{
                        border: (attemptedStep1Next && selectedPastaDishes.length !== 1) ? '2.5px solid #EF4444' : '1.5px solid #93C5FD',
                        background: (attemptedStep1Next && selectedPastaDishes.length !== 1) ? '#FEF2F2' : '#F0F7FF',
                        borderRadius: '12px',
                        padding: '18px 20px',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div
                        onClick={() => setIsPastaDishesCollapsed(!isPastaDishesCollapsed)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isPastaDishesCollapsed ? 0 : '14px', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                              Pasta Dishes (Choose 1)
                            </h5>
                            <span style={{ fontSize: '0.72rem', color: '#1E40AF', background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                              {isPastaDishesCollapsed ? '▸ Expand Pasta' : '▾ Fold'}
                            </span>
                          </div>
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
                            border: `1.5px solid ${selectedPastaDishes.length === 1 ? '#A7F3D0' : '#EF4444'}`,
                          }}
                        >
                          [ {selectedPastaDishes.length} / 1 Selected ]
                        </div>
                      </div>

                      {/* Red indicator banner when needed to be filled */}
                      {attemptedStep1Next && selectedPastaDishes.length !== 1 && (
                        <div style={{ background: '#FEE2E2', border: '1.5px solid #EF4444', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
                          <span>Action Required: Please select 1 pasta dish ({selectedPastaDishes.length}/1 selected).</span>
                        </div>
                      )}

                      {!isPastaDishesCollapsed && (
                        <div className="dish-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                          {availablePastaDishes.map((dish) => {
                            const isSelected = selectedPastaDishes.includes(dish)
                            const isDisabled = !isSelected && selectedPastaDishes.length >= 1
                            const details = getDishMeta(dish)
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
                      )}
                    </div>

                    {/* Completion Alert + Fold Action */}
                    {selectedMainDishes.length === 3 && selectedPastaDishes.length === 1 && (
                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '14px 18px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Check size={18} style={{ color: '#059669', flexShrink: 0 }} />
                          <span>All 4 included dishes chosen (3 Main Courses + 1 Pasta Dish). You can add extra courses or flat add-ons below if needed!</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsIncludedDishesCollapsed(true)}
                          style={{
                            background: '#065F46',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <ChevronUp size={14} /> Fold Dishes Menu
                        </button>
                      </div>
                    )}

                    {/* Bottom Fold Action */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                      <button
                        type="button"
                        onClick={() => setIsIncludedDishesCollapsed(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '7px 18px',
                          borderRadius: '20px',
                          background: '#FFFFFF',
                          border: '1px solid var(--line-dark)',
                          color: 'var(--ink)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <ChevronUp size={15} /> Fold Dishes Menu (Save Screen Space)
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Checklist / Requirement: Included Drink Flavor Customization (Blue Lemonade, Iced Tea, Cucumber) */}
              <div
                id="booking-drinks-section"
                className={`dish-swap-box ${shakeSection === 'drinks' ? 'shake-vibrate' : ''}`}
                style={{
                  background: (attemptedStep1Next && selectedDrinks.length !== 1) ? '#FEF2F2' : 'linear-gradient(180deg, #FFFFFF 0%, #F0FDF4 100%)',
                  border: (attemptedStep1Next && selectedDrinks.length !== 1) ? '2.5px solid #EF4444' : '1.5px solid #10B981',
                  borderRadius: '16px',
                  padding: '24px 20px',
                  marginBottom: '28px',
                  boxShadow: (attemptedStep1Next && selectedDrinks.length !== 1) ? '0 0 0 4px rgba(239, 68, 68, 0.2)' : '0 4px 18px rgba(16, 185, 129, 0.08)',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setIsDrinksCollapsed(!isDrinksCollapsed)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isDrinksCollapsed ? 0 : '20px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title={isDrinksCollapsed ? 'Click to expand drinks selection' : 'Click to fold drinks selection'}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CupSoda size={20} style={{ color: '#059669', flexShrink: 0 }} />
                      <h4 className="dish-swap-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink)' }}>
                        Select Your Included Buffet Drink (Choose 1)
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--muted)', margin: '5px 0 0', paddingLeft: '28px' }}>
                      Included with your banquet package under Dessert & Drinks. Select your preferred chilled bottomless beverage.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Counter Badge */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: selectedDrinks.length === 1 ? '#ECFDF5' : '#FEE2E2',
                        color: selectedDrinks.length === 1 ? '#059669' : '#991B1B',
                        border: `1.5px solid ${selectedDrinks.length === 1 ? '#A7F3D0' : '#EF4444'}`,
                      }}
                    >
                      {selectedDrinks.length === 1 ? (
                        <>
                          <Check size={14} /> 1 / 1 Drink Complete
                        </>
                      ) : (
                        <>
                          {selectedDrinks.length} / 1 Drink Selected
                        </>
                      )}
                    </div>

                    {/* Fold / Unfold Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsDrinksCollapsed(!isDrinksCollapsed)
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        background: isDrinksCollapsed ? 'var(--obsidian)' : '#FFFFFF',
                        color: isDrinksCollapsed ? '#FFFFFF' : 'var(--ink)',
                        border: '1.5px solid var(--line-dark)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      {isDrinksCollapsed ? (
                        <>
                          <ChevronDown size={16} /> Unfold Drinks Menu
                        </>
                      ) : (
                        <>
                          <ChevronUp size={16} /> Fold / Hide Drinks
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Red indicator banner when needed to be filled */}
                {attemptedStep1Next && selectedDrinks.length !== 1 && (
                  <div style={{ background: '#FEE2E2', border: '1.5px solid #EF4444', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <span>Action Required: Please choose your 1 included buffet drink (Blue Lemonade, Iced Tea, or Cucumber).</span>
                  </div>
                )}

                {/* Collapsed State Summary Card */}
                {isDrinksCollapsed && (
                  <div
                    onClick={() => setIsDrinksCollapsed(false)}
                    style={{
                      marginTop: '14px',
                      padding: '14px 18px',
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px dashed #10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Selected Buffet Drink Preview:
                      </span>
                      <div style={{ fontSize: '0.88rem', color: 'var(--ink)' }}>
                        {selectedDrinks.length > 0 ? (
                          <strong style={{ color: '#059669' }}>
                            🥤 {selectedDrinks[0]}
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                            No drink selected yet. Click to unfold and pick Blue Lemonade, Iced Tea, or Cucumber.
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Click to expand & edit <ChevronDown size={14} />
                    </span>
                  </div>
                )}

                {/* Expanded Drink Selection Cards */}
                {!isDrinksCollapsed && (
                  <div className="dish-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                    {availableDrinkOptions.map((drink) => {
                      const isSelected = selectedDrinks.includes(drink)
                      const details = getDrinkMeta(drink)
                      return (
                        <label
                          key={drink}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? details.accentColor : '#FFFFFF',
                            borderColor: isSelected ? details.color : '#E5E7EB',
                            borderWidth: isSelected ? '2px' : '1px',
                            borderStyle: 'solid',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isSelected ? `0 4px 14px ${details.color}25` : '0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            userSelect: 'none',
                          }}
                        >
                          {/* Visual Drink Thumbnail */}
                          <div style={{ width: '100%', height: '125px', position: 'relative', overflow: 'hidden', background: '#F3F4F6' }}>
                            <img
                              src={details?.image || ''}
                              alt={drink}
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
                                <span style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--ink)', lineHeight: 1.25 }}>
                                  {drink}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDrink(drink)}
                                  style={{
                                    marginTop: '2px',
                                    accentColor: details.color,
                                    width: '16px',
                                    height: '16px',
                                    cursor: 'pointer',
                                  }}
                                />
                              </div>
                              {details?.tag && (
                                <span style={{ fontSize: '0.74rem', color: details.color, fontWeight: 700, display: 'block', marginTop: '3px' }}>
                                  {details.tag}
                                </span>
                              )}
                              {details?.description && (
                                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.35 }}>
                                  {details.description}
                                </p>
                              )}
                            </div>

                            <div style={{ paddingTop: '8px', borderTop: '1px dashed #E5E7EB', fontSize: '0.75rem', fontWeight: 600, color: isSelected ? '#059669' : details.color }}>
                              {isSelected ? '✓ In Buffet Spread' : '+ Select this beverage'}
                            </div>
                          </div>
                        </label>
                      )
                    })}
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
                <div
                  id="booking-extra-dishes-section"
                  className={shakeSection === 'extraDishes' ? 'shake-vibrate' : ''}
                  style={{ marginBottom: '30px', transition: 'all 0.3s ease' }}
                >
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
                          {Array.from({ length: extraMain }).map((_, index) => {
                            const isMissing = showExtraDishErrors && (!extraMainDishes[index] || !extraMainDishes[index].trim())
                            return (
                              <div key={`extra-main-${index}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: isMissing ? '#DC2626' : 'var(--muted)', textTransform: 'uppercase' }}>
                                    Extra Main Dish #{index + 1} Selection:
                                  </label>
                                  {isMissing && (
                                    <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700 }}>
                                      Required: Please choose a viand
                                    </span>
                                  )}
                                </div>
                                <select
                                  className="input-field"
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '0.85rem',
                                    borderColor: isMissing ? '#EF4444' : undefined,
                                    backgroundColor: isMissing ? '#FEF2F2' : undefined,
                                    borderWidth: isMissing ? '2px' : '1px',
                                  }}
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
                                  {availableMainDishes.map((dish) => (
                                    <option key={dish} value={dish}>{dish}</option>
                                  ))}
                                </select>
                              </div>
                            )
                          })}
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
                          {Array.from({ length: extraPasta }).map((_, index) => {
                            const isMissing = showExtraDishErrors && (!extraPastaDishes[index] || !extraPastaDishes[index].trim())
                            return (
                              <div key={`extra-pasta-${index}`}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: isMissing ? '#DC2626' : 'var(--muted)', textTransform: 'uppercase' }}>
                                    Extra Pasta Dish #{index + 1} Selection:
                                  </label>
                                  {isMissing && (
                                    <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700 }}>
                                      Required: Please choose a viand
                                    </span>
                                  )}
                                </div>
                                <select
                                  className="input-field"
                                  style={{
                                    padding: '8px 12px',
                                    fontSize: '0.85rem',
                                    borderColor: isMissing ? '#EF4444' : undefined,
                                    backgroundColor: isMissing ? '#FEF2F2' : undefined,
                                    borderWidth: isMissing ? '2px' : '1px',
                                  }}
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
                                  {availablePastaDishes.map((dish) => (
                                    <option key={dish} value={dish}>{dish}</option>
                                  ))}
                                </select>
                              </div>
                            )
                          })}
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
                    {availableAddons.map((addon) => {
                      const isChecked = selectedAIAddonIds.includes(addon.id)
                      const isPerHead = addon.rateType === 'per_head'
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
                            <div>
                              <strong style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.3, display: 'block' }}>{addon.name}</strong>
                              {addon.description && (
                                <p style={{ fontSize: '0.76rem', color: 'var(--muted)', margin: '4px 0 0 0', lineHeight: 1.3 }}>{addon.description}</p>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => setSelectedAIAddonIds((current) =>
                                event.target.checked
                                  ? [...new Set([...current, addon.id])]
                                  : current.filter((id) => id !== addon.id),
                              )}
                              style={{ accentColor: 'var(--gold)', width: '16px', height: '16px', marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                            />
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--terracotta)' }}>
                              +{formatMoney(addon.price, addon.currency)}{isPerHead ? ' / guest' : ''}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: isChecked ? '#059669' : 'var(--muted)', fontWeight: 600 }}>
                              {isChecked ? '✓ Added' : isPerHead ? '+ Add/pax' : '+ Add flat'}
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
                const addon = availableAddons.find((item) => item.id === addonId)
                if (!addon) return null
                const cost = addon.rateType === 'per_head' ? addon.price * guestCount : addon.price
                return (
                  <div key={addon.id} className="quote-line-item">
                    <span>{addon.name}{addon.rateType === 'per_head' ? ` (${guestCount} pax)` : ''}</span>
                    <span className="font-number">{formatMoney(cost, addon.currency)}</span>
                  </div>
                )
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
                    Payment Options & Settlement Instructions
                  </h4>
                </div>

                {/* Flexible Payment Term Selector: 50% Downpayment vs. 100% Full Payment Upfront */}
                <div style={{ marginBottom: '22px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '8px' }}>
                    Select Payment Term
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    {/* Option 1: 50% Downpayment */}
                    <div
                      onClick={() => setPaymentTerm('downpayment')}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-sm)',
                        border: paymentTerm === 'downpayment' ? '2px solid var(--terracotta)' : '1px solid var(--line)',
                        background: paymentTerm === 'downpayment' ? '#FFF9F5' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: paymentTerm === 'downpayment' ? '0 4px 12px rgba(194, 65, 12, 0.08)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name="paymentTerm"
                            checked={paymentTerm === 'downpayment'}
                            onChange={() => setPaymentTerm('downpayment')}
                            style={{ accentColor: 'var(--terracotta)', cursor: 'pointer' }}
                          />
                          <strong style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>50% Downpayment</strong>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#FFEDD5', color: '#9A3412', padding: '2px 8px', borderRadius: '4px' }}>
                          STANDARD LOCK-IN
                        </span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--terracotta)', margin: '4px 0 2px' }}>
                        {formatMoney(calculations.downpayment, currentPkg.currency)}
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                        Pay 50% now to lock in your date. Settle the remaining 50% ({formatMoney(calculations.totalPrice - calculations.downpayment, currentPkg.currency)}) on the event day.
                      </span>
                    </div>

                    {/* Option 2: 100% Full Payment Upfront */}
                    <div
                      onClick={() => setPaymentTerm('full')}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-sm)',
                        border: paymentTerm === 'full' ? '2px solid #059669' : '1px solid var(--line)',
                        background: paymentTerm === 'full' ? '#F0FDF4' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: paymentTerm === 'full' ? '0 4px 12px rgba(5, 150, 105, 0.08)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name="paymentTerm"
                            checked={paymentTerm === 'full'}
                            onChange={() => setPaymentTerm('full')}
                            style={{ accentColor: '#059669', cursor: 'pointer' }}
                          />
                          <strong style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>100% Full Payment Upfront</strong>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '4px' }}>
                          ZERO BALANCE
                        </span>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', margin: '4px 0 2px' }}>
                        {formatMoney(calculations.totalPrice, currentPkg.currency)}
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                        Fully settle entire package & add-on bill upfront today. Enjoy peace of mind with ₱0 balance on event day.
                      </span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px' }}>
                  To reserve and lock your celebration date, {paymentTerm === 'full' ? (
                    <>a <strong>100% full upfront payment</strong> of <strong style={{ color: 'var(--ink)' }}>{formatMoney(calculations.totalPrice, currentPkg.currency)}</strong></>
                  ) : (
                    <>a required <strong>50% downpayment</strong> of <strong style={{ color: 'var(--ink)' }}>{formatMoney(calculations.downpayment, currentPkg.currency)}</strong></>
                  )} is required. Please transfer via QR Ph / GCash or MariBank and attach your proof below.
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
                  <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: 'var(--radius-md)', border: '2px solid #005CE6', marginBottom: '18px', boxShadow: '0 6px 20px rgba(0, 92, 230, 0.12)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '26px', alignItems: 'center' }}>
                      <div style={{ background: '#F0F7FF', padding: '16px', borderRadius: '14px', border: '2px solid #BFDBFE', textAlign: 'center' }}>
                        <div
                          onClick={() => setQrModalInfo({
                            isOpen: true,
                            title: 'GCash / QR Ph Code',
                            imageSrc: '/sinag_gcash_qr.png',
                            subtitle: 'Official Sinag GCash InstaPay Standee',
                            accountName: 'SU*****E C.',
                            accountNo: '0928 714 4597',
                          })}
                          style={{ cursor: 'pointer', position: 'relative', background: '#FFFFFF', borderRadius: '10px', padding: '14px', border: '1.5px solid #CBD5E1', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
                          title="Click to view full size QR code"
                        >
                          <img
                            src="/sinag_gcash_qr.png"
                            alt="Official Sinag Catering GCash / QR Ph Standee"
                            style={{ width: '100%', height: '340px', display: 'block', borderRadius: '8px', objectFit: 'contain' }}
                          />
                          <div style={{ position: 'absolute', bottom: '18px', right: '18px', background: 'rgba(0, 92, 230, 0.92)', color: '#FFF', borderRadius: '6px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                            <Maximize2 size={12} /> Click to Fullscreen
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setQrModalInfo({
                            isOpen: true,
                            title: 'GCash / QR Ph Code',
                            imageSrc: '/sinag_gcash_qr.png',
                            subtitle: 'Official Sinag GCash InstaPay Standee',
                            accountName: 'SU*****E C.',
                            accountNo: '0928 714 4597',
                          })}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '9px 14px',
                            background: '#005CE6',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(0, 92, 230, 0.25)',
                          }}
                        >
                          <Maximize2 size={14} /> Open High-Res Fullscreen View
                        </button>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#005CE6', letterSpacing: '0.05em', marginTop: '8px', display: 'block' }}>
                          DIRECT SCAN WITH GCASH / ANY QR PH APP
                        </span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1E40AF', background: '#DBEAFE', padding: '3px 10px', borderRadius: '5px' }}>
                            Official Merchant QR Code
                          </span>
                          <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#047857', background: '#D1FAE5', padding: '3px 10px', borderRadius: '5px' }}>
                            InstaPay Compatible
                          </span>
                        </div>
                        <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--ink)' }}>
                          Sinag's Catering Services (SU*****E C.)
                        </strong>
                        <div style={{ fontSize: '0.92rem', color: 'var(--muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span>Mobile / Hotline: <strong style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>0928 714 4597</strong></span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount('0928 714 4597')}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              padding: '4px 10px',
                              borderRadius: '5px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: 'var(--ink)',
                              fontWeight: 700,
                            }}
                          >
                            <Copy size={13} /> {copiedAccount ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.92rem', color: 'var(--ink-light)', marginTop: '12px', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}>
                          {paymentTerm === 'full' ? 'Required Full Upfront Payment' : 'Required 50% Downpayment'}:{' '}
                          <strong style={{ color: paymentTerm === 'full' ? '#059669' : 'var(--terracotta)', fontSize: '1.35rem', display: 'block', marginTop: '4px' }}>
                            {formatMoney(payableAmount, currentPkg.currency)}
                          </strong>
                        </div>
                        <p style={{ margin: '14px 0 0', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                          Point your phone camera or open <strong>GCash</strong>, <strong>Maya</strong>, <strong>BDO</strong>, <strong>BPI</strong>, <strong>MariBank</strong>, or any QR Ph app. Scan the large QR code on the left, confirm transfer of <strong>{formatMoney(payableAmount, currentPkg.currency)}</strong> to <strong>SU*****E C.</strong>, and attach your screenshot receipt below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: MariBank / Bank Transfer Showcase */}
                {paymentMethod === 'bank_transfer' && (
                  <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: 'var(--radius-md)', border: '2px solid #EA580C', marginBottom: '18px', boxShadow: '0 6px 20px rgba(234, 88, 12, 0.12)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '26px', alignItems: 'center' }}>
                      <div style={{ background: '#FFF7ED', padding: '16px', borderRadius: '14px', border: '2px solid #FED7AA', textAlign: 'center' }}>
                        <div
                          onClick={() => setQrModalInfo({
                            isOpen: true,
                            title: 'MariBank / InstaPay QR Code',
                            imageSrc: '/sinag_maribank_qr.png',
                            subtitle: 'Official Sinag MariBank InstaPay Standee',
                            accountName: 'SUNSHINE CRUZ (MariBank ****2765)',
                            accountNo: '0928 714 4597',
                          })}
                          style={{ cursor: 'pointer', position: 'relative', background: '#FFFFFF', borderRadius: '10px', padding: '14px', border: '1.5px solid #CBD5E1', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
                          title="Click to view full size MariBank QR code"
                        >
                          <img
                            src="/sinag_maribank_qr.png"
                            alt="Official Sinag Catering MariBank / InstaPay QR Code"
                            style={{ width: '100%', height: '340px', display: 'block', borderRadius: '8px', objectFit: 'contain' }}
                          />
                          <div style={{ position: 'absolute', bottom: '18px', right: '18px', background: 'rgba(234, 88, 12, 0.92)', color: '#FFF', borderRadius: '6px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                            <Maximize2 size={12} /> Click to Fullscreen
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setQrModalInfo({
                            isOpen: true,
                            title: 'MariBank / InstaPay QR Code',
                            imageSrc: '/sinag_maribank_qr.png',
                            subtitle: 'Official Sinag MariBank InstaPay Standee',
                            accountName: 'SUNSHINE CRUZ (MariBank ****2765)',
                            accountNo: '0928 714 4597',
                          })}
                          style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '9px 14px',
                            background: '#EA580C',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
                          }}
                        >
                          <Maximize2 size={14} /> Open High-Res Fullscreen View
                        </button>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#C2410C', letterSpacing: '0.05em', marginTop: '8px', display: 'block' }}>
                          DIRECT SCAN WITH MARIBANK / ANY INSTAPAY APP
                        </span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9A3412', background: '#FFEDD5', padding: '3px 10px', borderRadius: '5px' }}>
                            Official MariBank Account
                          </span>
                          <span style={{ display: 'inline-block', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#047857', background: '#D1FAE5', padding: '3px 10px', borderRadius: '5px' }}>
                            InstaPay Compatible
                          </span>
                        </div>
                        <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--ink)' }}>
                          MariBank Philippines — SUNSHINE CRUZ
                        </strong>
                        <div style={{ fontSize: '0.92rem', color: 'var(--muted)', marginTop: '8px' }}>
                          Account Tag: <strong style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>MariBank(****2765)</strong>
                        </div>
                        <div style={{ fontSize: '0.92rem', color: 'var(--muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span>Account / Mobile No: <strong style={{ color: 'var(--ink)', fontSize: '1.05rem' }}>0928 714 4597</strong></span>
                          <button
                            type="button"
                            onClick={() => handleCopyAccount('0928 714 4597')}
                            style={{
                              background: '#F1F5F9',
                              border: '1px solid #CBD5E1',
                              padding: '4px 10px',
                              borderRadius: '5px',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: 'var(--ink)',
                              fontWeight: 700,
                            }}
                          >
                            <Copy size={13} /> {copiedAccount ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.92rem', color: 'var(--ink-light)', marginTop: '12px', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}>
                          {paymentTerm === 'full' ? 'Required Full Upfront Payment' : 'Required 50% Downpayment'}:{' '}
                          <strong style={{ color: paymentTerm === 'full' ? '#059669' : 'var(--terracotta)', fontSize: '1.35rem', display: 'block', marginTop: '4px' }}>
                            {formatMoney(payableAmount, currentPkg.currency)}
                          </strong>
                        </div>
                        <p style={{ margin: '14px 0 0', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                          Point your phone camera or open <strong>MariBank</strong> or any bank via InstaPay. Scan the large QR code on the left, confirm transfer of <strong>{formatMoney(payableAmount, currentPkg.currency)}</strong> to <strong>SUNSHINE CRUZ</strong>, and attach your screenshot receipt below.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* PayMongo Live Automated QR Ph / Card Option Banner */}
                <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#DCFCE7', color: '#166534', width: '38px', height: '38px', borderRadius: '10px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.92rem', color: '#166534' }}>
                        Prefer Automated Online Checkout?
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: '#15803D', lineHeight: 1.4 }}>
                        Pay live via PayMongo (Dynamic QR Ph / Card) — automatically confirms without manually submitting reference receipts.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPayMongoModalOpen(true)}
                    style={{
                      background: '#059669',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                    }}
                  >
                    <CreditCard size={15} />
                    <span>Pay Online with PayMongo</span>
                  </button>
                </div>

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
                          {isUploadingProof ? (
                            <>
                              <div className="portal-upload-icon-circle" style={{ background: '#FFF7ED' }}>
                                <Loader2 size={20} style={{ color: 'var(--terracotta)' }} className="animate-spin" />
                              </div>
                              <div className="portal-dropzone-text">
                                <strong style={{ color: 'var(--terracotta)' }}>Uploading receipt to storage...</strong>
                                <span>Securing screenshot in Supabase storage</span>
                              </div>
                            </>
                          ) : (
                            <>
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
                            </>
                          )}
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

                        {/* Selected 4 Included Dishes + Beverage */}
                        <div style={{ marginTop: '8px', padding: '8px 10px', background: '#FFFDF9', border: '1px solid #FED7AA', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#9A3412', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>
                            Included 4 Courses + Buffet Drink:
                          </div>
                          <div style={{ fontSize: '0.79rem', color: 'var(--ink-light)', lineHeight: 1.45 }}>
                            <span style={{ color: '#991B1B', fontWeight: 600 }}>• 3 Mains:</span> {selectedMainDishes.join(', ') || '3 main dishes selected'}<br />
                            <span style={{ color: '#1E40AF', fontWeight: 600 }}>• 1 Pasta:</span> {selectedPastaDishes.join(', ') || '1 pasta dish selected'}<br />
                            <span style={{ color: '#059669', fontWeight: 600 }}>• Buffet Drink:</span> {selectedDrinks.join(', ') || 'Standard House Drink'}
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

                    {/* Celebrations Add-ons */}
                    {selectedAIAddonIds.map((id) => {
                      const addon = availableAddons.find((a) => a.id === id)
                      if (!addon) return null
                      const isPerHead = addon.rateType === 'per_head'
                      const cost = isPerHead ? addon.price * guestCount : addon.price
                      return (
                        <tr key={id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 4px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{addon.name}</div>
                            <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
                              {addon.description || (isPerHead ? 'Per guest celebration enhancement' : 'Celebration event enhancement')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            {isPerHead ? `${guestCount} Guests` : '1 Flat'}
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                            {formatMoney(cost, currentPkg.currency)}
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

                {/* Highlighted Payment Term Banner */}
                <div
                  style={{
                    marginTop: '18px',
                    background: paymentTerm === 'full' ? '#ECFDF5' : '#FFF7ED',
                    border: paymentTerm === 'full' ? '1.5px solid #6EE7B7' : '1.5px solid #FDBA74',
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
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: paymentTerm === 'full' ? '#065F46' : '#9A3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {paymentTerm === 'full' ? 'Full Settlement Term' : 'Lock-In Requirement'}
                    </span>
                    <strong style={{ fontSize: '1.1rem', color: paymentTerm === 'full' ? '#065F46' : '#9A3412', display: 'block' }}>
                      {paymentTerm === 'full' ? '100% Full Payment Upfront' : `Required 50% Downpayment: ${formatMoney(calculations.downpayment, currentPkg.currency)}`}
                    </strong>
                    <span style={{ fontSize: '0.76rem', color: paymentTerm === 'full' ? '#047857' : '#B45309' }}>
                      {paymentTerm === 'full'
                        ? 'Event bill fully settled upfront. Zero (₱0) balance remaining on event day.'
                        : `Remaining 50% balance (${formatMoney(calculations.totalPrice - calculations.downpayment, currentPkg.currency)}) payable on event day.`}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.45rem', fontWeight: 800, color: paymentTerm === 'full' ? '#059669' : 'var(--terracotta)' }}>
                      {formatMoney(payableAmount, currentPkg.currency)}
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, background: paymentTerm === 'full' ? '#059669' : '#EA580C', color: '#FFF', padding: '2px 8px', borderRadius: '4px' }}>
                      {paymentTerm === 'full' ? 'PAID IN FULL' : 'DUE UPON RESERVATION'}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: proofOfPaymentUrl ? '12px' : '0' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700, letterSpacing: '0.05em' }}>
                        Selected Payment Term
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: '#14532D' }}>
                        {paymentTerm === 'full' ? '100% Full Payment Upfront' : '50% Downpayment'}
                      </strong>
                    </div>
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
                          Screenshot File Attached · Ready for Admin Verification
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
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <button
                type="button"
                className="btn-hero-primary wizard-next-btn"
                onClick={goNext}
                disabled={isSubmitting}
                title={!canGoNext() ? validateStep(currentStep).error : 'Proceed to next step'}
              >
                Next Step <ArrowRight size={16} />
              </button>
              {!canGoNext() && validateStep(currentStep).error && (
                <span style={{ fontSize: '0.74rem', color: '#B45309', fontWeight: 600 }}>
                  ⚠️ {validateStep(currentStep).error}
                </span>
              )}
            </div>
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

      {/* Fullscreen QR Code Inspection Modal */}
      {qrModalInfo?.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setQrModalInfo(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #E2E8F0',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setQrModalInfo(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#F1F5F9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: '#64748B',
              }}
              title="Close Fullscreen QR"
            >
              <X size={18} />
            </button>

            <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#005CE6', background: '#DBEAFE', padding: '3px 10px', borderRadius: '4px', marginBottom: '8px' }}>
              {qrModalInfo.subtitle}
            </span>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>
              {qrModalInfo.title}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 16px' }}>
              Scan directly with your phone camera, GCash, MariBank, Maya, or any bank app via QR Ph / InstaPay.
            </p>

            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '14px', border: '2px solid #CBD5E1', display: 'inline-block', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              <img
                src={qrModalInfo.imageSrc}
                alt={qrModalInfo.title}
                style={{ width: '380px', maxWidth: '100%', height: '380px', objectFit: 'contain', display: 'block', borderRadius: '8px' }}
              />
            </div>

            <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px', textAlign: 'left', fontSize: '0.85rem' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>ACCOUNT DETAILS</div>
              <strong style={{ color: 'var(--ink)', fontSize: '0.95rem' }}>{qrModalInfo.accountName}</strong>
              <div style={{ marginTop: '4px', color: 'var(--ink-light)', fontSize: '0.82rem' }}>
                Account / Hotline: <strong style={{ color: 'var(--ink)' }}>{qrModalInfo.accountNo}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <a
                href={qrModalInfo.imageSrc}
                download
                className="btn-hero-primary"
                style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', fontSize: '0.88rem' }}
              >
                Save / Download QR
              </a>
              <button
                type="button"
                onClick={() => setQrModalInfo(null)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', color: 'var(--ink)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Checkout Modal for PayMongo dynamic QR Ph */}
      {isPayMongoModalOpen && (
        <EmbeddedCheckoutModal
          isOpen={isPayMongoModalOpen}
          onClose={() => setIsPayMongoModalOpen(false)}
          bookingId={tempBookingRef}
          packageName={currentPkg.name}
          amount={payableAmount}
          customerName={clientName || 'Valued Client'}
          customerEmail={clientEmail || ''}
          customerPhone={clientPhone || ''}
          onPaymentSuccess={(ref) => {
            setIsPayMongoModalOpen(false)
            setGcashRefNumber(ref)
            setProofFileName(`PayMongo Live Transaction #${ref}`)
            setProofOfPaymentUrl('/sinag_gcash_qr.png')
            setSuccessMsg('PayMongo online payment confirmed! Proceed to final step.')
          }}
        />
      )}
    </div>
  )
}
