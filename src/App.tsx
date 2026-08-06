import React, { useState } from 'react'
import { Bot, Clock3, LogOut, Mail, MapPin, Menu, Phone, Sparkles, User, X } from 'lucide-react'
import './App.css'
import { AppProvider, useApp } from './context/AppContext'
import { AdminDashboard } from './views/AdminDashboard'
import { AIAssistant } from './views/AIAssistant'
import { BookingWizard } from './views/BookingWizard'
import { ClientPortal } from './views/ClientPortal'
import { LandingPage } from './views/LandingPage'
import { LoginPage } from './views/LoginPage'
import { LoginModal } from './components/LoginModal'

type ViewName = 'landing' | 'login' | 'client' | 'admin' | 'booking'

function AppContent() {
  const { currentUser, logout } = useApp()
  const [activeView, setActiveView] = useState<ViewName>(() => (currentUser?.role === 'admin' ? 'admin' : 'landing'))
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [aiBookingPreset, setAiBookingPreset] = useState<{ pkgId?: string; guestCount?: number } | null>(null)

  const navigateTo = (view: ViewName) => {
    setActiveView(view)
    setIsMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNavigateHome = (e: React.MouseEvent) => {
    e.preventDefault()
    navigateTo('landing')
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

  const handleApplyAiRecommendation = (pkgId: string, guestCount: number) => {
    setAiBookingPreset({ pkgId, guestCount })
    if (!currentUser) {
      setIsAuthModalOpen(true)
    } else if (currentUser.role === 'admin') {
      navigateTo('admin')
    } else {
      navigateTo('booking')
    }
  }

  const handleDashboardClick = () => {
    if (!currentUser) {
      navigateTo('login')
    } else if (currentUser.role === 'admin') {
      navigateTo('admin')
    } else {
      navigateTo('client')
    }
  }

  const scrollLandingSection = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault()
    setIsMobileMenuOpen(false)

    if (activeView !== 'landing') {
      setActiveView('landing')
      setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' }), 100)
      return
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })
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
      <div className="preview-mode-banner">
        <Sparkles size={14} style={{ color: 'var(--gold)' }} />
        <span>SINAG'S CATERING SERVICES - KIDS PARTY BOOKING, SCHEDULING, AND AI PACKAGE RECOMMENDATIONS</span>
      </div>

      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#top" className="brand" onClick={handleNavigateHome}>
          <img src="/sinag_logo.png" alt="Sinag Catering" className="brand-logo-img" />
          <span className="brand-text">Sinag Catering</span>
        </a>

        <button className="mobile-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle navigation menu">
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <a href="#top" className={activeView === 'landing' ? 'active' : ''} onClick={handleNavigateHome}>Home</a>
          <a href="#about-section" onClick={(e) => scrollLandingSection(e, 'about-section')}>About</a>
          <a href="#services-section" onClick={(e) => scrollLandingSection(e, 'services-section')}>Services</a>
          <a href="#contact-section" onClick={(e) => scrollLandingSection(e, 'contact-section')}>Contact</a>
        </div>

        <div className="nav-right-actions">
          <button type="button" onClick={handleStartBooking} className="btn-hero-primary" style={{ padding: '8px 18px', fontSize: '0.8rem' }}>
            Start Booking
          </button>

          {currentUser ? (
            <div className="user-indicator">
              <button onClick={handleDashboardClick} className="btn-nav-logout account-chip">
                <User size={14} /> {currentUser.name}
              </button>
              <button
                onClick={() => {
                  logout()
                  navigateTo('landing')
                }}
                className="btn-nav-logout"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a href="tel:09287144597" className="icon-button" aria-label="Call Sinag Catering 0928 714 4597" title="Call 0928 714 4597">
                <Phone size={16} />
              </a>
              <button onClick={() => navigateTo('login')} className="btn-nav-login">Login</button>
            </div>
          )}
        </div>
      </nav>

      <div className="app-view-container">
        <div className="view-transition" key={activeView}>
          {activeView === 'landing' && (
            <LandingPage
              onNavigateToClient={() => navigateTo(currentUser ? (currentUser.role === 'admin' ? 'admin' : 'client') : 'login')}
              onStartBooking={handleStartBooking}
            />
          )}
          {activeView === 'login' && <LoginPage onLoginSuccess={(role) => navigateTo(role === 'admin' ? 'admin' : 'client')} />}
          {activeView === 'client' && <ClientPortal />}
          {activeView === 'booking' && (
            <BookingWizard
              onComplete={() => navigateTo('client')}
              onBack={() => navigateTo('landing')}
              initialPkgId={aiBookingPreset?.pkgId}
              initialGuestCount={aiBookingPreset?.guestCount}
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
        onContinueAsGuest={() => {
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
              <span><Mail size={16} /> cruzsunshine19@yahoo.com</span>
            </div>
          </div>

          <div className="footer-links-col">
            <h4>Quick Navigation</h4>
            <a href="#top" onClick={handleNavigateHome}>Home</a>
            <a href="#about-section" onClick={(e) => scrollLandingSection(e, 'about-section')}>About Us</a>
            <a href="#services-section" onClick={(e) => scrollLandingSection(e, 'services-section')}>Services & Packages</a>
            <a href="#contact-section" onClick={(e) => scrollLandingSection(e, 'contact-section')}>Contact Concierge</a>
            <button onClick={handleDashboardClick} className="footer-text-button">
              {currentUser ? 'My Dashboard' : 'Account Sign In'}
            </button>
          </div>
        </div>

        <div className="footer-bottom-strip">
          <span>&copy; {new Date().getFullYear()} Sinag's Catering Services. Planning and event coordination.</span>
          <span>Philippine Peso (PHP) package estimates</span>
        </div>
      </footer>
    </main>
  )
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default App

