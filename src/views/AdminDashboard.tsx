import React, { useState, useMemo, useEffect } from 'react'
import {
  Eye,
  ShieldCheck,
  Trash,
  Trash2,
  X,
  Menu,
  Search,
  Plus,
  LogOut,
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  Star,
  MessageSquare,
  Bell,
  Send,
  CreditCard,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Sparkles,
  CheckCheck,
  Filter,
  ExternalLink,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useConfirm } from '../context/ConfirmContext'
import type { Booking, Inquiry, NotificationLog, Staff } from '../types'
import {
  getNotificationLogs,
  clearNotificationLogs,
  sendSemaphoreSMS,
} from '../lib/notifications'
import { formatMoney } from '../data/packages'

type AdminTabType = 'analytics' | 'bookings' | 'calendar' | 'staff' | 'reviews' | 'inquiries' | 'notifications'

interface AdminDashboardProps {
  onLogout?: () => void
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const {
    bookings,
    staff,
    blockedDates,
    inquiries,
    reviews,
    signIn,
    logout,
    currentUser,
    updateBookingStatus,
    allocateStaff,
    addStaff,
    removeStaff,
    blockDate,
    unblockDate,
    respondInquiry,
    replyReview,
    deleteReview,
    updatePaymentStatus,
    verifyDownpaymentBooking,
    notifyUsers,
    adminNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAdminNotifications,
  } = useApp()

  const { confirm } = useConfirm()

  const ALL_SUBCONTRACTED_SERVICES = [
    'Event Host',
    'Clown / Entertainer',
    'Photo Booth',
    'Photographer',
    'Lights and Sounds',
  ]

  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const getDayOfWeekFromDateStr = (dateStr?: string): string => {
    if (!dateStr) return ''
    const parts = dateStr.split('-').map(Number)
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return ''
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    return DAYS_OF_WEEK[d.getDay()] || ''
  }

  const isStaffOffOnEventDate = (staffMember: Staff, eventDateStr?: string): { isOff: boolean; dayName: string } => {
    if (!eventDateStr) return { isOff: false, dayName: '' }
    const eventDay = getDayOfWeekFromDateStr(eventDateStr)
    if (!eventDay || !staffMember.offDays || staffMember.offDays.length === 0) {
      return { isOff: false, dayName: eventDay }
    }
    const isMatch = staffMember.offDays.some((od: string) => {
      const cleanOd = od.trim().toLowerCase()
      const cleanDay = eventDay.toLowerCase()
      return cleanDay.startsWith(cleanOd.slice(0, 3)) || cleanOd.startsWith(cleanDay.slice(0, 3))
    })
    return { isOff: isMatch, dayName: eventDay }
  }

  // Admin login states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Admin section navigation state
  const [activeTab, setActiveTab] = useState<AdminTabType>('analytics')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Booking detail / staff allocation modal states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [tempStaffIds, setTempStaffIds] = useState<string[]>([])
  const [tempServices, setTempServices] = useState<string[]>([])

  // TrackErentory Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [printScope, setPrintScope] = useState<'all' | 'confirmed' | 'pending' | 'downpayment'>('all')
  const [printDateFilter, setPrintDateFilter] = useState<'all' | 'current_month' | 'today'>('all')

