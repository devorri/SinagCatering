import React, { useState, useMemo } from 'react'
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
  AlertTriangle,
  Send,
  CreditCard,
  Ban,
  Check,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import type { Booking, Inquiry } from '../types'

type AdminTabType = 'analytics' | 'bookings' | 'calendar' | 'staff' | 'reviews' | 'inquiries'

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
    login,
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
  const [downpaymentDeadline, setDownpaymentDeadline] = useState('')

  const handleLogoutClick = () => {
    logout()
    if (onLogout) onLogout()
  }

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')

    if (email === 'admin@sinagcatering.ph' && password === 'admin') {
      login(email, 'Administrator', 'admin')
    } else {
      setLoginError('Invalid credentials. Use admin@sinagcatering.ph / admin')
    }
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
        totalRevenue += b.downpaymentAmount || (b.totalPrice * 0.5)
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

    const totalValidBookings = Math.max(1, confirmedCount + pendingCount)
    const avgBookingValue = bookings.length > 0 ? totalRevenue / totalValidBookings : 0

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

    // Set deadline to 7 days from now
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 7)
    setDownpaymentDeadline(deadline.toISOString().split('T')[0])

    setShowDownpaymentModal(true)
  }

  // Process downpayment confirmation
  const handleConfirmDownpayment = () => {
    if (!downpaymentBooking) return

    // Update booking status to confirmed
    updateBookingStatus(downpaymentBooking.id, 'confirmed')

    // Update payment status to downpayment_paid
    updatePaymentStatus(downpaymentBooking.id, 'downpayment_paid', downpaymentAmount)

    // Block the date automatically
    blockDate(downpaymentBooking.eventDate)

    // Notify the user
    notifyUsers(
      [downpaymentBooking.email],
      'Booking Confirmed - Downpayment Received',
      `Your booking for ${downpaymentBooking.eventDate} has been confirmed. Your downpayment of PHP ${downpaymentAmount.toLocaleString()} has been received. We look forward to serving you!`
    )

    setShowDownpaymentModal(false)
    setDownpaymentBooking(null)
    alert('Booking confirmed! Date has been blocked and client has been notified.')
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
          { id: 'inquiries', label: 'Inquiry Inbox', icon: <MessageSquare size={18} />, badge: inquiries.filter(i => !i.replied).length },
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
                    <div className="kpi-val">PHP {analyticsData.totalRevenue.toLocaleString()}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Total Gross Revenue</div>
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
                    <div className="kpi-val">PHP {analyticsData.avgBookingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className="kpi-lbl" style={{ fontSize: '0.82rem', color: '#64748B' }}>Avg. Booking Value</div>
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
                      const confirmedRev = bookings.filter(b => b.bookingStatus === 'confirmed' && b.paymentStatus === 'fully_paid').reduce((s, b) => s + b.totalPrice, 0)
                      const downpaymentRev = bookings.filter(b => b.bookingStatus === 'confirmed' && b.paymentStatus === 'downpayment_paid').reduce((s, b) => s + (b.downpaymentAmount || b.totalPrice * 0.5), 0)
                      const pendingRev = bookings.filter(b => b.bookingStatus === 'pending').reduce((s, b) => s + b.totalPrice, 0)
                      const cancelledRev = bookings.filter(b => b.bookingStatus === 'cancelled' || b.bookingStatus === 'forfeit').reduce((s, b) => s + b.totalPrice, 0)
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
                              <span className="admin-bar-value">PHP {bar.value.toLocaleString()}</span>
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
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>PHP {b.totalPrice.toLocaleString()}</div>
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
                        <td className="font-number" style={{ fontWeight: 700 }}>PHP {b.totalPrice.toLocaleString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
                            <span className={`status-pill ${b.paymentStatus === 'fully_paid' ? 'confirmed' : b.paymentStatus === 'downpayment_paid' ? 'pending' : 'cancelled'}`}>
                              {b.paymentStatus === 'downpayment_paid' ? 'Downpayment' : b.paymentStatus.replace('_', ' ')}
                            </span>
                            {b.paymentStatus === 'downpayment_paid' && b.downpaymentAmount && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                                PHP {b.downpaymentAmount.toLocaleString()}
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
                                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                >
                                  <Check size={14} /> Approve
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
                    <p style={{ margin: '0 0 4px' }}><strong>Total Price:</strong> PHP {selectedBooking.totalPrice.toLocaleString()}</p>
                    <p style={{ margin: '0 0 16px' }}><strong>Payment Status:</strong> {selectedBooking.paymentStatus.replace('_', ' ')}</p>

                    {selectedBooking.bookingStatus === 'pending' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button onClick={() => handleApproveBooking(selectedBooking)} className="btn-submit-primary">
                          <ShieldCheck size={16} /> Approve & Request Downpayment
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

          {/* DOWNPAYMENT MODAL */}
          {showDownpaymentModal && downpaymentBooking && (
            <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: 0 }}>Request Downpayment</h3>
                  <button onClick={() => { setShowDownpaymentModal(false); setDownpaymentBooking(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <p><strong>Client:</strong> {downpaymentBooking.customerName}</p>
                  <p><strong>Event:</strong> {downpaymentBooking.eventType} on {downpaymentBooking.eventDate}</p>
                  <p><strong>Total:</strong> PHP {downpaymentBooking.totalPrice.toLocaleString()}</p>
                </div>

                <div className="form-group">
                  <label>Downpayment Amount (50% of total)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={downpaymentAmount}
                    onChange={(e) => setDownpaymentAmount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Payment Deadline</label>
                  <input
                    type="date"
                    className="input-field"
                    value={downpaymentDeadline}
                    onChange={(e) => setDownpaymentDeadline(e.target.value)}
                    required
                  />
                </div>

                <div style={{ background: 'var(--paper-warm)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', border: '1px solid var(--line)' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} style={{ color: 'var(--gold)', verticalAlign: 'middle', marginRight: '8px' }} />
                    <strong>Note:</strong> The selected date will be blocked once you confirm. The client will be notified with payment instructions.
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
                  <button
                    onClick={handleConfirmDownpayment}
                    className="btn-submit-primary"
                    style={{ flex: 2 }}
                  >
                    <Check size={16} /> Confirm & Block Date
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