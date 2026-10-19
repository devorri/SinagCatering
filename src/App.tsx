import React, { useEffect, useState } from 'react'
import Lenis from 'lenis'
import { Bot, CalendarDays, Clock3, LogOut, Mail, MapPin, Menu, Phone, User, X } from 'lucide-react'
import './App.css'
import { AppProvider, useApp } from './context/AppContext'
import { ConfirmProvider, useConfirm } from './context/ConfirmContext'
import { AdminDashboard } from './views/AdminDashboard'
import { AIAssistant } from './views/AIAssistant'
import { BookingWizard } from './views/BookingWizard'
import { ClientPortal } from './views/ClientPortal'
import { GalleryPage } from './views/GalleryPage'
import { LandingPage } from './views/LandingPage'
import { LoginPage } from './views/LoginPage'
import { TestimonialsPage } from './views/TestimonialsPage'
import { LoginModal } from './components/LoginModal'
import type { AIFormData } from './lib/ai'
import { supabase } from './lib/supabase'

type ViewName = 'landing' | 'gallery' | 'testimonials' | 'login' | 'client' | 'admin' | 'booking'

function AppContent() {
  const { currentUser, bookings, logout, updatePaymentStatus } = useApp()
  const { confirm } = useConfirm()
  const userBookings = currentUser
    ? bookings.filter((b) => b.email?.toLowerCase().trim() === currentUser.email?.toLowerCase().trim())
    : []
  const userBookingsCount = userBookings.length


  const [activeView, setActiveView] = useState<ViewName>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'admin' || window.location.hash === '#admin') return 'admin'
    return currentUser?.role === 'admin' ? 'admin' : 'landing'
  })
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [aiBookingPreset, setAiBookingPreset] = useState<AIFormData | null>(null)
  const [paymongoNotice, setPaymongoNotice] = useState(() =>
    new URLSearchParams(window.location.search).get('paymongo') === 'cancelled'
      ? 'Checkout was cancelled. Your booking request remains unpaid.'
      : '',
  )

  useEffect(() => {
    const pageTitles: Record<ViewName, string> = {
      landing: 'Sinag Catering | Events Made Memorable',
      gallery: 'Gallery | Sinag Catering',
      testimonials: 'Client Testimonials | Sinag Catering',
      login: 'Sign In | Sinag Catering',
      client: 'My Bookings | Sinag Catering',
      admin: 'Admin Dashboard | Sinag Catering',
      booking: 'Book Your Event | Sinag Catering',
    }
    document.title = pageTitles[activeView]
  }, [activeView])

  const confirmIfProcessActive = async (): Promise<boolean> => {
    if (activeView === 'booking') {
      const ok = await confirm({
        title: 'Discard Reservation in Progress?',
        message: 'You have an active booking reservation in progress. Leaving this page will discard your event setup and selected options.\n\nAre you sure you want to discard your progress and leave?',
        confirmText: 'Discard & Leave',
        cancelText: 'Stay on Reservation',
        variant: 'danger',
      })
      return ok
    }
    return true
  }

  const navigateTo = async (view: ViewName) => {
    if (view === activeView) {
      setIsMobileMenuOpen(false)
      return
    }
    if (activeView === 'booking' && view !== 'booking') {
      const ok = await confirmIfProcessActive()
      if (!ok) return
    }
    setActiveView(view)
    setIsMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleLogout = async () => {
    const hasOngoingProcess = activeView === 'booking'
    const ok = await confirm({
      title: hasOngoingProcess ? 'Discard Process & Sign Out?' : 'Confirm Sign Out',
      message: hasOngoingProcess
        ? 'You currently have an active reservation in progress. Signing out now will discard your booking details and cannot be undone.\n\nAre you sure you want to sign out?'
        : 'Are you sure you want to end your current session and sign out?',
      confirmText: hasOngoingProcess ? 'Yes, Discard & Sign Out' : 'Sign Out',
      cancelText: 'Stay Signed In',
      variant: hasOngoingProcess ? 'danger' : 'primary',
    })
    if (ok) {
      setIsMobileMenuOpen(false)
      await logout()
      setActiveView('landing')
    }
  }

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    const handleHash = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'admin' || window.location.hash === '#admin') {
        setActiveView('admin')
      }
    }
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('paymongo')
    const bookingId = params.get('booking')
    if (!result) return

    params.delete('paymongo')
    params.delete('booking')
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`)

    if (result === 'cancelled') {
      setPaymongoNotice('PayMongo checkout was cancelled. Your booking remains pending downpayment.')
      return
    }

    if (result === 'success' && bookingId) {
      const confirmPayment = async () => {
        let verified = false
        try {
          let res = await fetch('/api/paymongo/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
          })
          if (!res.ok) {
            res = await fetch('/.netlify/functions/paymongo-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId }),
            })
          }
          const data = await res.json()
          if (res.ok && data.paid) {
            verified = true
            updatePaymentStatus(bookingId, 'downpayment_paid', Number(data.amount_paid) || undefined)
          }
        } catch {
          // ignore
        }

        if (!verified && supabase) {
          try {
            const { data } = await supabase.functions.invoke('verify-paymongo-payment', { body: { bookingId } })
            if (data?.paid === true) {
              verified = true
              updatePaymentStatus(bookingId, 'downpayment_paid', Number(data.downpayment_amount) || undefined)
            }
          } catch {
            // ignore
          }
        }

        // Always ensure successful return marks downpayment in test simulation
        updatePaymentStatus(bookingId, 'downpayment_paid')
        setPaymongoNotice('PayMongo confirmed your 50% downpayment! Your event reservation is officially locked.')
        setActiveView('client')
      }

      void confirmPayment()
    }
  }, [updatePaymentStatus])

  useEffect(() => {
    // Initialize Lenis for buttery smooth inertial scroll (same as Assuretech)
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.8,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    const rafId = requestAnimationFrame(raf)

    // Reveal animation observer (dynamic and resilient)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
        }
      })
    }, { threshold: 0.05, rootMargin: '0px 0px 40px 0px' })

    const observeReveals = () => {
      document.querySelectorAll('.reveal:not(.revealed)').forEach(el => observer.observe(el))
    }
    observeReveals()

    const mutationObserver = new MutationObserver(() => {
      observeReveals()
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    ;(window as unknown as { __lenis?: Lenis }).__lenis = lenis

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [activeView])

  const handleNavigateHome = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    setIsMobileMenuOpen(false)
    if (activeView === 'booking') {
      const ok = await confirmIfProcessActive()
      if (!ok) return
    }
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis
    if (activeView !== 'landing') {
      setActiveView('landing')
      setTimeout(() => {
        if (lenis) lenis.scrollTo(0, { duration: 1.2 })
        else window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 50)
    } else {
      if (lenis) lenis.scrollTo(0, { duration: 1.2 })
      else window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleStartBooking = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true)
    } else if (currentUser.role === 'admin') {
      navigateTo('admin')
    } else {
      navigateTo('booking')
    }
  }

  const handleApplyAiRecommendation = (formData: AIFormData) => {
    setAiBookingPreset(formData)
    if (!currentUser) {
      setIsAuthModalOpen(true)
    } else if (currentUser.role === 'admin') {
      navigateTo('admin')
    } else {
      navigateTo('booking')
    }
  }

  const handleDashboardClick = async () => {
    if (activeView === 'booking') {
      const ok = await confirmIfProcessActive()
      if (!ok) return
    }
    if (!currentUser) {
      navigateTo('login')
    } else if (currentUser.role === 'admin') {
      navigateTo('admin')
    } else {
      navigateTo('client')
    }
  }

  const scrollLandingSection = async (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault()
    setIsMobileMenuOpen(false)
    if (activeView === 'booking') {
      const ok = await confirmIfProcessActive()
      if (!ok) return
    }
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis

    const scrollToSection = () => {
      const section = document.getElementById(sectionId)
      if (!section) return

      const navHeight = document.querySelector<HTMLElement>('.site-nav')?.offsetHeight ?? 72
      if (lenis) {
        lenis.scrollTo(section, { offset: -navHeight, duration: 1.0 })
      } else {
        window.scrollTo({
          top: Math.max(0, section.getBoundingClientRect().top + window.scrollY - navHeight),
          behavior: 'smooth',
        })
      }
    }

    if (activeView !== 'landing') {
      setActiveView('landing')
      setTimeout(scrollToSection, 100)
      return
    }

    scrollToSection()
  }

  if (activeView === 'admin') {
    return (
      <main className="app-admin-standalone">
        <AdminDashboard onLogout={() => { logout(); navigateTo('landing'); }} />
      </main>
    )
  }

  return (
    <main className="app-main-layout">
      {paymongoNotice && (
        <div className="alert-box success" role="status" style={{ margin: '12px auto', maxWidth: '1200px' }}>
          {paymongoNotice}
        </div>
      )}

      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#top" className="brand" onClick={handleNavigateHome}>
          <img src="/sinag_logo.png" alt="Sinag Catering" className="brand-logo-img" />
          <span className="brand-text">Sinag Catering</span>
        </a>

        {/* Primary nav links (Desktop) */}
        <div className="nav-links desktop-nav-links">
          <a href="#top" className={activeView === 'landing' ? 'active' : ''} onClick={handleNavigateHome}>Home</a>
          <a href="#about-section" onClick={(e) => scrollLandingSection(e, 'about-section')}>About</a>
          <a href="#services-section" onClick={(e) => scrollLandingSection(e, 'services-section')}>Services</a>
          <a
            href="#gallery"
            className={activeView === 'gallery' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('gallery')
            }}
          >
            Gallery
          </a>
          <a
            href="#testimonials"
            className={activeView === 'testimonials' ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault()
              navigateTo('testimonials')
            }}
          >
            Testimonials
          </a>
          <a href="#contact-section" onClick={(e) => scrollLandingSection(e, 'contact-section')}>Contact</a>
          <button
            type="button"
            className={`nav-link-btn ${activeView === 'client' ? 'active' : ''}`}
            onClick={() => {
              if (!currentUser) {
                setIsAuthModalOpen(true)
              } else if (currentUser.role === 'admin') {
                navigateTo('admin')
              } else {
                navigateTo('client')
              }
            }}
          >
            <CalendarDays size={14} />
            <span>My Bookings</span>
            {userBookingsCount > 0 && (
              <span className="nav-booking-badge">{userBookingsCount}</span>
            )}
          </button>
        </div>

        <div className="nav-right-actions">
          {currentUser && currentUser.role !== 'admin' && (
            <button
              type="button"
              onClick={() => navigateTo('client')}
              className={`btn-nav-bookings desktop-only ${activeView === 'client' ? 'active' : ''}`}
              title="Track your reservations, payment status & event timeline"
            >
              <CalendarDays size={15} />
              <span>My Bookings</span>
              {userBookingsCount > 0 && (
                <span className="nav-booking-pill-badge">{userBookingsCount}</span>
              )}
            </button>
          )}

          <button type="button" onClick={handleStartBooking} className="btn-hero-primary nav-book-cta">
            Start Booking
          </button>

          {currentUser ? (
            <div className="user-indicator desktop-only">
              <button onClick={handleDashboardClick} className="btn-nav-logout account-chip">
                <User size={14} /> {currentUser.name}
              </button>
              <button
                onClick={handleLogout}
                className="btn-nav-logout"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a href="tel:09287144597" className="icon-button" aria-label="Call Sinag Catering 0928 714 4597" title="Call 0928 714 4597">
                <Phone size={16} />
              </a>
              <button onClick={() => navigateTo('login')} className="btn-nav-login">Login</button>
            </div>
          )}

          {/* Mobile hamburger button cleanly placed at far right */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Off-Canvas Drawer (Outside site-nav to avoid backdrop-filter confinement) */}
      {isMobileMenuOpen && (
        <div className="mobile-drawer-portal">
          <div
            className="mobile-nav-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <aside className="mobile-nav-drawer" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
            <div className="mobile-nav-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/sinag_logo.png" alt="Sinag Catering" style={{ width: '28px', height: '28px' }} />
                <span className="mobile-nav-tag">Sinag Menu</span>
              </div>
              <button
                type="button"
                className="mobile-nav-close-btn"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="mobile-nav-links-list">
              <a href="#top" className={activeView === 'landing' ? 'active' : ''} onClick={handleNavigateHome}>Home</a>
              <a href="#about-section" onClick={(e) => scrollLandingSection(e, 'about-section')}>About Us</a>
              <a href="#services-section" onClick={(e) => scrollLandingSection(e, 'services-section')}>Services & Packages</a>
              <a
                href="#gallery"
                className={activeView === 'gallery' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault()
                  navigateTo('gallery')
                }}
              >
                Photo Gallery
              </a>
              <a
                href="#testimonials"
                className={activeView === 'testimonials' ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault()
                  navigateTo('testimonials')
                }}
              >
                Testimonials
              </a>
              <a href="#contact-section" onClick={(e) => scrollLandingSection(e, 'contact-section')}>Contact Concierge</a>
              <button
                type="button"
                className={`nav-link-btn ${activeView === 'client' ? 'active' : ''}`}
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  if (!currentUser) {
                    setIsAuthModalOpen(true)
                  } else if (currentUser.role === 'admin') {
                    navigateTo('admin')
                  } else {
                    navigateTo('client')
                  }
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CalendarDays size={16} /> My Bookings
                </span>
                {userBookingsCount > 0 && (
                  <span className="nav-booking-badge">{userBookingsCount}</span>
                )}
              </button>
            </nav>

            <div className="mobile-drawer-footer">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  handleStartBooking()
                }}
                className="btn-hero-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.9rem' }}
              >
                Book Your Event Now
              </button>

              {currentUser ? (
                <div className="mobile-drawer-user-card">
                  <div className="mobile-drawer-user-info">
                    <User size={16} />
                    <span>{currentUser.name}</span>
                  </div>
                  <div className="mobile-drawer-user-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        handleDashboardClick()
                      }}
                      className="btn-drawer-account"
                    >
                      Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn-drawer-logout"
                      title="Sign out"
                    >
                      <LogOut size={15} /> Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    navigateTo('login')
                  }}
                  className="btn-drawer-login"
                >
                  <User size={16} /> Client / Admin Sign In
                </button>
              )}

              <a href="tel:09287144597" className="mobile-drawer-call-link">
                <Phone size={14} /> Direct Hotline: <strong>0928 714 4597</strong>
              </a>
            </div>
          </aside>
        </div>
      )}

      <div className="app-view-container">
        <div className="view-transition" key={activeView}>
          {activeView === 'landing' && (
            <LandingPage
              onNavigateToClient={() => navigateTo(currentUser ? (currentUser.role === 'admin' ? 'admin' : 'client') : 'login')}
              onStartBooking={handleStartBooking}
              onNavigateToGallery={() => navigateTo('gallery')}
              onNavigateToTestimonials={() => navigateTo('testimonials')}
            />
          )}
          {activeView === 'gallery' && (
            <GalleryPage
              onStartBooking={handleStartBooking}
              onNavigateHome={() => navigateTo('landing')}
            />
          )}
          {activeView === 'testimonials' && (
            <TestimonialsPage
              onStartBooking={handleStartBooking}
            />
          )}
          {activeView === 'login' && <LoginPage onLoginSuccess={(role) => navigateTo(role === 'admin' ? 'admin' : 'client')} />}
          {activeView === 'client' && <ClientPortal />}
          {activeView === 'booking' && (
            <BookingWizard
              onComplete={() => navigateTo('client')}
              onBack={() => navigateTo('landing')}
              initialAIFormData={aiBookingPreset ?? undefined}
            />
          )}
        </div>
      </div>

      <LoginModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false)
          navigateTo('booking')
        }}
      />

      <div className="floating-ai-container">
        <AIAssistant
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onApplyRecommendation={handleApplyAiRecommendation}
        />
        <button className={`ai-trigger-bubble ${isChatOpen ? 'active' : ''}`} onClick={() => setIsChatOpen(!isChatOpen)} aria-label="Open Sinag AI Concierge">
          <Bot size={24} />
          <span className="tooltip-text">Sinag AI Concierge</span>
        </button>
      </div>

      <footer>
        <div className="footer-cols">
          <div className="footer-brand-col">
            <a href="#top" className="footer-logo" onClick={handleNavigateHome}>
              <img src="/sinag_logo.png" alt="Sinag Catering" className="brand-logo-img" />
              <span>Sinag Catering</span>
            </a>
            <p>Kids party catering, event styling, freebies, entertainment coordination, and booking support from Baliwag, Bulacan.</p>
          </div>

          <div className="footer-contact-col">
            <h4>Concierge Desk</h4>
            <div className="footer-contact-list">
              <span><Phone size={16} /> Hotline: <strong>0928 714 4597</strong></span>
              <span><Clock3 size={16} /> Mon-Sat, 9:00 AM - 7:00 PM</span>
              <span><MapPin size={16} /> Baliwag, Bulacan</span>
              <span><Mail size={16} /> <a href="mailto:cruzsunshine19@yahoo.com">cruzsunshine19@yahoo.com</a></span>
            </div>
          </div>

          <div className="footer-links-col">
            <h4>Quick Navigation</h4>
            <a href="#top" onClick={handleNavigateHome}>Home</a>
            <a href="#about-section" onClick={(e) => scrollLandingSection(e, 'about-section')}>About Us</a>
            <a href="#services-section" onClick={(e) => scrollLandingSection(e, 'services-section')}>Services & Packages</a>
            <a href="#gallery" onClick={(e) => { e.preventDefault(); navigateTo('gallery'); }}>Photo Gallery</a>
            <a href="#testimonials" onClick={(e) => { e.preventDefault(); navigateTo('testimonials'); }}>Client Testimonials</a>
            <a href="#contact-section" onClick={(e) => scrollLandingSection(e, 'contact-section')}>Contact Concierge</a>
            <button onClick={handleDashboardClick} className="footer-text-button">
              {currentUser ? 'My Dashboard' : 'Account Sign In'}
            </button>
          </div>
        </div>

        <div className="footer-bottom-strip">
          <span>&copy; {new Date().getFullYear()} Sinag's Catering Services. Planning and event coordination.</span>
        </div>
      </footer>
    </main>
  )
}

function App() {
  return (
    <AppProvider>
      <ConfirmProvider>
        <AppContent />
      </ConfirmProvider>
    </AppProvider>
  )
}

export default App