  const handleTriggerPrint = () => {
    setIsPrintModalOpen(false)
    let filteredList = [...bookings]
    if (printScope === 'confirmed') {
      filteredList = filteredList.filter((b) => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed')
    } else if (printScope === 'pending') {
      filteredList = filteredList.filter((b) => b.bookingStatus === 'pending')
    } else if (printScope === 'downpayment') {
      filteredList = filteredList.filter((b) => b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'fully_paid')
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const currentMonthStr = todayStr.slice(0, 7)

    if (printDateFilter === 'today') {
      filteredList = filteredList.filter((b) => b.eventDate === todayStr)
    } else if (printDateFilter === 'current_month') {
      filteredList = filteredList.filter((b) => b.eventDate.startsWith(currentMonthStr))
    }

    const totalRevenue = filteredList.reduce((acc, b) => acc + b.totalPrice, 0)
    const totalDownpayment = filteredList.reduce((acc, b) => acc + (b.downpaymentAmount || (b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'fully_paid' ? b.totalPrice * 0.5 : 0)), 0)

    const reportScopeLabel = printScope === 'all'
      ? 'All Event Reservations'
      : printScope === 'confirmed'
      ? 'Confirmed & Locked Events'
      : printScope === 'pending'
      ? 'Pending Verification Requests'
      : 'Downpayment & Paid Collections'

    const dateScopeLabel = printDateFilter === 'today'
      ? `Today (${todayStr})`
      : printDateFilter === 'current_month'
      ? `Month of ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
      : 'All Scheduled Dates'

    const rowsHtml = filteredList.length === 0
      ? `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#6b7280;">No reservations match this report filter.</td></tr>`
      : filteredList.map((b) => `
        <tr>
          <td><strong style="font-family:monospace;font-size:0.85rem;">#${b.id.slice(0, 14)}</strong></td>
          <td><strong>${b.customerName}</strong><div style="font-size:0.75rem;color:#64748b;">${b.email} | ${b.phone}</div></td>
          <td>${b.eventType} (${b.guestCount} pax)</td>
          <td>${b.eventDate}</td>
          <td><span style="font-size:0.75rem;padding:3px 8px;border-radius:999px;font-weight:700;background:#f3f4f6;text-transform:uppercase;">${b.paymentStatus.replace('_', ' ')}</span></td>
          <td><span style="font-size:0.75rem;padding:3px 8px;border-radius:999px;font-weight:700;background:${b.bookingStatus === 'confirmed' ? '#dcfce7;color:#15803d;' : '#fef3c7;color:#b45309;'}text-transform:uppercase;">${b.bookingStatus}</span></td>
          <td style="text-align:right;font-weight:800;">${formatMoney(b.totalPrice, b.currency)}</td>
        </tr>
      `).join('')

    const reportHtml = `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Sinag Catering - Operations Report</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2.5rem; color: #111827; background: #fff; line-height: 1.4; }
            .toolbar { display: flex; gap: 10px; margin-bottom: 2rem; }
            .toolbar button { background: #000; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
            .toolbar button.secondary { background: #f3f4f6; color: #000; }
            .header { border-bottom: 2px solid #000; padding-bottom: 1.2rem; margin-bottom: 1.5rem; }
            h1 { margin: 0; font-size: 1.6rem; text-transform: uppercase; letter-spacing: -0.02em; }
            h2 { margin: 0.25rem 0 0.75rem; font-size: 1.15rem; color: #4b5563; }
            .meta { display: flex; gap: 2rem; font-size: 0.85rem; color: #4b5563; flex-wrap: wrap; }
            table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; font-size: 0.88rem; }
            th { background: #f4f5f7; border-bottom: 2px solid #e5e7eb; padding: 0.75rem 0.9rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; }
            td { padding: 0.75rem 0.9rem; border-bottom: 1px solid #f3f4f6; }
            tfoot td { background: #f4f5f7; font-weight: 900; border-top: 2px solid #000; padding: 0.9rem; }
            .signatures { display: flex; justify-content: space-between; margin-top: 4rem; padding-top: 1rem; }
            .sig-line { width: 220px; border-bottom: 1px solid #000; margin-bottom: 0.5rem; }
            @media print {
              .toolbar { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button type="button" onclick="window.print()">Print / Save as PDF</button>
            <button type="button" class="secondary" onclick="window.close()">Close</button>
          </div>
          <div class="header">
            <h1>Sinag Catering Services</h1>
            <h2>Executive Operations & Banquet Register Report</h2>
            <div class="meta">
              <span><strong>Scope:</strong> ${reportScopeLabel}</span>
              <span><strong>Period:</strong> ${dateScopeLabel}</span>
              <span><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-PH', { dateStyle: 'long' })}</span>
              <span><strong>Generated By:</strong> ${currentUser?.name || 'Administrator'}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Event & Pax</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Status</th>
                <th style="text-align:right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5"><strong>Overall Total (${filteredList.length} Reservations)</strong></td>
                <td><strong>Deposit: ${formatMoney(totalDownpayment, 'PHP')}</strong></td>
                <td style="text-align:right;"><strong>${formatMoney(totalRevenue, 'PHP')}</strong></td>
              </tr>
            </tfoot>
          </table>

          <div class="signatures">
            <div>
              <div class="sig-line"></div>
              <div style="font-size:0.85rem;font-weight:700;">Prepared By (Operations / Admin)</div>
            </div>
            <div>
              <div class="sig-line"></div>
              <div style="font-size:0.85rem;font-weight:700;">Acknowledged By (Management)</div>
            </div>
          </div>
        </body>
      </html>`

    const printWin = window.open('', '_blank', 'width=1100,height=850')
    if (printWin) {
      printWin.document.open()
      printWin.document.write(reportHtml)
      printWin.document.close()
    } else {
      window.print()
    }
  }

  // Date blocking form state & interactive operations calendar (Item 10)
  const [newBlockDate, setNewBlockDate] = useState('')
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const handlePrevCalMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11)
      setCalYear((prev) => prev - 1)
    } else {
      setCalMonth((prev) => prev - 1)
    }
  }

  const handleNextCalMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0)
      setCalYear((prev) => prev + 1)
    } else {
      setCalMonth((prev) => prev + 1)
    }
  }

  const calDays = useMemo(() => {
    const daysInCurrentMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay()
    const days: { day: number | null; dateStr: string }[] = []

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ day: null, dateStr: '' })
    }

    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const monthStr = String(calMonth + 1).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      days.push({
        day,
        dateStr: `${calYear}-${monthStr}-${dayStr}`,
      })
    }
    return days
  }, [calYear, calMonth])

  // Inquiry reply form state
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [inquiryReplyText, setInquiryReplyText] = useState('')

  // Review reply form state
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null)
  const [reviewReplyText, setReviewReplyText] = useState('')

  // Booking list filters & sorting
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'forfeit'>('all')
  type BookingSortCol = 'id' | 'customerName' | 'eventDate' | 'totalPrice' | 'paymentStatus' | 'bookingStatus'
  const [bookingSortCol, setBookingSortCol] = useState<BookingSortCol>('eventDate')
  const [bookingSortDir, setBookingSortDir] = useState<'asc' | 'desc'>('desc')

  const handleToggleBookingSort = (col: BookingSortCol) => {
    if (bookingSortCol === col) {
      setBookingSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setBookingSortCol(col)
      setBookingSortDir('asc')
    }
  }

  // Sorting state for Concierge Inquiries & Testimonials
  const [inquirySort, setInquirySort] = useState<'newest' | 'oldest' | 'unreplied'>('newest')
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'lowest'>('newest')

  // Downpayment management
  const [showDownpaymentModal, setShowDownpaymentModal] = useState(false)
  const [downpaymentBooking, setDownpaymentBooking] = useState<Booking | null>(null)
  const [downpaymentAmount, setDownpaymentAmount] = useState(0)

  // Add Staff Modal State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState<'waiter' | 'food_attendant'>('waiter')
  const [newStaffAge, setNewStaffAge] = useState(25)
  const [newStaffOffDays, setNewStaffOffDays] = useState<string[]>([])
  const [isSavingStaff, setIsSavingStaff] = useState(false)

  const toggleOffDay = (day: string) => {
    setNewStaffOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim()) return
    setIsSavingStaff(true)
    await addStaff({
      name: newStaffName.trim(),
      role: newStaffRole,
      age: Number(newStaffAge) || 25,
      offDays: newStaffOffDays,
    })
    setIsSavingStaff(false)
    setNewStaffName('')
    setNewStaffRole('waiter')
    setNewStaffAge(25)
    setNewStaffOffDays([])
    setShowAddStaffModal(false)
  }

  const handleRemoveStaff = async (staffMember: Staff) => {
    const confirmed = await confirm({
      title: 'Remove Staff Member',
      message: `Are you sure you want to remove ${staffMember.name} (${staffMember.role.replace('_', ' ')}) from the roster? This action cannot be undone.`,
      confirmText: 'Remove Staff',
      cancelText: 'Keep Staff',
      variant: 'danger',
    })
    if (!confirmed) return
    await removeStaff(staffMember.id)
  }

  // Admin Notification Activity Sub-tab and Filtering
  const [notifSubTab, setNotifSubTab] = useState<'activity' | 'gateway'>('activity')
  const [notifFilter, setNotifFilter] = useState<'all' | 'new' | 'completed' | 'confirmed' | 'inquiries' | 'unread'>('all')

  const unreadNotifCount = adminNotifications.filter((n) => !n.read).length

  const filteredNotifications = useMemo(() => {
    return adminNotifications.filter((n) => {
      if (notifFilter === 'unread') return !n.read
      if (notifFilter === 'new') return n.type === 'booking_new'
      if (notifFilter === 'completed') return n.type === 'booking_completed'
      if (notifFilter === 'confirmed') return n.type === 'booking_confirmed'
      if (notifFilter === 'inquiries') return n.type === 'inquiry_new'
      return true
    })
  }, [adminNotifications, notifFilter])

  const formatRelativeTime = (timestamp: string) => {
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime()
      const diffSec = Math.floor(diffMs / 1000)
      if (diffSec < 60) return 'Just now'
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin}m ago`
      const diffHr = Math.floor(diffMin / 60)
      if (diffHr < 24) return `${diffHr}h ago`
      const diffDay = Math.floor(diffHr / 24)
      if (diffDay < 7) return `${diffDay}d ago`
      return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return timestamp
    }
  }

  const handleClearAllNotifications = async () => {
    const ok = await confirm({
      title: 'Clear All Notifications',
      message: 'Are you sure you want to clear all notification history? This will remove all alerts from the list.',
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (ok) clearAdminNotifications()
  }

  const handleDeleteReview = async (reviewId: string) => {
    const ok = await confirm({
      title: 'Delete Testimonial',
      message: 'Are you sure you want to delete this client testimonial? This cannot be undone.',
      confirmText: 'Delete Review',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (ok) deleteReview(reviewId)
  }

  // Semaphore SMS and Notification Logs state (Item 9)
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() => getNotificationLogs())
  const [testSmsPhone, setTestSmsPhone] = useState('')
  const [testSmsMsg, setTestSmsMsg] = useState('[Sinag Catering] This is a test message.')
  const [isSendingTestSms, setIsSendingTestSms] = useState(false)
  const [testSmsStatus, setTestSmsStatus] = useState('')

  useEffect(() => {
    const handleNotifUpdate = () => {
      setNotificationLogs(getNotificationLogs())
    }
    window.addEventListener('sinag-notification-sent', handleNotifUpdate)
    return () => window.removeEventListener('sinag-notification-sent', handleNotifUpdate)
  }, [])

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testSmsPhone.trim() || !testSmsMsg.trim()) return
    setIsSendingTestSms(true)
    setTestSmsStatus('Sending via Semaphore...')
    const res = await sendSemaphoreSMS(testSmsPhone, testSmsMsg, 'ADMIN-TEST')
    setIsSendingTestSms(false)
    if (res.success) {
      setTestSmsStatus(res.simulated ? 'Dispatched (Simulated live payload logged in register)' : 'Delivered successfully via Semaphore SMS!')
      setNotificationLogs(getNotificationLogs())
    } else {
      setTestSmsStatus(`Failed: ${res.error || 'Network error'}`)
    }
  }

  const handleClearLogs = async () => {
    const ok = await confirm({
      title: 'Clear Audit Logs',
      message: 'Are you sure you want to clear all notification audit logs from browser memory?',
      confirmText: 'Clear Logs',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (ok) {
      clearNotificationLogs()
      setNotificationLogs([])
    }
  }

  const handleLogoutClick = async () => {
    const ok = await confirm({
      title: 'Sign Out of Admin Console',
      message: 'Are you sure you want to end your executive admin session?',
      confirmText: 'Sign Out',
      cancelText: 'Stay Signed In',
      variant: 'primary',
    })
    if (ok) {
      logout()
      if (onLogout) onLogout()
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    const result = await signIn(email, password)
    if (result.error) setLoginError(result.error)
    else if (result.user?.role !== 'admin') setLoginError('This account does not have administrator access.')
  }

  // Analytics Computations
  const analyticsData = useMemo(() => {
    let totalRevenue = 0
    let confirmedCount = 0
    let pendingCount = 0
    let cancelledCount = 0
    let forfeitCount = 0
    let totalGuests = 0
    const packageStats: Record<string, number> = {}
    const dailyBookings: Record<string, number> = {}

    bookings.forEach((b) => {
      // Count bookings per day
      dailyBookings[b.eventDate] = (dailyBookings[b.eventDate] || 0) + 1

      // Revenue calculations: include completed bookings with fully_paid and confirmed bookings
      if ((b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed') && b.paymentStatus === 'fully_paid') {
        totalRevenue += b.totalPrice
      } else if (b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid') {
        const paidAmount = b.downpaymentAmount || (b.totalPrice * 0.5)
        totalRevenue += paidAmount
      }

      // Status counts
      if (b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed') confirmedCount++
      else if (b.bookingStatus === 'pending') pendingCount++
      else if (b.bookingStatus === 'cancelled') cancelledCount++
      else if (b.bookingStatus === 'forfeit') forfeitCount++

      // Guest count
      if (b.bookingStatus !== 'cancelled' && b.bookingStatus !== 'forfeit') {
        totalGuests += b.guestCount
      }

      // Package stats
      packageStats[b.packageName] = (packageStats[b.packageName] || 0) + 1
    })

    let popularPackageName = 'None'
    let maxCount = 0
    Object.entries(packageStats).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count
        popularPackageName = name
      }
    })

    const phpValidBookings = Math.max(1, bookings.filter((booking) =>
      (booking.currency ?? 'PHP') === 'PHP' && ['confirmed', 'completed', 'pending'].includes(booking.bookingStatus),
    ).length)
    const avgBookingValue = totalRevenue / phpValidBookings

    // Most popular date
    let mostPopularDate = 'None'
    let maxDailyBookings = 0
    Object.entries(dailyBookings).forEach(([date, count]) => {
      if (count > maxDailyBookings) {
        maxDailyBookings = count
        mostPopularDate = date
      }
    })

    return {
      totalRevenue,
      confirmedCount,
      pendingCount,
      cancelledCount,
      forfeitCount,
      totalGuests,
      popularPackageName,
      packageStats,
      avgBookingValue,
      dailyBookings,
      mostPopularDate,
      maxDailyBookings,
      totalBookings: bookings.length,
    }
  }, [bookings])

  const getStaffRecommendation = (guestCount: number) => {
    const scale = guestCount / 100
    const waiters = Math.max(1, Math.round(3 * scale))
    const attendants = Math.max(1, Math.round(3 * scale))
    return { waiters, attendants }
  }

  const handleOpenBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking)
    setTempStaffIds(booking.staffIds || [])

    const isFullEntertainment =
      booking.packageId === 'full-blast' ||
      Boolean(booking.packageName && /full blast|entertainment/i.test(booking.packageName))

    let initialServices: string[]
    if (booking.assignedServices && booking.assignedServices.length > 0) {
      initialServices = [...booking.assignedServices]
    } else if (isFullEntertainment && !(booking as any).servicesExplicitlyModified) {
      initialServices = [...ALL_SUBCONTRACTED_SERVICES]
    } else {
      initialServices = booking.assignedServices || []
    }

    setTempServices(initialServices)
    setShowBookingModal(true)
  }

  const handleSaveStaffAllocation = () => {
    if (!selectedBooking) return
    allocateStaff(selectedBooking.id, tempStaffIds, tempServices)
    setSelectedBooking((prev) =>
      prev ? { ...prev, staffIds: tempStaffIds, assignedServices: tempServices, servicesExplicitlyModified: true } : null
    )
    alert('Roster and subcontracted service assignments saved successfully.')
    setShowBookingModal(false)
  }

  const toggleStaffSelection = (id: string) => {
    setTempStaffIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }
  const toggleServiceSelection = (service: string) => setTempServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service])

  const handleFullPayment = async (booking: Booking) => {
    const remainingBalance = booking.totalPrice - (booking.downpaymentAmount || (booking.totalPrice * 0.5))
    const ok = await confirm({
      title: 'Record Full Settlement',
      message: `Confirm receipt of remaining 50% balance (${formatMoney(remainingBalance, booking.currency)}) for Booking #${booking.id} (${booking.customerName})?\n\nThis will mark the reservation as Fully Paid and move status to Completed.`,
      confirmText: 'Confirm Settlement',
      cancelText: 'Cancel',
      variant: 'success',
    })
    if (!ok) return
    updatePaymentStatus(booking.id, 'fully_paid', booking.totalPrice)
  }

  const handleBlockDateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBlockDate) return
    blockDate(newBlockDate)
    setNewBlockDate('')
    alert('Date successfully blocked on calendar.')
  }

  const handleInquiryReplySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInquiry || !inquiryReplyText.trim()) return
    respondInquiry(selectedInquiry.id, inquiryReplyText)
    setInquiryReplyText('')
    setSelectedInquiry(null)
    alert('Reply successfully sent.')
  }

  const handleReviewReplySubmit = (e: React.FormEvent, reviewId: string) => {
    e.preventDefault()
    if (!reviewReplyText.trim()) return
    replyReview(reviewId, reviewReplyText)
    setReviewReplyText('')
    setReplyingReviewId(null)
    alert('Review reply posted.')
  }

  // Handle booking approval with downpayment requirement
  const handleApproveBooking = (booking: Booking) => {
    setDownpaymentBooking(booking)
    setDownpaymentAmount(booking.totalPrice * 0.5)
    setShowDownpaymentModal(true)
  }

  // Process downpayment confirmation & verification
  const handleConfirmDownpayment = async () => {
    if (!downpaymentBooking) return

    const ok = await confirm({
      title: 'Verify Downpayment & Confirm Booking',
      message: `Verify downpayment of ${formatMoney(downpaymentAmount, downpaymentBooking.currency)} for Booking #${downpaymentBooking.id} (${downpaymentBooking.customerName})? This will lock the event date (${downpaymentBooking.eventDate}) and dispatch Semaphore SMS confirmation.`,
      confirmText: 'Confirm & Lock Date',
      cancelText: 'Review Again',
      variant: 'success',
    })
    if (!ok) return

    // Update booking status to confirmed and payment to downpayment_paid, block date, and trigger real alerts
    verifyDownpaymentBooking(downpaymentBooking.id, downpaymentAmount)

    setShowDownpaymentModal(false)
    setShowBookingModal(false)
    setDownpaymentBooking(null)
  }

  // Handle booking rejection
  const handleRejectBooking = async (bookingId: string) => {
    const ok = await confirm({
      title: 'Reject Reservation Request',
      message: 'Are you sure you want to reject this booking? This will cancel the reservation and notify the client.',
      confirmText: 'Reject Reservation',
      cancelText: 'Keep Pending',
      variant: 'danger',
    })
    if (ok) {
      updateBookingStatus(bookingId, 'cancelled')
    }
  }

  // Handle forfeit booking (when downpayment deadline passes)
  const handleForfeitBooking = async (bookingId: string, eventDate: string) => {
    const ok = await confirm({
      title: 'Forfeit Reservation',
      message: `Mark this booking as forfeited? The date (${eventDate}) will immediately become available again for pending clients.`,
      confirmText: 'Forfeit Reservation',
      cancelText: 'Cancel',
      variant: 'warning',
    })
    if (!ok) return

    updateBookingStatus(bookingId, 'forfeit')

    // Unblock the date
    unblockDate(eventDate)

    // Get all pending bookings for this date
    const pendingForDate = bookings.filter(
      b => b.eventDate === eventDate && b.bookingStatus === 'pending'
    )

    // Notify all pending clients that date is available again
    if (pendingForDate.length > 0) {
      const emails = pendingForDate.map(b => b.email)
      notifyUsers(
        emails,
        'Date Available Again!',
        `The date ${eventDate} has become available again. Your booking request is still pending admin approval.`
      )
    }
  }

  // Handle manual date unblock
  const handleManualUnblock = async (date: string) => {
    const ok = await confirm({
      title: 'Unblock Date',
      message: `Unblock ${date}? This will make the date available again for customer bookings.`,
      confirmText: 'Unblock Date',
      cancelText: 'Keep Blocked',
      variant: 'primary',
    })
    if (!ok) return

    unblockDate(date)

    // Check if there are pending bookings for this date
    const pendingForDate = bookings.filter(
      b => b.eventDate === date && b.bookingStatus === 'pending'
    )

    if (pendingForDate.length > 0) {
      const emails = pendingForDate.map(b => b.email)
      notifyUsers(
        emails,
        'Date Available Again!',
        `The date ${date} has become available again. Your booking request is still pending admin approval.`
      )
    }
  }

  const filteredBookings = bookings.filter((b) => {
    const matchesFilter = bookingFilter === 'all' || b.bookingStatus === bookingFilter
    const matchesSearch =
      !searchQuery.trim() ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Sorted bookings for the crowded register
  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      let valA: string | number = a[bookingSortCol] ?? ''
      let valB: string | number = b[bookingSortCol] ?? ''

      if (bookingSortCol === 'totalPrice') {
        valA = Number(a.totalPrice) || 0
        valB = Number(b.totalPrice) || 0
      } else if (bookingSortCol === 'eventDate') {
        valA = new Date(a.eventDate).getTime() || 0
        valB = new Date(b.eventDate).getTime() || 0
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = ((valB as string) || '').toLowerCase()
      }

      if (valA < valB) return bookingSortDir === 'asc' ? -1 : 1
      if (valA > valB) return bookingSortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredBookings, bookingSortCol, bookingSortDir])

  // Sorted inquiries
  const sortedInquiries = useMemo(() => {
    return [...inquiries].sort((a, b) => {
      if (inquirySort === 'unreplied') {
        if (!a.replied && b.replied) return -1
        if (a.replied && !b.replied) return 1
      }
      if (inquirySort === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [inquiries, inquirySort])

  // Sorted reviews
  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (reviewSort === 'highest') {
        return b.rating - a.rating
      }
      if (reviewSort === 'lowest') {
        return a.rating - b.rating
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [reviews, reviewSort])

  // Auth Screen for Admin
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="admin-dashboard-wrapper" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC', padding: '40px' }}>
        <div className="portal-auth-card" style={{ maxWidth: '480px', width: '100%', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src="/sinag_logo.png" alt="Sinag Catering" style={{ width: '54px', height: '54px', marginBottom: '12px' }} />
            <h2 className="portal-auth-title" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '1.75rem', margin: '0 0 6px', color: '#0F172A' }}>Admin Console</h2>
            <p className="portal-auth-sub" style={{ color: '#64748B', fontSize: '0.9rem' }}>Sign in to access executive management dashboards.</p>
          </div>

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Admin Email</label>
              <input
                type="email"
                className="input-field"
                required
                placeholder="admin@sinagcatering.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Password</label>
              <input
                type="password"
                className="input-field"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {loginError && (
              <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {loginError}
              </p>
            )}

            <button type="submit" className="btn-admin-action" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              Unlock Executive Workspace <ShieldCheck size={18} />
            </button>
          </form>

          <div className="demo-login-bar" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8' }}>
              Quick Autofill:
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@sinagcatering.ph')
                setPassword('admin123')
              }}
              className="btn-demo-chip"
              style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <KeyRound size={14} /> Autofill Admin Credentials
            </button>
          </div>
        </div>
      </div>
    )
  }

  const navSections: {
    group: string
    items: { id: AdminTabType; label: string; icon: React.ReactNode; badge?: number }[]
  }[] = [
      {
        group: 'OVERVIEW',
        items: [
          { id: 'analytics', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
          { id: 'bookings', label: 'Bookings Register', icon: <BookOpen size={18} />, badge: bookings.filter(b => b.bookingStatus === 'pending').length },
          { id: 'calendar', label: 'Date Availability', icon: <Calendar size={18} /> },
        ],
      },
      {
        group: 'OPERATIONS',
        items: [
          { id: 'staff', label: 'Staff Roster', icon: <Users size={18} />, badge: staff.length },
          { id: 'reviews', label: 'Reviews Moderation', icon: <Star size={18} />, badge: reviews.length },
        ],
      },
      {
        group: 'COMMUNICATIONS',
        items: [
          { id: 'inquiries', label: 'Inquiry Inbox', icon: <MessageSquare size={18} />, badge: inquiries.filter(i => !i.replied).length },
          { id: 'notifications', label: 'Notifications & Alerts', icon: <Bell size={18} />, badge: unreadNotifCount },
        ],
      },
    ]

  return (
    <div className="admin-workspace">
      {/* Off-canvas mobile drawer backdrop */}
      {isDrawerOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dark Sidebar - Dedicated Executive Navigation */}
      <aside className={`admin-sidebar ${isDrawerOpen ? 'open' : ''}`}>
        <div>
          <div className="admin-sidebar-header">
            <div className="admin-sidebar-logo-box">
              <img src="/sinag_logo.png" alt="Sinag Logo" className="admin-sidebar-logo" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="admin-sidebar-title">Sinag Catering</h2>
              <span className="admin-sidebar-tag">Operations Suite</span>
            </div>
            <button
              type="button"
              className="admin-sidebar-close-btn"
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close sidebar menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="admin-sidebar-menu">
            {navSections.map((section) => (
              <div key={section.group}>
                <div className="admin-menu-group-label">{section.group}</div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    className={`admin-nav-link ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab(item.id)
                      setIsDrawerOpen(false)
                    }}
                  >
                    <div className="admin-nav-link-content">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="admin-nav-badge">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <div className="admin-avatar">A</div>
            <div>
              <strong style={{ display: 'block', fontSize: '0.86rem', color: '#18181B' }}>{currentUser.name}</strong>
              <span style={{ fontSize: '0.74rem', color: '#71717A', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#71717A', display: 'inline-block' }}></span> Active Session
              </span>
            </div>
          </div>

          <button
            onClick={handleLogoutClick}
            title="Sign out of Admin Suite"
            style={{ background: 'none', border: 'none', color: '#71717A', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="admin-main-canvas">
        {/* Slim utility bar */}
        <div className="admin-utility-bar">
          <button
            onClick={toggleDrawer}
            aria-label="Toggle sidebar menu"
            className="admin-mobile-toggle"
          >
            <Menu size={20} />
          </button>

          <div className="admin-search-box">
            <Search size={15} style={{ color: '#71717A' }} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search reservations, clients, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="admin-notification-bell"
              title="Notifications & Live Activity"
              onClick={() => {
                setActiveTab('notifications')
                setNotifSubTab('activity')
              }}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              <Bell size={16} />
              {unreadNotifCount > 0 && (
                <span
                  className="admin-notification-dot"
                  style={{
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="admin-body-content">
          {/* TRACKERENTORY EDITORIAL HERO STRIP */}
          <div className="hero-strip no-print">
            <div>
              <h1>
                {activeTab === 'analytics'
                  ? 'Executive Overview'
                  : activeTab === 'bookings'
                  ? 'Master Reservations'
                  : activeTab === 'calendar'
                  ? 'Operations Calendar'
                  : activeTab === 'staff'
                  ? 'Staff Deployment'
                  : activeTab === 'reviews'
                  ? 'Reviews & Moderation'
                  : activeTab === 'inquiries'
                  ? 'Customer Inquiries'
                  : 'Notifications & Activity Hub'}
              </h1>
              <p className="lede">
                Welcome back, <strong>{currentUser.name}</strong>. Real-time banquet schedules, verified downpayments, kitchen staffing, and revenue registers.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="btn" type="button" onClick={() => setIsPrintModalOpen(true)}>
                <Printer size={16} /> Print Report
              </button>
            </div>
          </div>

          {/* KPI Stats Cards — show on analytics tab */}
          {activeTab === 'analytics' && (
            <>
              <div className="stat-grid">
                <div className="stat">
                  <div className="label">Gross Revenue</div>
                  <div className="value">{formatMoney(analyticsData.totalRevenue, 'PHP')}</div>
                  <div className="subtext">Active & confirmed event packages</div>
                </div>

                <div className="stat">
                  <div className="label">Confirmed Events</div>
                  <div className="value">{analyticsData.confirmedCount}</div>
                  <div className="subtext">Locked in catering calendar</div>
                </div>

                <div className="stat">
                  <div className="label">Pending Approval</div>
                  <div className="value" style={{ color: '#d97706' }}>{analyticsData.pendingCount}</div>
                  <div className="subtext">Awaiting admin or deposit check</div>
                </div>

                <div className="stat">
                  <div className="label">Avg. Booking Value</div>
                  <div className="value">{formatMoney(analyticsData.avgBookingValue, 'PHP')}</div>
                  <div className="subtext">Average spend per client reservation</div>
                </div>

                <div className="stat">
                  <div className="label">Guests Served</div>
                  <div className="value">{analyticsData.totalGuests.toLocaleString()}</div>
                  <div className="subtext">Total attendees across all events</div>
                </div>

              </div>

              {/* Charts Grid */}
              <div className="admin-charts-grid">
                {/* Revenue Breakdown */}
                <div className="admin-chart-card">
                  <div className="admin-chart-header">
                    <div>
                      <h3 className="admin-chart-title">Revenue Breakdown</h3>
                      <p className="admin-chart-subtitle">By booking status across all reservations</p>
                    </div>
                    <span className="admin-chart-badge">Live</span>
                  </div>
                  <div className="admin-chart-body">
                    {(() => {
                      const phpBookings = bookings.filter((booking) => (booking.currency ?? 'PHP') === 'PHP')
                      const fullyPaidRev = phpBookings.filter(b => (b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed') && b.paymentStatus === 'fully_paid').reduce((s, b) => s + b.totalPrice, 0)
                      const downpaymentRev = phpBookings.filter(b => b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid').reduce((s, b) => s + (b.downpaymentAmount || b.totalPrice * 0.5), 0)
                      const pendingRev = phpBookings.filter(b => b.bookingStatus === 'pending').reduce((s, b) => s + b.totalPrice, 0)
                      const cancelledRev = phpBookings.filter(b => b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit').reduce((s, b) => s + b.totalPrice, 0)
                      const maxRev = Math.max(fullyPaidRev, downpaymentRev, pendingRev, cancelledRev, 1)
                      const bars = [
                        { label: 'Fully Paid', value: fullyPaidRev, color: '#059669', bg: '#D1FAE5' },
                        { label: 'Downpayment', value: downpaymentRev, color: '#D97706', bg: '#FEF3C7' },
                        { label: 'Pending', value: pendingRev, color: '#CA8A04', bg: '#FEF9C3' },
                        { label: 'Cancelled', value: cancelledRev, color: '#9CA3AF', bg: '#F3F4F6' },
                      ]
                      return (
                        <div className="admin-bar-chart">
                          {bars.map((bar) => (
                            <div key={bar.label} className="admin-bar-row">
                              <div className="admin-bar-label">
                                <span className="admin-bar-dot" style={{ background: bar.color }} />
                                {bar.label}
                              </div>
                              <div className="admin-bar-track">
                                <div
                                  className="admin-bar-fill"
                                  style={{
                                    width: `${Math.max(4, (bar.value / maxRev) * 100)}%`,
                                    background: bar.color,
                                  }}
                                />
                              </div>
                              <span className="admin-bar-value">{formatMoney(bar.value, 'PHP')}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Package Popularity */}
                <div className="admin-chart-card">
                  <div className="admin-chart-header">
                    <div>
                      <h3 className="admin-chart-title">Package Popularity</h3>
                      <p className="admin-chart-subtitle">Distribution of bookings by package tier</p>
                    </div>
                  </div>
                  <div className="admin-chart-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
                    {(() => {
                      const entries = Object.entries(analyticsData.packageStats)
                      const total = entries.reduce((s, [, c]) => s + c, 0) || 1
                      const colors = ['#C2410C', '#D97706', '#8B5CF6', '#3B82F6', '#10B981', '#EC4899']
                      let cumulativePct = 0

                      return (
                        <>
                          <svg viewBox="0 0 160 160" style={{ width: '140px', height: '140px' }}>
                            {entries.length === 0 ? (
                              <circle cx="80" cy="80" r="60" fill="none" stroke="#E2E8F0" strokeWidth="20" />
                            ) : (
                              entries.map(([name, count], i) => {
                                const pct = count / total
                                const dashArray = pct * 377
                                const dashOffset = -cumulativePct * 377
                                cumulativePct += pct
                                return (
                                  <circle
                                    key={name}
                                    cx="80"
                                    cy="80"
                                    r="60"
                                    fill="none"
                                    stroke={colors[i % colors.length]}
                                    strokeWidth="20"
                                    strokeDasharray={`${dashArray} ${377 - dashArray}`}
                                    strokeDashoffset={dashOffset}
                                    style={{ transition: 'stroke-dasharray 0.6s ease' }}
                                  />
                                )
                              })
                            )}
                            <text x="80" y="76" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0F172A">{total}</text>
                            <text x="80" y="94" textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">BOOKINGS</text>
                          </svg>

                          <div className="admin-donut-legend">
                            {entries.map(([name, count], i) => (
                              <div key={name} className="admin-legend-item">
                                <span className="admin-legend-dot" style={{ background: colors[i % colors.length] }} />
                                <span className="admin-legend-name">{name}</span>
                                <span className="admin-legend-count">{count} ({Math.round((count / total) * 100)}%)</span>
                              </div>
                            ))}
                            {entries.length === 0 && (
                              <div className="admin-legend-item">
                                <span className="admin-legend-dot" style={{ background: '#E2E8F0' }} />
                                <span className="admin-legend-name" style={{ color: '#94A3B8' }}>No bookings yet</span>
                              </div>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Popular Dates */}
              <div className="admin-chart-card" style={{ marginTop: '24px' }}>
                <div className="admin-chart-header">
                  <div>
                    <h3 className="admin-chart-title">Booking Density</h3>
                    <p className="admin-chart-subtitle">Most popular dates with booking counts</p>
                  </div>
                  <span className="admin-chart-badge">
                    {analyticsData.mostPopularDate !== 'None' ? `${analyticsData.maxDailyBookings} bookings on ${analyticsData.mostPopularDate}` : 'No bookings yet'}
                  </span>
                </div>
                <div style={{ padding: '0', maxHeight: '200px', overflowY: 'auto' }}>
                  {Object.entries(analyticsData.dailyBookings)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([date, count]) => (
                      <div key={date} className="admin-activity-row">
                        <div className="admin-activity-avatar" style={{
                          background: count >= 5 ? '#FEE2E2' : count >= 3 ? '#FEF3C7' : '#D1FAE5',
                          color: count >= 5 ? '#DC2626' : count >= 3 ? '#D97706' : '#059669',
                        }}>
                          {count}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>{date}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                            {count} booking{count > 1 ? 's' : ''} on this date
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: count >= 5 ? '#DC2626' : count >= 3 ? '#D97706' : '#059669',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: count >= 5 ? '#DC2626' : count >= 3 ? '#D97706' : '#059669'
                          }} />
                          {count >= 5 ? 'High' : count >= 3 ? 'Medium' : 'Low'}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="admin-chart-card" style={{ marginTop: '24px' }}>
                <div className="admin-chart-header">
                  <div>
                    <h3 className="admin-chart-title">Recent Activity</h3>
                    <p className="admin-chart-subtitle">Latest booking submissions</p>
                  </div>
                  <button className="admin-chart-badge" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setActiveTab('bookings')}>View All →</button>
                </div>
                <div style={{ padding: '0' }}>
                  {bookings.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>No bookings to display.</div>
                  ) : (
                    bookings.slice(0, 5).map((b, i) => (
                      <div
                        key={b.id}
                        className="admin-activity-row"
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <div className="admin-activity-avatar" style={{
                          background: b.bookingStatus === 'confirmed' ? '#D1FAE5' : b.bookingStatus === 'pending' ? '#FEF3C7' : '#FEE2E2',
                          color: b.bookingStatus === 'confirmed' ? '#059669' : b.bookingStatus === 'pending' ? '#D97706' : '#DC2626',
                        }}>
                          {b.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>{b.customerName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748B' }}>{b.eventType} · {b.guestCount} guests · {b.eventDate}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>{formatMoney(b.totalPrice, b.currency)}</div>
                          <span className={`admin-status-pill admin-status-${b.bookingStatus}`}>
                            {b.bookingStatus === 'forfeit' ? 'Forfeited' : b.bookingStatus}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Tab 2: Bookings Management */}
          {activeTab === 'bookings' && (
            <div className="data-table-card">
              <div style={{ padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EBE4D8', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>Master Reservations Register</h3>
                  <span style={{ fontSize: '0.84rem', color: '#71717A' }}>Filter, verify deposits, allocate event staff, and download contracts</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div className="admin-filter-bar">
                    {(['all', 'pending', 'confirmed', 'completed', 'cancelled', 'forfeit'] as const).map((filter) => {
                      const count = filter === 'all'
                        ? bookings.length
                        : bookings.filter((b) => b.bookingStatus === filter).length
                      return (
                        <button
                          key={filter}
                          onClick={() => setBookingFilter(filter)}
                          className={`admin-filter-pill ${bookingFilter === filter ? 'active' : ''}`}
                        >
                          {filter.toUpperCase()} ({count})
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Sort:
                    </span>
                    <select
                      className="admin-sort-select"
                      aria-label="Sort bookings register"
                      value={`${bookingSortCol}-${bookingSortDir}`}
                      onChange={(e) => {
                        const [col, dir] = e.target.value.split('-') as [BookingSortCol, 'asc' | 'desc']
                        setBookingSortCol(col)
                        setBookingSortDir(dir)
                      }}
                    >
                      <option value="eventDate-desc">Date (Newest First)</option>
                      <option value="eventDate-asc">Date (Oldest First)</option>
                      <option value="totalPrice-desc">Total Amount (Highest)</option>
                      <option value="totalPrice-asc">Total Amount (Lowest)</option>
                      <option value="customerName-asc">Client Name (A–Z)</option>
                      <option value="customerName-desc">Client Name (Z–A)</option>
                      <option value="bookingStatus-asc">Booking Status (A–Z)</option>
                      <option value="paymentStatus-asc">Payment Status (A–Z)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th
                        onClick={() => handleToggleBookingSort('id')}
                        className="sortable-th"
                        title="Sort by REF ID"
                      >
                        <div className="sortable-th-content">
                          <span>REF ID</span>
                          {bookingSortCol === 'id' ? (
                            bookingSortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#18181b' }} /> : <ArrowDown size={13} style={{ color: '#18181b' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleToggleBookingSort('customerName')}
                        className="sortable-th"
                        title="Sort by Client Name"
                      >
                        <div className="sortable-th-content">
                          <span>Client</span>
                          {bookingSortCol === 'customerName' ? (
                            bookingSortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#18181b' }} /> : <ArrowDown size={13} style={{ color: '#18181b' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleToggleBookingSort('eventDate')}
                        className="sortable-th"
                        title="Sort by Event Date"
                      >
                        <div className="sortable-th-content">
                          <span>Event & Date</span>
                          {bookingSortCol === 'eventDate' ? (
                            bookingSortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#18181b' }} /> : <ArrowDown size={13} style={{ color: '#18181b' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleToggleBookingSort('totalPrice')}
                        className="sortable-th"
                        title="Sort by Total Amount"
                      >
                        <div className="sortable-th-content">
                          <span>Total Amount</span>
                          {bookingSortCol === 'totalPrice' ? (
                            bookingSortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#18181b' }} /> : <ArrowDown size={13} style={{ color: '#18181b' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleToggleBookingSort('paymentStatus')}
                        className="sortable-th"
                        title="Sort by Payment Status"
                      >
                        <div className="sortable-th-content">
                          <span>Payment</span>
                          {bookingSortCol === 'paymentStatus' ? (
                            bookingSortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#18181b' }} /> : <ArrowDown size={13} style={{ color: '#18181b' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleToggleBookingSort('bookingStatus')}
                        className="sortable-th"
                        title="Sort by Booking Status"
                      >
                        <div className="sortable-th-content">
                          <span>Status</span>
                          {bookingSortCol === 'bookingStatus' ? (
                            bookingSortDir === 'asc' ? <ArrowUp size={13} style={{ color: '#18181b' }} /> : <ArrowDown size={13} style={{ color: '#18181b' }} />
                          ) : (
                            <ArrowUpDown size={13} style={{ opacity: 0.35 }} />
                          )}
                        </div>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBookings.map((b) => (
                      <tr key={b.id}>
                        <td className="font-number" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#78716C' }}>
                          #{b.id.slice(0, 14)}...
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#18181B' }}>{b.customerName}</div>
                          <div style={{ fontSize: '0.8rem', color: '#71717A' }}>{b.email}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#18181B' }}>{b.eventType} ({b.guestCount} pax)</div>
                          <div style={{ fontSize: '0.82rem', color: '#71717A' }}>{b.eventDate}</div>
                        </td>
                        <td className="font-number" style={{ fontWeight: 700, color: '#9A3412' }}>
                          {formatMoney(b.totalPrice, b.currency)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                            <span className={`portal-status-badge badge-payment-${b.paymentStatus}`} style={{ width: 'fit-content' }}>
                              <span className="status-dot" />
                              <span style={{ textTransform: 'capitalize' }}>
                                {b.paymentStatus === 'downpayment_paid' ? 'Downpayment' : b.paymentStatus.replace('_', ' ')}
                              </span>
                            </span>
                            {b.paymentStatus === 'downpayment_paid' && b.downpaymentAmount && (
                              <span style={{ fontSize: '0.72rem', color: '#71717A' }}>
                                {formatMoney(b.downpaymentAmount, b.currency)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`portal-status-badge badge-${b.bookingStatus}`} style={{ width: 'fit-content' }}>
                            <span className="status-dot" />
                            <span style={{ textTransform: 'capitalize' }}>
                              {b.bookingStatus === 'forfeit' ? 'Forfeited' : b.bookingStatus}
                            </span>
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleOpenBookingDetails(b)}
                              className="btn-action-view"
                            >
                              <Eye size={13} /> View
                            </button>

                            {b.bookingStatus === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveBooking(b)}
                                  className="btn-action-approve"
                                >
                                  <Check size={13} /> Approve
                                </button>
                                <button
                                  onClick={() => handleRejectBooking(b.id)}
                                  className="btn-action-forfeit"
                                  style={{ color: '#DC2626' }}
                                >
                                  <X size={13} /> Reject
                                </button>
                              </>
                            )}

                            {b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid' && (
                              <button
                                onClick={() => handleFullPayment(b)}
                                className="btn-action-fullpay"
                              >
                                <CreditCard size={13} /> Settle Full
                              </button>
                            )}

                            {(b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed') && (
                              <button
                                onClick={() => handleForfeitBooking(b.id, b.eventDate)}
                                className="btn-action-forfeit"
                              >
                                <Ban size={13} /> Forfeit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Calendar Date Availability & Blocking Coordinator (Item 10) */}
          {activeTab === 'calendar' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
                    Master Operations Calendar & Date Availability
                  </h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                    Live reservation calendar synced with bookings register. Switch months, click any dated event to inspect or manage, and lock out dates.
                  </p>
                </div>
              </div>

              {/* Date blocking coordinator form */}
              <form onSubmit={handleBlockDateSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '520px', marginBottom: '28px', flexWrap: 'wrap' }}>
                <input
                  type="date"
                  className="input-field"
                  required
                  value={newBlockDate}
                  onChange={(e) => setNewBlockDate(e.target.value)}
                  style={{ flex: 1, minWidth: '180px' }}
                />
                <button type="submit" className="btn-action-forfeit" style={{ background: '#DC2626', color: '#FFF', borderColor: '#DC2626', padding: '10px 18px', fontSize: '0.85rem' }}>
                  <Ban size={15} /> Lock / Block Date
                </button>
              </form>

              {/* Interactive Calendar Grid Matching Client Design */}
              <div className="calendar-card" style={{ maxWidth: '100%', margin: '0 0 32px' }}>
                <div className="calendar-header-bar">
                  <button type="button" className="stepper-btn" onClick={handlePrevCalMonth}>&lt;</button>
                  <h3 className="calendar-month-title" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: '1.3rem', color: '#18181B' }}>{monthsList[calMonth]} {calYear}</h3>
                  <button type="button" className="stepper-btn" onClick={handleNextCalMonth}>&gt;</button>
                </div>

                <div className="calendar-grid-header">
                  <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                </div>

                <div className="calendar-days-grid" style={{ minHeight: '360px' }}>
                  {calDays.map((item, idx) => {
                    if (!item.day) return <div key={`empty-admin-${idx}`} className="calendar-day-cell empty" />

                    const isBlocked = blockedDates.includes(item.dateStr)
                    const dayBookings = bookings.filter((booking) => booking.eventDate === item.dateStr)
                    const confirmedBookings = dayBookings.filter((b) => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed')
                    const pendingBookings = dayBookings.filter((b) => b.bookingStatus === 'pending')

                    let cellState = 'available'
                    if (isBlocked) cellState = 'blocked'
                    else if (confirmedBookings.length > 0) cellState = 'booked'
                    else if (pendingBookings.length > 0) cellState = 'pending-booking'

                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        className={`calendar-day-cell ${cellState}`}
                        style={{ minHeight: '82px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '8px', cursor: 'pointer' }}
                        onClick={() => {
                          setNewBlockDate(item.dateStr)
                          if (dayBookings.length > 0) {
                            handleOpenBookingDetails(dayBookings[0])
                          } else if (isBlocked) {
                            handleManualUnblock(item.dateStr)
                          }
                        }}
                        title={
                          isBlocked
                            ? `Date ${item.dateStr} is BLOCKED. Click to unblock.`
                            : dayBookings.length > 0
                            ? `Date ${item.dateStr} has ${dayBookings.length} booking(s). Click to inspect.`
                            : `Date ${item.dateStr} is available. Click to select for blocking.`
                        }
                      >
                        <span className="calendar-day-number" style={{ fontWeight: 700 }}>{item.day}</span>
                        {isBlocked ? (
                          <span className="calendar-blocked-tag" style={{ marginTop: 'auto' }}>
                            Blocked
                          </span>
                        ) : confirmedBookings.length > 0 ? (
                          <span className="calendar-count-tag" style={{ marginTop: 'auto' }}>
                            {confirmedBookings.length} Confirmed
                          </span>
                        ) : pendingBookings.length > 0 ? (
                          <span className="calendar-pending-tag" style={{ marginTop: 'auto' }}>
                            {pendingBookings.length} Pending
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#10B981', marginTop: 'auto', fontWeight: 600 }}>
                            Available
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="calendar-legend-bar">
                  <div className="legend-item"><span className="legend-dot available" /> Available Date</div>
                  <div className="legend-item"><span className="legend-dot booked" /> Confirmed / Completed Event</div>
                  <div className="legend-item"><span className="legend-dot pending-booking" /> Pending Client Request</div>
                  <div className="legend-item"><span className="legend-dot blocked" /> Blocked Date</div>
                </div>
              </div>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
                Currently Blocked Calendar Dates ({blockedDates.length}):
              </h4>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {blockedDates.length === 0 ? (
                  <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No dates blocked manually.</span>
                ) : (
                  blockedDates.map((date) => (
                    <div key={date} style={{ background: '#FCE8E6', color: '#C5221F', border: '1px solid #F8D7D2', padding: '8px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{date}</span>
                      <button onClick={() => handleManualUnblock(date)} style={{ background: 'none', border: 'none', color: '#C5221F', cursor: 'pointer', fontWeight: 700 }}>&times;</button>
                    </div>
                  ))
                )}
              </div>

              {/* Show booking density for dates */}
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
                  Booking Density by Date:
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                  {Object.entries(analyticsData.dailyBookings)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20)
                    .map(([date, count]) => (
                      <div key={date} style={{
                        padding: '8px 12px',
                        background: count >= 5 ? '#FEE2E2' : count >= 3 ? '#FEF3C7' : '#D1FAE5',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem'
                      }}>
                        <span>{date}</span>
                        <span style={{ fontWeight: 700, color: count >= 5 ? '#DC2626' : count >= 3 ? '#D97706' : '#059669' }}>
                          {count} booking{count > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Staff Allocation */}
          {activeTab === 'staff' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>Service Staff Directory</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>Active personnel list for banquet deployment, age profile & scheduled off-days.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(true)}
                  className="btn-submit-primary"
                  style={{ padding: '9px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} /> Add Staff
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
                {staff.map((s) => {
                  const offDaysFormatted = s.offDays && s.offDays.length > 0
                    ? s.offDays.map((d) => d.slice(0, 3)).join(', ')
                    : 'None'
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-md)',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '1.05rem', color: '#18181B' }}>{s.name}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--terracotta)', fontWeight: 600, textTransform: 'capitalize' }}>
                              {s.role.replace('_', ' ')}
                            </span>
                            <span style={{ color: '#CBD5E1' }}>•</span>
                            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>
                              Age: {s.age ?? 25}
                            </span>
                          </div>
                        </div>
                        <span className={`status-pill ${s.status === 'available' ? 'confirmed' : 'pending'}`}>
                          {s.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px dashed var(--line)', fontSize: '0.82rem', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Off-Days:</span>
                          <span
                            style={{
                              background: s.offDays && s.offDays.length > 0 ? '#FEF3C7' : '#F1F5F9',
                              color: s.offDays && s.offDays.length > 0 ? '#92400E' : '#64748B',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            {offDaysFormatted}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaff(s)}
                          title={`Remove ${s.name} from staff roster`}
                          style={{
                            background: 'transparent',
                            border: '1px solid #FECACA',
                            color: '#DC2626',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#FEE2E2'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tab 5: Reviews Moderation */}
          {activeTab === 'reviews' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>Testimonial Moderation & Responses</h3>
                  <span style={{ fontSize: '0.84rem', color: '#71717A' }}>Verified client feedback and executive replies ({reviews.length} total)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Sort:
                  </span>
                  <select
                    className="admin-sort-select"
                    aria-label="Sort reviews"
                    value={reviewSort}
                    onChange={(e) => setReviewSort(e.target.value as any)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="highest">Highest Rating (5★ → 1★)</option>
                    <option value="lowest">Lowest Rating (1★ → 5★)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {sortedReviews.map((rev) => (
                  <div key={rev.id} style={{ background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <strong>{rev.userName}</strong> ({rev.rating} / 5 stars)
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{rev.date}</div>
                      </div>
                      <button onClick={() => handleDeleteReview(rev.id)} className="btn-nav-logout" style={{ color: 'var(--terracotta)' }}>
                        <Trash size={14} /> Remove
                      </button>
                    </div>
                    <p style={{ fontStyle: 'italic', margin: '0 0 14px' }}>"{rev.comment}"</p>

                    {rev.reply ? (
                      <div style={{ background: '#FFF', padding: '12px 16px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--gold)', fontSize: '0.85rem' }}>
                        <strong>Our Response:</strong> {rev.reply}
                      </div>
                    ) : (
                      <div>
                        {replyingReviewId === rev.id ? (
                          <form onSubmit={(e) => handleReviewReplySubmit(e, rev.id)}>
                            <textarea
                              className="input-field"
                              rows={2}
                              placeholder="Write formal response..."
                              value={reviewReplyText}
                              onChange={(e) => setReviewReplyText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button type="button" onClick={() => setReplyingReviewId(null)} className="btn-nav-logout">Cancel</button>
                              <button type="submit" className="btn-submit-primary" style={{ width: 'auto', padding: '8px 16px' }}>Post Reply</button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => setReplyingReviewId(rev.id)} className="btn-nav-logout">
                            Reply to Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 6: Inquiry Inbox */}
          {activeTab === 'inquiries' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>Customer Concierge Inquiry Inbox</h3>
                  <span style={{ fontSize: '0.84rem', color: '#71717A' }}>
                    {inquiries.filter(i => !i.replied).length} unanswered inquiries
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Sort:
                  </span>
                  <select
                    className="admin-sort-select"
                    aria-label="Sort inquiries"
                    value={inquirySort}
                    onChange={(e) => setInquirySort(e.target.value as any)}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="unreplied">Unanswered First</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {sortedInquiries.map((inq) => (
                  <div key={inq.id} style={{ background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <strong>{inq.customerName}</strong> ({inq.email})
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{inq.date.split('T')[0]}</div>
                      </div>
                      <span className={`status-pill ${inq.replied ? 'confirmed' : 'pending'}`}>
                        {inq.replied ? 'REPLIED' : 'UNANSWERED'}
                      </span>
                    </div>

                    <p style={{ margin: '0 0 14px' }}><strong>Question:</strong> "{inq.message}"</p>

                    {inq.replied ? (
                      <div style={{ background: '#FFF', padding: '12px 16px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--gold)', fontSize: '0.85rem' }}>
                        <strong>Concierge Reply:</strong> {inq.replyText}
                      </div>
                    ) : (
                      <div>
                        {selectedInquiry?.id === inq.id ? (
                          <form onSubmit={handleInquiryReplySubmit}>
                            <textarea
                              className="input-field"
                              rows={2}
                              placeholder="Write reply email response..."
                              value={inquiryReplyText}
                              onChange={(e) => setInquiryReplyText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                              <button type="button" onClick={() => setSelectedInquiry(null)} className="btn-nav-logout">Cancel</button>
                              <button type="submit" className="btn-submit-primary" style={{ width: 'auto', padding: '8px 16px' }}>
                                <Send size={14} /> Send Reply
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => { setSelectedInquiry(inq); setInquiryReplyText('') }} className="btn-nav-logout">
                            Respond to Inquiry
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOOKING DETAILS & STAFF ALLOCATION MODAL */}
          {showBookingModal && selectedBooking && (
            <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '800px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#18181B' }}>Booking Inspection & Staffing</h3>
                  <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div className="modal-two-col-grid" style={{ display: 'grid', gap: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Client Contact
                    </h4>
                    <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{selectedBooking.customerName}</p>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--muted)' }}>{selectedBooking.email} | {selectedBooking.phone}</p>

                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Package & Event Details
                    </h4>
                    <p style={{ margin: '0 0 4px' }}><strong>Event:</strong> {selectedBooking.eventType}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Tier:</strong> {selectedBooking.packageName}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Date:</strong> {selectedBooking.eventDate}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Attendees:</strong> {selectedBooking.guestCount} pax</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Total Price:</strong> {formatMoney(selectedBooking.totalPrice, selectedBooking.currency)}</p>
                    <p style={{ margin: '0 0 10px' }}><strong>Payment Status:</strong> {selectedBooking.paymentStatus.replace('_', ' ')}</p>

                    {/* Checklist Item 8: Detailed Menu Breakdown */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                        Catering Menu & Course Selections
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Selected Main Dishes (4 Course):</strong>
                        {selectedBooking.addOns.selectedMainDishes && selectedBooking.addOns.selectedMainDishes.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedBooking.addOns.selectedMainDishes.map((dish) => (
                              <span key={dish} style={{ background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {dish}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>Standard Chef Selection</span>
                        )}
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <strong style={{ fontSize: '0.8rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Selected Pasta Dishes:</strong>
                        {selectedBooking.addOns.selectedPastaDishes && selectedBooking.addOns.selectedPastaDishes.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedBooking.addOns.selectedPastaDishes.map((dish) => (
                              <span key={dish} style={{ background: '#EDE9FE', color: '#6D28D9', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                {dish}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>None specified</span>
                        )}
                      </div>

                      <div>
                        <strong style={{ fontSize: '0.8rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Extra Food Add-ons:</strong>
                        {((selectedBooking.addOns.extraMainDishes && selectedBooking.addOns.extraMainDishes.length > 0) || (selectedBooking.addOns.extraPastaDishes && selectedBooking.addOns.extraPastaDishes.length > 0)) ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedBooking.addOns.extraMainDishes?.map((dish, i) => (
                              <span key={`extra-m-${i}`} style={{ background: '#DCFCE7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                + Extra Main: {dish}
                              </span>
                            ))}
                            {selectedBooking.addOns.extraPastaDishes?.map((dish, i) => (
                              <span key={`extra-p-${i}`} style={{ background: '#DBEAFE', color: '#1E40AF', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                + Extra Pasta: {dish}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>No extra food items added</span>
                        )}
                      </div>
                    </div>

                    {/* Checklist Item 8: Payment Verification Details (GCash Ref & Proof) */}
                    <div style={{ background: 'var(--paper-warm)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
                        Payment Verification Details
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: '0.85rem' }}>
                        <strong>Method:</strong> {selectedBooking.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'QR Ph / GCash'}
                      </p>
                      {selectedBooking.gcashRefNumber ? (
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '8px 12px', borderRadius: '6px', color: '#1E40AF', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: selectedBooking.proofOfPaymentUrl ? '8px' : 0 }}>
                          <span>REF: {selectedBooking.gcashRefNumber}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, background: '#DBEAFE', padding: '2px 6px', borderRadius: '4px' }}>GCash Ref</span>
                        </div>
                      ) : (
                        <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                          <em>No GCash reference submitted</em>
                        </p>
                      )}
                      {selectedBooking.proofOfPaymentUrl && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                          <img
                            src={selectedBooking.proofOfPaymentUrl}
                            alt="Receipt"
                            style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--line)' }}
                          />
                          <a
                            href={selectedBooking.proofOfPaymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.8rem', color: 'var(--terracotta)', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            View Receipt Proof ↗
                          </a>
                        </div>
                      )}
                    </div>

                    {selectedBooking.bookingStatus === 'pending' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button onClick={() => handleApproveBooking(selectedBooking)} className="btn-submit-primary" style={{ background: '#18181B' }}>
                          <ShieldCheck size={16} /> VERIFY DOWNPAYMENT & APPROVE BOOKING
                        </button>
                        <button onClick={() => handleRejectBooking(selectedBooking.id)} className="btn-nav-logout" style={{ color: 'var(--terracotta)' }}>
                          Reject Request
                        </button>
                      </div>
                    )}

                    {selectedBooking.bookingStatus === 'confirmed' && selectedBooking.paymentStatus === 'downpayment_paid' && (
                      <button
                        onClick={() => {
                          handleFullPayment(selectedBooking)
                          setShowBookingModal(false)
                        }}
                        className="btn-action-fullpay"
                        style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                      >
                        <CreditCard size={16} /> Record Full Payment (50% Balance)
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Assign Service Staff
                    </h4>

                    {(() => {
                      const rec = getStaffRecommendation(selectedBooking.guestCount)
                      const eventDay = getDayOfWeekFromDateStr(selectedBooking.eventDate)
                      return (
                        <div style={{ background: 'var(--paper-warm)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '14px', border: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong>Staffing Guideline Ratio:</strong>
                            <span style={{ fontSize: '0.74rem', color: '#1E40AF', background: '#DBEAFE', padding: '1px 7px', borderRadius: '4px', fontWeight: 700 }}>
                              {eventDay ? `Day: ${eventDay}` : 'Scheduled Date'}
                            </span>
                          </div>
                          <div>Recommended: {rec.waiters} Waiters & {rec.attendants} Attendants</div>
                        </div>
                      )
                    })()}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '190px', overflowY: 'auto', marginBottom: '20px', paddingRight: '4px' }}>
                      {staff.map((s) => {
                        const { isOff, dayName } = isStaffOffOnEventDate(s, selectedBooking.eventDate)
                        const isChecked = tempStaffIds.includes(s.id)
                        return (
                          <label
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '0.85rem',
                              cursor: isOff ? 'not-allowed' : 'pointer',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: isOff ? '#F1F5F9' : isChecked ? '#FFF' : 'transparent',
                              border: isOff ? '1px dashed #CBD5E1' : isChecked ? '1.5px solid var(--gold)' : '1px solid var(--line)',
                              opacity: isOff ? 0.55 : 1,
                              transition: 'all 0.15s ease-in-out',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!isOff && isChecked}
                              disabled={isOff}
                              onChange={() => {
                                if (!isOff) toggleStaffSelection(s.id)
                              }}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--terracotta)', cursor: isOff ? 'not-allowed' : 'pointer' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: isChecked && !isOff ? 600 : 400, color: isOff ? '#64748B' : 'var(--obsidian)' }}>
                                {s.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                                ({s.role.replace('_', ' ')}{s.age ? ` · Age: ${s.age}` : ''})
                              </span>
                            </div>

                            {isOff ? (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  background: '#FEE2E2',
                                  color: '#DC2626',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  letterSpacing: '0.04em',
                                  flexShrink: 0,
                                }}
                              >
                                OFF TODAY - {dayName}
                              </span>
                            ) : isChecked ? (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                Assigned
                              </span>
                            ) : null}
                          </label>
                        )
                      })}
                    </div>

                    {/* Checklist Item 8: Subcontracted Services Checklist */}
                    <div style={{ background: 'var(--paper-warm)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', marginBottom: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', margin: 0 }}>
                          Subcontracted Event Services ({tempServices.length} Active)
                        </h4>
                        <span style={{
                          fontSize: '0.72rem',
                          background: tempServices.length > 0 ? '#DCFCE7' : '#F1F5F9',
                          color: tempServices.length > 0 ? '#166534' : '#64748B',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                        }}>
                          {tempServices.length} Active
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {ALL_SUBCONTRACTED_SERVICES.map((service) => {
                          const isChecked = tempServices.includes(service)
                          return (
                            <label
                              key={service}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                background: isChecked ? '#FFF' : 'transparent',
                                border: isChecked ? '1.5px solid var(--gold)' : '1px solid var(--line)',
                                fontWeight: isChecked ? 600 : 400,
                                transition: 'all 0.15s ease-in-out',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleServiceSelection(service)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--terracotta)', cursor: 'pointer' }}
                              />
                              <span style={{ flex: 1, color: isChecked ? 'var(--obsidian)' : 'var(--muted)' }}>{service}</span>
                              {isChecked && (
                                <span style={{ fontSize: '0.7rem', color: '#166534', background: '#DCFCE7', padding: '1px 7px', borderRadius: '4px', fontWeight: 600 }}>
                                  Active
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <button onClick={handleSaveStaffAllocation} className="btn-hero-primary" style={{ width: '100%' }}>
                      Save Roster & Service Assignments
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 7: Notifications & Activity Hub */}
          {activeTab === 'notifications' && (
            <div className="data-table-card" style={{ padding: '32px' }}>
              {/* Dual Sub-tab Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '18px', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setNotifSubTab('activity')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: notifSubTab === 'activity' ? 'var(--gold-dark)' : '#F4EFE6',
                      color: notifSubTab === 'activity' ? '#FFFFFF' : '#4A3E31',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Bell size={16} /> Live Activity & Alerts
                    {unreadNotifCount > 0 && (
                      <span style={{
                        background: notifSubTab === 'activity' ? '#FFFFFF' : '#DC2626',
                        color: notifSubTab === 'activity' ? '#92400E' : '#FFFFFF',
                        borderRadius: '999px',
                        padding: '1px 7px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                      }}>
                        {unreadNotifCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotifSubTab('gateway')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '0.86rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: notifSubTab === 'gateway' ? 'var(--gold-dark)' : '#F4EFE6',
                      color: notifSubTab === 'gateway' ? '#FFFFFF' : '#4A3E31',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Send size={16} /> SMS & Email Gateway
                    {notificationLogs.length > 0 && (
                      <span style={{
                        background: notifSubTab === 'gateway' ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                        color: notifSubTab === 'gateway' ? '#FFFFFF' : '#475569',
                        borderRadius: '999px',
                        padding: '1px 7px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                      }}>
                        {notificationLogs.length}
                      </span>
                    )}
                  </button>
                </div>

                {notifSubTab === 'activity' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={markAllNotificationsAsRead}
                      disabled={unreadNotifCount === 0}
                      className="btn-nav-logout"
                      style={{
                        fontSize: '0.78rem',
                        opacity: unreadNotifCount === 0 ? 0.5 : 1,
                        cursor: unreadNotifCount === 0 ? 'not-allowed' : 'pointer',
                        color: '#059669',
                      }}
                    >
                      <CheckCheck size={14} /> Mark All as Read
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllNotifications}
                      disabled={adminNotifications.length === 0}
                      className="btn-nav-logout"
                      style={{
                        fontSize: '0.78rem',
                        opacity: adminNotifications.length === 0 ? 0.5 : 1,
                        cursor: adminNotifications.length === 0 ? 'not-allowed' : 'pointer',
                        color: 'var(--terracotta)',
                      }}
                    >
                      <Trash2 size={14} /> Clear History
                    </button>
                  </div>
                ) : (
                  <button onClick={handleClearLogs} className="btn-nav-logout" style={{ fontSize: '0.78rem' }}>
                    <Trash size={14} /> Clear Audit Logs
                  </button>
                )}
              </div>

              {/* Subtab 1: Live Activity & Reservation Alerts */}
              {notifSubTab === 'activity' && (
                <div>
                  {/* Summary Metric Ribbon */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px',
                  }}>
                    <div style={{ background: '#FAF7F2', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Alerts</span>
                      <strong style={{ display: 'block', fontSize: '1.4rem', color: '#18181B', marginTop: '2px' }}>{adminNotifications.length}</strong>
                    </div>
                    <div style={{ background: unreadNotifCount > 0 ? '#FEF2F2' : '#F0FDF4', border: '1px solid ' + (unreadNotifCount > 0 ? '#FECACA' : '#BBF7D0'), borderRadius: '8px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.72rem', color: unreadNotifCount > 0 ? '#DC2626' : '#15803D', fontWeight: 700, textTransform: 'uppercase' }}>Unread</span>
                      <strong style={{ display: 'block', fontSize: '1.4rem', color: unreadNotifCount > 0 ? '#DC2626' : '#15803D', marginTop: '2px' }}>{unreadNotifCount}</strong>
                    </div>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#1D4ED8', fontWeight: 700, textTransform: 'uppercase' }}>New Bookings</span>
                      <strong style={{ display: 'block', fontSize: '1.4rem', color: '#1D4ED8', marginTop: '2px' }}>
                        {adminNotifications.filter((n) => n.type === 'booking_new').length}
                      </strong>
                    </div>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>Completed Events</span>
                      <strong style={{ display: 'block', fontSize: '1.4rem', color: '#047857', marginTop: '2px' }}>
                        {adminNotifications.filter((n) => n.type === 'booking_completed').length}
                      </strong>
                    </div>
                  </div>

                  {/* Filter Chips Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Filter size={13} /> Filter:
                    </span>
                    {(
                      [
                        { id: 'all', label: `All (${adminNotifications.length})` },
                        { id: 'unread', label: `Unread (${unreadNotifCount})` },
                        { id: 'new', label: 'New Bookings' },
                        { id: 'completed', label: 'Completed' },
                        { id: 'confirmed', label: 'Confirmed' },
                        { id: 'inquiries', label: 'Inquiries' },
                      ] as const
                    ).map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setNotifFilter(chip.id)}
                        style={{
                          background: notifFilter === chip.id ? 'var(--ink)' : '#FFFFFF',
                          color: notifFilter === chip.id ? '#FFFFFF' : '#475569',
                          border: '1px solid ' + (notifFilter === chip.id ? 'var(--ink)' : 'var(--line)'),
                          borderRadius: '20px',
                          padding: '4px 12px',
                          fontSize: '0.76rem',
                          fontWeight: notifFilter === chip.id ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Activity Stream Feed */}
                  {filteredNotifications.length === 0 ? (
                    <div style={{
                      padding: '48px 20px',
                      textAlign: 'center',
                      background: 'var(--paper-warm)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--line)',
                    }}>
                      <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 14px',
                        color: 'var(--muted)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}>
                        <Bell size={24} />
                      </div>
                      <strong style={{ display: 'block', fontSize: '1rem', color: '#18181B', marginBottom: '4px' }}>
                        No notifications found
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted)' }}>
                        {notifFilter === 'unread'
                          ? 'All caught up! There are no unread notifications right now.'
                          : 'Whenever customers book an event or bookings complete, live alerts will appear here.'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {filteredNotifications.map((notif) => {
                        const targetBooking = notif.bookingId ? bookings.find((b) => b.id === notif.bookingId) : null
                        const isNewBooking = notif.type === 'booking_new'
                        const isCompleted = notif.type === 'booking_completed'
                        const isConfirmed = notif.type === 'booking_confirmed'
                        const isInquiry = notif.type === 'inquiry_new'
                        const isCancelled = notif.type === 'booking_cancelled'

                        const iconBg = isCompleted
                          ? '#D1FAE5'
                          : isConfirmed
                          ? '#E0F2FE'
                          : isNewBooking
                          ? '#FEF3C7'
                          : isInquiry
                          ? '#E0E7FF'
                          : isCancelled
                          ? '#FEE2E2'
                          : '#F3F4F6'

                        const iconColor = isCompleted
                          ? '#059669'
                          : isConfirmed
                          ? '#0284C7'
                          : isNewBooking
                          ? '#D97706'
                          : isInquiry
                          ? '#4F46E5'
                          : isCancelled
                          ? '#DC2626'
                          : '#4B5563'

                        return (
                          <div
                            key={notif.id}
                            style={{
                              background: notif.read ? '#FFFFFF' : '#FFFDF7',
                              border: '1px solid ' + (notif.read ? 'var(--line)' : '#FDE68A'),
                              borderLeft: notif.read ? '1px solid var(--line)' : '4px solid var(--gold)',
                              borderRadius: 'var(--radius-md)',
                              padding: '16px 20px',
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: '16px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: iconBg,
                                color: iconColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                {isCompleted ? (
                                  <CheckCircle2 size={19} />
                                ) : isConfirmed ? (
                                  <ShieldCheck size={19} />
                                ) : isNewBooking ? (
                                  <Sparkles size={19} />
                                ) : isInquiry ? (
                                  <MessageSquare size={19} />
                                ) : isCancelled ? (
                                  <AlertCircle size={19} />
                                ) : (
                                  <Bell size={19} />
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                  <strong style={{ fontSize: '0.94rem', color: '#18181B' }}>{notif.title}</strong>
                                  <span style={{
                                    padding: '1px 8px',
                                    borderRadius: '999px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: iconBg,
                                    color: iconColor,
                                  }}>
                                    {notif.type.replace('_', ' ')}
                                  </span>
                                  {!notif.read && (
                                    <span style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '50%',
                                      background: '#DC2626',
                                      display: 'inline-block',
                                    }} />
                                  )}
                                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                                    <Clock size={12} /> {formatRelativeTime(notif.timestamp)}
                                  </span>
                                </div>

                                <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5 }}>
                                  {notif.message}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {targetBooking && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenBookingDetails(targetBooking)}
                                      className="btn-submit-primary"
                                      style={{
                                        width: 'auto',
                                        padding: '4px 10px',
                                        fontSize: '0.75rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                      }}
                                    >
                                      <Eye size={13} /> View Reservation <ExternalLink size={11} />
                                    </button>
                                  )}
                                  {isInquiry && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('inquiries')}
                                      className="btn-submit-primary"
                                      style={{
                                        width: 'auto',
                                        padding: '4px 10px',
                                        fontSize: '0.75rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                      }}
                                    >
                                      <MessageSquare size={13} /> View Inquiry Inbox
                                    </button>
                                  )}
                                  {!notif.read && (
                                    <button
                                      type="button"
                                      onClick={() => markNotificationAsRead(notif.id)}
                                      style={{
                                        background: 'transparent',
                                        border: '1px solid var(--line)',
                                        color: '#64748B',
                                        borderRadius: '6px',
                                        padding: '4px 10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <Check size={12} /> Mark Read
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Subtab 2: SMS & Email Gateway Logs */}
              {notifSubTab === 'gateway' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
                      Semaphore SMS & Email Transactional Logs
                    </h4>
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', margin: 0 }}>
                      Real-time SMS dispatch register (booking confirmations, downpayment verification alerts, OTPs).
                    </p>
                  </div>

                  {/* Server-side Semaphore dispatch and explicit test send */}
                  <div className="admin-two-col-grid" style={{ display: 'grid', gap: '24px', marginBottom: '32px' }}>
                    {/* Server-side Semaphore configuration */}
                    <div style={{ background: 'var(--paper-warm)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ShieldCheck size={18} style={{ color: 'var(--gold-dark)' }} />
                        <strong style={{ fontSize: '0.95rem' }}>Semaphore SMS Gateway</strong>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 14px' }}>
                        SMS requests are sent through our secure Netlify serverless function or Supabase Edge Function. Store the Semaphore API key as a server secret.
                      </p>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        Status: <strong>Active & Connected</strong>
                      </div>
                    </div>

                    {/* Dispatch Test SMS Form */}
                    <form onSubmit={handleSendTestSms} style={{ background: 'var(--paper-warm)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Send size={18} style={{ color: 'var(--terracotta)' }} />
                        <strong style={{ fontSize: '0.95rem' }}>Send Test SMS</strong>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '12px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Recipient Mobile</label>
                          <input
                            type="tel"
                            className="input-field"
                            placeholder="0928 714 4597"
                            value={testSmsPhone}
                            onChange={(e) => setTestSmsPhone(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Message Body</label>
                          <input
                            type="text"
                            className="input-field"
                            value={testSmsMsg}
                            onChange={(e) => setTestSmsMsg(e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          type="submit"
                          disabled={isSendingTestSms}
                          className="btn-submit-primary"
                          style={{ width: 'auto', padding: '8px 18px', fontSize: '0.78rem' }}
                        >
                          {isSendingTestSms ? 'Dispatching...' : 'Dispatch Test SMS'}
                        </button>
                        {testSmsStatus && (
                          <span style={{ fontSize: '0.78rem', color: testSmsStatus.includes('Failed') ? 'var(--terracotta)' : '#18181B', fontWeight: 600 }}>
                            {testSmsStatus}
                          </span>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Notification Audit Log Register */}
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
                    Dispatched Payload Activity Log ({notificationLogs.length} events):
                  </h4>

                  {notificationLogs.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', background: 'var(--paper-warm)', borderRadius: 'var(--radius-md)', color: 'var(--muted)', fontSize: '0.88rem' }}>
                      No notification events recorded yet. Perform a client registration, booking submission, or downpayment verification to view live events!
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            <th style={{ padding: '10px' }}>Channel</th>
                            <th style={{ padding: '10px' }}>Recipient</th>
                            <th style={{ padding: '10px' }}>Message Payload</th>
                            <th style={{ padding: '10px' }}>Status</th>
                            <th style={{ padding: '10px' }}>Time</th>
                            <th style={{ padding: '10px' }}>Ref</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notificationLogs.map((log) => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '10px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: log.type === 'sms' ? '#FEF3C7' : '#DBEAFE',
                                  color: log.type === 'sms' ? '#D97706' : '#2563EB',
                                }}>
                                  {log.provider}
                                </span>
                              </td>
                              <td style={{ padding: '10px', fontWeight: 600 }}>{log.recipient}</td>
                              <td style={{ padding: '10px', maxWidth: '380px' }}>
                                {log.subject && <strong style={{ display: 'block', color: 'var(--ink)' }}>{log.subject}</strong>}
                                <span style={{ color: 'var(--ink-light)', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>{log.message}</span>
                              </td>
                              <td style={{ padding: '10px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: log.status === 'sent' ? '#D1FAE5' : log.status === 'simulated' ? '#EFF6FF' : '#FEE2E2',
                                  color: log.status === 'sent' ? '#059669' : log.status === 'simulated' ? '#2563EB' : '#DC2626',
                                }}>
                                  {log.status === 'sent' ? 'Delivered' : log.status === 'simulated' ? 'Simulated Live' : 'Failed'}
                                </span>
                              </td>
                              <td style={{ padding: '10px', color: 'var(--muted)', fontSize: '0.75rem' }}>
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td style={{ padding: '10px', color: 'var(--muted)', fontSize: '0.72rem' }}>
                                {log.referenceId || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DOWNPAYMENT VERIFICATION & APPROVAL MODAL (Item 8) */}
          {showDownpaymentModal && downpaymentBooking && (
            <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '560px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#18181B' }}>
                      Verify Downpayment & Approve Booking
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                      Manual Payment Verification Workflow: Cross-check client payment against phone notifications.
                    </p>
                  </div>
                  <button onClick={() => { setShowDownpaymentModal(false); setDownpaymentBooking(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Event & Client Details */}
                <div style={{ background: 'var(--paper-warm)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', marginBottom: '18px' }}>
                  <div className="modal-two-col-grid" style={{ display: 'grid', gap: '10px', fontSize: '0.88rem', marginBottom: '10px' }}>
                    <div>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Client Name</span>
                      <strong>{downpaymentBooking.customerName}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Mobile (Check Phone SMS)</span>
                      <strong>{downpaymentBooking.phone}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Event Schedule</span>
                      <strong>{downpaymentBooking.eventDate} ({downpaymentBooking.eventType})</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Payment Method</span>
                      <strong>{downpaymentBooking.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'QR Ph / GCash'}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Total Estimate</span>
                      <strong>{formatMoney(downpaymentBooking.totalPrice, downpaymentBooking.currency)}</strong>
                    </div>
                  </div>

                  {/* Checklist Item 8: Client GCash Reference Number Display */}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '12px' }}>
                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                      Client's GCash / QR Ph Reference Number:
                    </span>
                    {downpaymentBooking.gcashRefNumber ? (
                      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: '8px', color: '#1E40AF', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>REF: {downpaymentBooking.gcashRefNumber}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>Match with GCash SMS</span>
                      </div>
                    ) : (
                      <div style={{ background: '#FEF3C7', color: '#D97706', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem' }}>
                        No reference number entered during initial request. Please verify via client name: <strong>{downpaymentBooking.customerName}</strong>
                      </div>
                    )}
                  </div>

                  {/* Checklist Item 8: Uploaded Receipt Preview */}
                  {downpaymentBooking.proofOfPaymentUrl && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '12px' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                        Uploaded Payment Receipt Proof:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                          src={downpaymentBooking.proofOfPaymentUrl}
                          alt="Receipt Proof"
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--line)' }}
                        />
                        <div>
                          <a
                            href={downpaymentBooking.proofOfPaymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.82rem', color: 'var(--terracotta)', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            Open Full Resolution Receipt Image ↗
                          </a>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Uploaded by client for verification
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label>Verified Downpayment Amount (PHP)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={downpaymentAmount}
                    onChange={(e) => setDownpaymentAmount(Number(e.target.value))}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                    Required 50% amount: {formatMoney(downpaymentBooking.totalPrice * 0.5, downpaymentBooking.currency)}
                  </span>
                </div>

                <div style={{ background: '#F4F5F7', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#1F2937' }}>
                    <ShieldCheck size={16} style={{ color: '#18181B', verticalAlign: 'middle', marginRight: '6px' }} />
                    <strong>Admin Verification Confirmation:</strong> Clicking the button below confirms that you received the funds. The date will be officially locked, and a real-time Semaphore SMS and Email confirmation will be triggered to the client.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => { setShowDownpaymentModal(false); setDownpaymentBooking(null); }}
                    className="btn-nav-logout"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  {/* Checklist Item 8: Renamed Button Action */}
                  <button
                    onClick={handleConfirmDownpayment}
                    className="btn-submit-primary"
                    style={{ flex: 2, background: '#18181B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <ShieldCheck size={16} /> VERIFY DOWNPAYMENT & APPROVE BOOKING
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TRACKERENTORY REPORT PRINT MODAL */}
          {isPrintModalOpen && (
            <div
              className="modal-overlay"
              onClick={() => setIsPrintModalOpen(false)}
            >
              <div
                className="modal-card"
                style={{
                  maxWidth: '540px',
                  padding: '2rem',
                  borderRadius: '20px',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717A', display: 'block', marginBottom: '4px' }}>
                      OPERATIONS & FINANCIAL AUDIT
                    </span>
                    <h3 style={{ fontFamily: 'var(--font-display, Plus Jakarta Sans, sans-serif)', fontSize: '1.35rem', fontWeight: 900, textTransform: 'uppercase', margin: 0, color: '#000000', letterSpacing: '-0.03em' }}>
                      Generate Printable Report
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsPrintModalOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666666' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <p style={{ fontSize: '0.88rem', color: '#666666', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                  Compile a print-ready PDF audit sheet complete with official company header, financial ledger, attendee headcount, and signature validation.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000000', marginBottom: '6px' }}>
                      Report Category Scope
                    </label>
                    <select
                      value={printScope}
                      onChange={(e) => setPrintScope(e.target.value as any)}
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.9rem', fontWeight: 600 }}
                    >
                      <option value="all">All Event Reservations ({bookings.length})</option>
                      <option value="confirmed">Confirmed & Locked Events Only ({bookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length})</option>
                      <option value="pending">Pending Admin Review & Verifications ({bookings.filter(b => b.bookingStatus === 'pending').length})</option>
                      <option value="downpayment">Paid & Downpayment Collections ({bookings.filter(b => b.paymentStatus === 'downpayment_paid' || b.paymentStatus === 'fully_paid').length})</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000000', marginBottom: '6px' }}>
                      Event Date Period Filter
                    </label>
                    <select
                      value={printDateFilter}
                      onChange={(e) => setPrintDateFilter(e.target.value as any)}
                      style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.9rem', fontWeight: 600 }}
                    >
                      <option value="all">All Scheduled Dates (Full Register)</option>
                      <option value="current_month">Current Month ({new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})</option>
                      <option value="today">Today's Scheduled Events ({new Date().toISOString().slice(0, 10)})</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: '#f4f5f7', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666666', marginBottom: '6px' }}>
                    Document Specifications
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#111827', margin: '4px 0' }}>
                    <span>Header Format:</span>
                    <span>Sinag Catering Executive Letterhead</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, color: '#111827', margin: '4px 0' }}>
                    <span>Validation Section:</span>
                    <span>Dual Signatures (Operations & Management)</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setIsPrintModalOpen(false)}
                    style={{ padding: '0.65rem 1.25rem', borderRadius: '10px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleTriggerPrint}
                    style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Printer size={16} /> Print / Save as PDF
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Add Staff Modal */}
          {showAddStaffModal && (
            <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '540px', width: '90%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E', display: 'grid', placeItems: 'center' }}>
                      <Users size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#18181B' }}>
                        Register Personnel
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                        Add catering crew with age profile and scheduled off-days
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateStaff}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Full Name</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g., Juan Dela Cruz"
                        required
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                      />
                    </div>

                    <div className="modal-two-col-grid" style={{ display: 'grid', gap: '16px' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Role Assignment</label>
                        <select
                          className="input-field"
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value as any)}
                        >
                          <option value="waiter">Waiter</option>
                          <option value="food_attendant">Food Attendant</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Age (Years)</label>
                        <input
                          type="number"
                          className="input-field"
                          min={18}
                          max={65}
                          required
                          value={newStaffAge}
                          onChange={(e) => setNewStaffAge(Math.max(18, Math.min(65, Number(e.target.value))))}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151', margin: 0 }}>
                          Scheduled Off-Days
                        </label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                          {newStaffOffDays.length} Selected
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                          const isSelected = newStaffOffDays.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleOffDay(day)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: isSelected ? 700 : 500,
                                border: isSelected ? '1.5px solid var(--gold)' : '1px solid #D1D5DB',
                                background: isSelected ? '#FEF3C7' : '#FFFFFF',
                                color: isSelected ? '#92400E' : '#374151',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease-in-out',
                              }}
                            >
                              {day.slice(0, 3)}
                            </button>
                          )
                        })}
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                        Staff will automatically be disabled from event deployment on their designated off-days.
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddStaffModal(false)}
                        className="btn-ghost"
                        style={{ padding: '8px 16px', borderRadius: '8px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingStaff || !newStaffName.trim()}
                        className="btn-submit-primary"
                        style={{ padding: '8px 20px', borderRadius: '8px' }}
                      >
                        {isSavingStaff ? 'Saving...' : 'Save & Deploy Staff'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
