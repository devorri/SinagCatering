import React, { useState, useMemo, useEffect } from 'react'
import {
  DollarSign,
  CheckCircle,
  Clock,
  Award,
  Eye,
  ShieldCheck,
  Trash,
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
  TrendingUp,
  UsersRound,
  Bell,
  Send,
  CreditCard,
  Ban,
  Check,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Booking, Inquiry, NotificationLog } from '../types'
import {
  getNotificationLogs,
  clearNotificationLogs,
  sendSemaphoreSMS,
} from '../lib/notifications'
import { isSupabaseConfigured } from '../lib/supabase'
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
    blockDate,
    unblockDate,
    respondInquiry,
    replyReview,
    deleteReview,
    updatePaymentStatus,
    verifyDownpaymentBooking,
    notifyUsers,
  } = useApp()

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

  // Date blocking form state
  const [newBlockDate, setNewBlockDate] = useState('')

  // Inquiry reply form state
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  const [inquiryReplyText, setInquiryReplyText] = useState('')

  // Review reply form state
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null)
  const [reviewReplyText, setReviewReplyText] = useState('')

  // Booking list filters
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'forfeit'>('all')

  // Downpayment management
  const [showDownpaymentModal, setShowDownpaymentModal] = useState(false)
  const [downpaymentBooking, setDownpaymentBooking] = useState<Booking | null>(null)
  const [downpaymentAmount, setDownpaymentAmount] = useState(0)

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

  const handleClearLogs = () => {
    if (window.confirm('Clear all notification audit logs?')) {
      clearNotificationLogs()
      setNotificationLogs([])
    }
  }

  const handleLogoutClick = () => {
    logout()
    if (onLogout) onLogout()
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

      // Revenue calculations
      if (b.bookingStatus === 'confirmed' && b.paymentStatus === 'fully_paid') {
        totalRevenue += b.totalPrice
      } else if (b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid') {
        const paidAmount = b.downpaymentAmount || (b.totalPrice * 0.5)
        totalRevenue += paidAmount
      }

      // Status counts
      if (b.bookingStatus === 'confirmed') confirmedCount++
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
      (booking.currency ?? 'PHP') === 'PHP' && ['confirmed', 'pending'].includes(booking.bookingStatus),
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
    setShowBookingModal(true)
  }

  const handleSaveStaffAllocation = () => {
    if (!selectedBooking) return
    allocateStaff(selectedBooking.id, tempStaffIds)
    alert('Staff successfully assigned to event!')
    setShowBookingModal(false)
  }

  const toggleStaffSelection = (id: string) => {
    setTempStaffIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
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
  const handleConfirmDownpayment = () => {
    if (!downpaymentBooking) return

    // Update booking status to confirmed and payment to downpayment_paid, block date, and trigger real alerts
    verifyDownpaymentBooking(downpaymentBooking.id, downpaymentAmount)

    setShowDownpaymentModal(false)
    setShowBookingModal(false)
    setDownpaymentBooking(null)
    alert(`Downpayment verified & booking confirmed! Date (${downpaymentBooking.eventDate}) is officially locked, and Semaphore SMS/Email confirmation alert has been dispatched to ${downpaymentBooking.phone}.`)
  }

  // Handle booking rejection
  const handleRejectBooking = (bookingId: string) => {
    if (window.confirm('Are you sure you want to reject this booking?')) {
      updateBookingStatus(bookingId, 'cancelled')
      alert('Booking has been rejected.')
    }
  }

  // Handle forfeit booking (when downpayment deadline passes)
  const handleForfeitBooking = (bookingId: string, eventDate: string) => {
    if (window.confirm('Mark this booking as forfeited? The date will become available again.')) {
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

      alert('Booking has been forfeited and date is now available again.')
    }
  }

  // Handle manual date unblock
  const handleManualUnblock = (date: string) => {
    if (window.confirm(`Unblock ${date}? This will make it available for booking.`)) {
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

  // Auth Screen for Admin
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="admin-dashboard-wrapper" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8FAFC', padding: '40px' }}>
        <div className="portal-auth-card" style={{ maxWidth: '480px', width: '100%', background: '#FFFFFF', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src="/sinag_logo.png" alt="Sinag Catering" style={{ width: '54px', height: '54px', marginBottom: '12px' }} />
            <h2 className="portal-auth-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', margin: '0 0 6px' }}>Admin Console</h2>
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
                setPassword('admin')
              }}
              className="btn-demo-chip"
              style={{ width: '100%', marginTop: '8px' }}
            >
              🔐 Autofill Admin Credentials
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
          { id: 'notifications', label: 'SMS & Email Alerts', icon: <Send size={18} /> },
        ],
      },
    ]

  return (
    <div className="admin-workspace">
      {/* Dark Sidebar - Dedicated Executive Navigation */}
      <aside className={`admin-sidebar ${isDrawerOpen ? 'open' : ''}`}>
        <div>
          <div className="admin-sidebar-header">
            <img src="/sinag_logo.png" alt="Sinag Logo" className="admin-sidebar-logo" />
            <div>
              <h2 className="admin-sidebar-title">Sinag Executive</h2>
              <span className="admin-sidebar-tag">Operations Hub</span>
            </div>
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
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: activeTab === item.id ? 'rgba(255,255,255,0.25)' : '#1E293B',
                          color: '#FFFFFF',
                        }}
                      >
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
              <strong style={{ display: 'block', fontSize: '0.88rem', color: '#FFF' }}>{currentUser.name}</strong>
              <span style={{ fontSize: '0.75rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }}></span> Online
              </span>
            </div>
          </div>

          <button
            onClick={handleLogoutClick}
            title="Sign out of Admin Suite"
            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '6px' }}
          >
            <LogOut size={18} />
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
            <Menu size={22} />
          </button>

          <div className="admin-search-box">
            <Search size={16} style={{ color: '#94A3B8' }} />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search bookings, clients, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="admin-notification-bell">
              <Bell size={18} />
              {bookings.filter(b => b.bookingStatus === 'pending').length > 0 && (
                <span className="admin-notification-dot" />
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="admin-body-content">
          <div className="admin-page-header">
            <div>
              <h1 className="admin-page-title">{activeTab === 'analytics' ? 'Executive Dashboard' : activeTab === 'bookings' ? 'Bookings Register' : activeTab === 'calendar' ? 'Date Availability' : activeTab === 'staff' ? 'Staff Roster' : activeTab === 'reviews' ? 'Reviews Moderation' : 'Inquiry Inbox'}</h1>
              <p className="admin-page-sub">
                Welcome back, <strong>{currentUser.name}</strong>. Here's your real-time catering operations overview.
              </p>
            </div>
          </div>

          {/* KPI Stats Cards — show on analytics tab */}
          {activeTab === 'analytics' && (
            <>
              <div className="kpi-card-grid">
                <div className="kpi-card">
                  <div className="kpi-icon-box"><DollarSign size={24} /></div>
                  <div>
                    <div className="kpi-val">{formatMoney(analyticsData.totalRevenue, 'PHP')}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Gross PHP Revenue</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box" style={{ color: '#10B981', background: '#D1FAE5' }}><CheckCircle size={24} /></div>
                  <div>
                    <div className="kpi-val">{analyticsData.confirmedCount}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Confirmed Events</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box" style={{ color: '#F59E0B', background: '#FEF3C7' }}><Clock size={24} /></div>
                  <div>
                    <div className="kpi-val">{analyticsData.pendingCount}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Pending Approval</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box" style={{ color: '#8B5CF6', background: '#EDE9FE' }}><Award size={24} /></div>
                  <div>
                    <div className="kpi-val" style={{ fontSize: '1.2rem' }}>{analyticsData.popularPackageName}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Top Package Tier</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box" style={{ color: '#3B82F6', background: '#DBEAFE' }}><TrendingUp size={24} /></div>
                  <div>
                    <div className="kpi-val">{formatMoney(analyticsData.avgBookingValue, 'PHP')}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Avg. PHP Booking Value</div>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon-box" style={{ color: '#EC4899', background: '#FCE7F3' }}><UsersRound size={24} /></div>
                  <div>
                    <div className="kpi-val">{analyticsData.totalGuests.toLocaleString()}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Total Guests Served</div>
                  </div>
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
                      const confirmedRev = phpBookings.filter(b => b.bookingStatus === 'confirmed' && b.paymentStatus === 'fully_paid').reduce((s, b) => s + b.totalPrice, 0)
                      const downpaymentRev = phpBookings.filter(b => b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid').reduce((s, b) => s + (b.downpaymentAmount || b.totalPrice * 0.5), 0)
                      const pendingRev = phpBookings.filter(b => b.bookingStatus === 'pending').reduce((s, b) => s + b.totalPrice, 0)
                      const cancelledRev = phpBookings.filter(b => b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit').reduce((s, b) => s + b.totalPrice, 0)
                      const maxRev = Math.max(confirmedRev, downpaymentRev, pendingRev, cancelledRev, 1)
                      const bars = [
                        { label: 'Fully Paid', value: confirmedRev, color: '#10B981', bg: '#D1FAE5' },
                        { label: 'Downpayment', value: downpaymentRev, color: '#8B5CF6', bg: '#EDE9FE' },
                        { label: 'Pending', value: pendingRev, color: '#F59E0B', bg: '#FEF3C7' },
                        { label: 'Lost', value: cancelledRev, color: '#EF4444', bg: '#FEE2E2' },
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
                                    background: `linear-gradient(90deg, ${bar.color}, ${bar.bg})`,
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
                          fontWeight: 600
                        }}>
                          {count >= 5 ? '🔴 High' : count >= 3 ? '🟡 Medium' : '🟢 Low'}
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
              <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: '16px' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', margin: 0 }}>Master Reservations Register</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['all', 'pending', 'confirmed', 'cancelled', 'forfeit'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setBookingFilter(filter)}
                      className="btn-nav-logout"
                      style={bookingFilter === filter ? { background: 'var(--obsidian)', color: 'var(--gold)', borderColor: 'var(--obsidian)' } : {}}
                    >
                      {filter.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>REF ID</th>
                      <th>Client</th>
                      <th>Event & Date</th>
                      <th>Total Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b) => (
                      <tr key={b.id}>
                        <td className="font-number" style={{ fontWeight: 700 }}>#{b.id}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{b.customerName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{b.email}</div>
                        </td>
                        <td>
                          <div><strong>{b.eventType}</strong> ({b.guestCount} pax)</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{b.eventDate}</div>
                        </td>
                        <td className="font-number" style={{ fontWeight: 700 }}>{formatMoney(b.totalPrice, b.currency)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                            <span className={`status-pill ${b.paymentStatus === 'fully_paid' ? 'confirmed' : b.paymentStatus === 'downpayment_paid' ? 'pending' : 'cancelled'}`}>
                              {b.paymentStatus === 'downpayment_paid' ? 'Downpayment' : b.paymentStatus.replace('_', ' ')}
                            </span>
                            {b.paymentStatus === 'downpayment_paid' && b.downpaymentAmount && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                                {formatMoney(b.downpaymentAmount, b.currency)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${b.bookingStatus === 'forfeit' ? 'cancelled' : b.bookingStatus}`}>
                            {b.bookingStatus === 'forfeit' ? 'Forfeited' : b.bookingStatus}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleOpenBookingDetails(b)}
                              className="btn-hero-primary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                              <Eye size={14} /> View
                            </button>

                            {b.bookingStatus === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveBooking(b)}
                                  className="btn-submit-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10B981' }}
                                >
                                  <Check size={14} /> Verify & Approve
                                </button>
                                <button
                                  onClick={() => handleRejectBooking(b.id)}
                                  className="btn-nav-logout"
                                  style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--terracotta)' }}
                                >
                                  <X size={14} /> Reject
                                </button>
                              </>
                            )}

                            {b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid' && (
                              <button
                                onClick={() => {
                                  updatePaymentStatus(b.id, 'fully_paid', b.totalPrice)
                                  alert('Full payment recorded!')
                                }}
                                className="btn-hero-primary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem', background: '#10B981' }}
                              >
                                <CreditCard size={14} /> Full Payment
                              </button>
                            )}

                            {(b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed') && (
                              <button
                                onClick={() => handleForfeitBooking(b.id, b.eventDate)}
                                className="btn-nav-logout"
                                style={{ padding: '6px 12px', fontSize: '0.75rem', color: '#DC2626' }}
                              >
                                <Ban size={14} /> Forfeit
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

          {/* Tab 3: Calendar Blocked Dates */}
          {activeTab === 'calendar' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 10px' }}>Calendar Date Blocking Coordinator</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '28px' }}>Manually lock out dates for private holidays or venue maintenance.</p>

              <form onSubmit={handleBlockDateSubmit} style={{ display: 'flex', gap: '16px', maxWidth: '500px', marginBottom: '32px' }}>
                <input
                  type="date"
                  className="input-field"
                  required
                  value={newBlockDate}
                  onChange={(e) => setNewBlockDate(e.target.value)}
                />
                <button type="submit" className="btn-submit-primary" style={{ width: 'auto', whiteSpace: 'nowrap' }}>
                  Block Date
                </button>
              </form>

              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '16px' }}>
                Currently Blocked Calendar Dates:
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 10px' }}>Service Staff Directory</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Active personnel list for event deployment.</p>
                </div>
                <button className="btn-submit-primary" style={{ padding: '8px 16px' }}>
                  <Plus size={16} /> Add Staff
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {staff.map((s) => (
                  <div key={s.id} style={{ background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '1rem' }}>{s.name}</strong>
                      <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{s.role.replace('_', ' ')}</span>
                    </div>
                    <span className={`status-pill ${s.status === 'available' ? 'confirmed' : 'pending'}`}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 5: Reviews Moderation */}
          {activeTab === 'reviews' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 24px' }}>Testimonial Moderation & Responses</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {reviews.map((rev) => (
                  <div key={rev.id} style={{ background: 'var(--paper-warm)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div>
                        <strong>{rev.userName}</strong> ({rev.rating}★)
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{rev.date}</div>
                      </div>
                      <button onClick={() => deleteReview(rev.id)} className="btn-nav-logout" style={{ color: 'var(--terracotta)' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 10px' }}>Customer Concierge Inquiry Inbox</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                    {inquiries.filter(i => !i.replied).length} unanswered inquiries
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {inquiries.map((inq) => (
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
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', margin: 0 }}>Booking Inspection & Staffing</h3>
                  <button onClick={() => setShowBookingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Client Contact
                    </h4>
                    <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{selectedBooking.customerName}</p>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--muted)' }}>{selectedBooking.email} | {selectedBooking.phone}</p>

                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Package & Event Details
                    </h4>
                    <p style={{ margin: '0 0 4px' }}><strong>Tier:</strong> {selectedBooking.packageName}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Date:</strong> {selectedBooking.eventDate}</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Attendees:</strong> {selectedBooking.guestCount} pax</p>
                    <p style={{ margin: '0 0 4px' }}><strong>Total Price:</strong> {formatMoney(selectedBooking.totalPrice, selectedBooking.currency)}</p>
                    <p style={{ margin: '0 0 10px' }}><strong>Payment Status:</strong> {selectedBooking.paymentStatus.replace('_', ' ')}</p>

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
                        <button onClick={() => handleApproveBooking(selectedBooking)} className="btn-submit-primary" style={{ background: '#10B981' }}>
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
                          updatePaymentStatus(selectedBooking.id, 'fully_paid', selectedBooking.totalPrice)
                          alert('Full payment recorded!')
                          setShowBookingModal(false)
                        }}
                        className="btn-submit-primary"
                        style={{ background: '#10B981' }}
                      >
                        <CreditCard size={16} /> Record Full Payment
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                      Assign Service Staff
                    </h4>

                    {(() => {
                      const rec = getStaffRecommendation(selectedBooking.guestCount)
                      return (
                        <div style={{ background: 'var(--paper-warm)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '14px', border: '1px solid var(--line)' }}>
                          <strong>Staffing Guideline Ratio:</strong>
                          <div>Recommended: {rec.waiters} Waiters & {rec.attendants} Attendants</div>
                        </div>
                      )
                    })()}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                      {staff.map((s) => {
                        const isChecked = tempStaffIds.includes(s.id)
                        return (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleStaffSelection(s.id)}
                            />
                            <span>{s.name} ({s.role.replace('_', ' ')})</span>
                          </label>
                        )
                      })}
                    </div>

                    <button onClick={handleSaveStaffAllocation} className="btn-hero-primary" style={{ width: '100%' }}>
                      Save Staff Roster
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 6: SMS & Email Notifications (Item 9) */}
          {activeTab === 'notifications' && (
            <div className="data-table-card" style={{ padding: '36px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 6px' }}>
                    Semaphore SMS & Transactional Notification Hub
                  </h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                    Monitor real-time SMS dispatches (booking confirmations, downpayment verification alerts, OTPs) and email triggers.
                  </p>
                </div>
                <button onClick={handleClearLogs} className="btn-nav-logout" style={{ fontSize: '0.78rem' }}>
                  <Trash size={14} /> Clear Audit Logs
                </button>
              </div>

              {/* Server-side Semaphore dispatch and explicit test send */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px', marginBottom: '32px' }}>
                {/* Server-side Semaphore configuration */}
                <div style={{ background: 'var(--paper-warm)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <ShieldCheck size={18} style={{ color: 'var(--gold-dark)' }} />
                    <strong style={{ fontSize: '0.95rem' }}>Semaphore SMS Gateway</strong>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 14px' }}>
                    SMS requests are sent through a Supabase Edge Function. Store the Semaphore API key as a server secret; it is never saved in this browser.
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Mode: <strong>{isSupabaseConfigured ? 'Supabase function required for delivery' : 'Simulated preview mode'}</strong>
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
                      <span style={{ fontSize: '0.78rem', color: testSmsStatus.includes('Failed') ? 'var(--terracotta)' : '#10B981', fontWeight: 600 }}>
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

          {/* DOWNPAYMENT VERIFICATION & APPROVAL MODAL (Item 8) */}
          {showDownpaymentModal && downpaymentBooking && (
            <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '560px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 4px' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.88rem', marginBottom: '10px' }}>
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

                <div style={{ background: '#ECFDF5', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid #A7F3D0' }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#065F46' }}>
                    <ShieldCheck size={16} style={{ color: '#059669', verticalAlign: 'middle', marginRight: '6px' }} />
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
                    style={{ flex: 2, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <ShieldCheck size={16} /> VERIFY DOWNPAYMENT & APPROVE BOOKING
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}