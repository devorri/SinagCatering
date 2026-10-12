import React, { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  Send,
  PartyPopper,
  UtensilsCrossed,
  PackageCheck,
  CalendarClock,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { SINAG_PACKAGES, FOOD_BUFFER_PAX, formatMoney } from '../data/packages'
import { CATEGORY_SHOWCASE_GALLERY } from '../data/eventGalleries'
import bg1 from '../assets/for-bg/1.jpg'
import bg2 from '../assets/for-bg/2.jpg'
import bg3 from '../assets/for-bg/3.jpg'
import bg4 from '../assets/for-bg/4.jpg'
import bg5 from '../assets/for-bg/5.jpg'
import bg6 from '../assets/for-bg/6.jpg'
import bg7 from '../assets/for-bg/7.jpg'
import bg8 from '../assets/for-bg/8.jpg'
import bg9 from '../assets/for-bg/9.jpg'
import bg10 from '../assets/for-bg/10.jpg'

interface LandingPageProps {
  onNavigateToClient: () => void
  onStartBooking: () => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartBooking }) => {
  const { createInquiryDirect } = useApp()

  const [inquiryName, setInquiryName] = useState('')
  const [inquiryEmail, setInquiryEmail] = useState('')
  const [inquiryMessage, setInquiryMessage] = useState('')
  const [inquirySuccess, setInquirySuccess] = useState(false)
  const [heroImageIndex, setHeroImageIndex] = useState(0)

  const heroImages = useMemo(() => [bg1, bg2, bg3, bg4, bg5, bg6, bg7, bg8, bg9, bg10], [])

  useEffect(() => {
    const timer = window.setInterval(
      () => setHeroImageIndex((index) => (index + 1) % heroImages.length),
      5000,
    )
    return () => window.clearInterval(timer)
  }, [heroImages.length])

  // Simple curated gallery photos (6 highlights across wedding, debut, kids birthday)
  const galleryHighlights = useMemo(() => {
    return [
      CATEGORY_SHOWCASE_GALLERY['Wedding'][0],
      CATEGORY_SHOWCASE_GALLERY['Kids Birthday'][0],
      CATEGORY_SHOWCASE_GALLERY['Debut'][0],
      CATEGORY_SHOWCASE_GALLERY['Wedding'][1],
      CATEGORY_SHOWCASE_GALLERY['Kids Birthday'][2],
      CATEGORY_SHOWCASE_GALLERY['Debut'][1],
    ].filter(Boolean)
  }, [])

  return (
    <div className="landing-simple-wrapper">
      {/* 1. HERO SECTION — Top UI (Preserved as requested) */}
      <section id="top" className="landing-dark-hero" aria-label="Sinag Catering Services Hero Section">
        <div className="hero-dynamic-bg-container" aria-hidden="true">
          {heroImages.map((imgUrl, idx) => (
            <div
              key={imgUrl}
              className={`hero-dynamic-bg-slide ${idx === heroImageIndex ? 'active' : ''}`}
              style={{ backgroundImage: `url(${imgUrl})` }}
            />
          ))}
          <div className="hero-dynamic-bg-overlay" />
        </div>

        <div className="hero-split-layout">
          <div className="hero-text-col reveal">
            <div className="hero-tag-pill">
              <Sparkles size={13} />
              <span>Planning · Catering · Event Coordination</span>
            </div>

            <h1 className="hero-display-serif swoosh-title">
              <span className="hero-line">Thoughtful catering</span>{' '}
              <span className="serif-italic">for gatherings</span>{' '}
              <span className="hero-line">worth remembering.</span>
            </h1>

            <p className="hero-lead-text">
              From abundant Filipino cuisine to polished thematic styling, Sinag makes hosting a celebration feel considered and effortless.
            </p>

            <div className="hero-actions-row">
              <button type="button" onClick={onStartBooking} className="btn-hero-primary">
                Start Booking <ChevronRight size={16} />
              </button>
              <a href="tel:09287144597" className="btn-hero-outline">
                Call 0928 714 4597
              </a>
            </div>

            <div className="hero-inline-stats">
              <div>
                <span className="hero-stat-num">3</span>
                <span className="hero-stat-lbl">Signature Packages</span>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <span className="hero-stat-num">50-200</span>
                <span className="hero-stat-lbl">Pax Tiers</span>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <span className="hero-stat-num">50%</span>
                <span className="hero-stat-lbl">Reservation Deposit</span>
              </div>
            </div>

            <div className="hero-slide-controls" aria-label="Event photo slideshow controls">
              {heroImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Show event photo ${index + 1}`}
                  aria-current={index === heroImageIndex}
                  className={index === heroImageIndex ? 'active' : ''}
                  onClick={() => setHeroImageIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. ABOUT US SECTION — Assuretech-style Bento Grid */}
      <section id="about-section" className="simple-section simple-bg-soft">
        <div className="landing-container">
          <div className="reveal section-header-center">
            <span className="stats-label">01 / Catering Philosophy</span>
            <h2 className="simple-title">
              Abundant Feasts with <span className="serif-italic">Filipino Heart.</span>
            </h2>
            <p className="simple-subtitle">
              Based in Baliwag, Bulacan, Sinag's Catering Services creates thoughtful, stress-free banquets for kids' birthdays, debuts, weddings, and family gatherings. From bountiful comfort food to customized setups, we make sure every guest is well-served.
            </p>
          </div>

          <div className="bento-grid">
            {/* Bento Card 1: Core Specialist (Span 8) */}
            <div className="bento-card reveal" style={{ gridColumn: 'span 8', minHeight: '340px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <span className="stats-label">Core Specialization</span>
                  <div className="simple-about-icon-wrap" style={{ margin: 0 }}>
                    <PartyPopper size={22} />
                  </div>
                </div>
                <h3 style={{ fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)', lineHeight: 1.15, marginBottom: '0.9rem' }}>
                  Kids' Party Specialist & <span className="serif-italic">Thematic Styling.</span>
                </h3>
                <p style={{ color: '#5A3D10', fontSize: '0.96rem', lineHeight: 1.7, maxWidth: '580px' }}>
                  Custom thematic backdrops, balloon garlands, candy dessert corners, and entertainment coordination designed to bring wonder and celebration to every young celebrant.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                <span className="bento-tag">Thematic Backdrops</span>
                <span className="bento-tag">Balloon Garlands</span>
                <span className="bento-tag">Dessert Tables</span>
                <span className="bento-tag">Entertainment Coordination</span>
              </div>
            </div>

            {/* Bento Card 2: Food Buffer (Span 4, High-Contrast Dark Accent) */}
            <div className="bento-card reveal" style={{ gridColumn: 'span 4', minHeight: '340px', background: 'var(--obsidian)', color: '#FFFFFF' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <span className="stats-label" style={{ color: 'var(--gold)' }}>Zero Extra Charge</span>
                  <div className="simple-about-icon-wrap" style={{ margin: 0, background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--gold)' }}>
                    <UtensilsCrossed size={22} />
                  </div>
                </div>
                <h3 style={{ fontSize: 'clamp(1.6rem, 2.2vw, 2rem)', color: '#FFFFFF', lineHeight: 1.15, marginBottom: '0.9rem' }}>
                  +10 Pax Food <span className="serif-italic" style={{ color: 'var(--gold)' }}>Buffer.</span>
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.94rem', lineHeight: 1.7 }}>
                  Every standard package includes a complimentary 10-guest food buffer so your celebration never runs short. Genuine hospitality without worry.
                </p>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '1rem', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>
                Included in all standard tiers
              </div>
            </div>

            {/* Bento Card 3: Inclusions (Span 6) */}
            <div className="bento-card reveal" style={{ gridColumn: 'span 6', minHeight: '270px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <span className="stats-label">Standard Inclusions</span>
                  <div className="simple-about-icon-wrap" style={{ margin: 0 }}>
                    <PackageCheck size={22} />
                  </div>
                </div>
                <h3 style={{ fontSize: '1.5rem', lineHeight: 1.2, marginBottom: '0.8rem' }}>
                  All-Inclusive <span className="serif-italic">Banquet Setup.</span>
                </h3>
                <p style={{ color: '#5A3D10', fontSize: '0.94rem', lineHeight: 1.7 }}>
                  Free custom tarpaulin layout, party hats, roll-top chafing warmers, complete dining ware, linens, and attentive uniformed service crew.
                </p>
              </div>
            </div>

            {/* Bento Card 4: Lead Time (Span 6) */}
            <div className="bento-card reveal" style={{ gridColumn: 'span 6', minHeight: '270px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <span className="stats-label">Protection Policy</span>
                  <div className="simple-about-icon-wrap" style={{ margin: 0 }}>
                    <CalendarClock size={22} />
                  </div>
                </div>
                <h3 style={{ fontSize: '1.5rem', lineHeight: 1.2, marginBottom: '0.8rem' }}>
                  14-Day Advance <span className="serif-italic">Lead Time Protection.</span>
                </h3>
                <p style={{ color: '#5A3D10', fontSize: '0.94rem', lineHeight: 1.7 }}>
                  Dedicated reservation calendar protecting every booked date. Allows thorough ingredient sourcing, custom prop prep, and kitchen team focus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PACKAGES SECTION — Assuretech-style Typography & Cards */}
      <section id="services-section" className="simple-section">
        <div className="landing-container">
          <div className="reveal section-header-center">
            <span className="stats-label">02 / Signature Menus</span>
            <h2 className="simple-title">
              Curated Packages with <span className="serif-italic">Bespoke Taste.</span>
            </h2>
            <p className="simple-subtitle">
              All packages include full buffet setup, motif linens, tableware, and a complimentary <strong>+10 pax food buffer</strong>.
            </p>
          </div>

          <div className="simple-packages-grid">
            {SINAG_PACKAGES.map((pkg, idx) => {
              const isFeatured = idx === 1
              const startingPrice = pkg.pricePerHead !== undefined
                ? pkg.pricePerHead * (pkg.defaultPax ?? pkg.tiers[0].pax)
                : pkg.tiers[0].price
              const defaultGuests = pkg.defaultPax ?? pkg.tiers[0].pax

              return (
                <div key={pkg.id} className={`simple-package-card reveal ${isFeatured ? 'featured' : ''}`}>
                  {isFeatured && <span className="simple-badge">Most Popular</span>}
                  <h3 className="simple-pkg-name">{pkg.name}</h3>
                  <p className="simple-pkg-desc">{pkg.description}</p>

                  <div className="simple-price-wrap">
                    <span className="simple-price-val">{formatMoney(startingPrice, pkg.currency)}</span>
                    <span className="simple-price-pax">/ {defaultGuests} guests (+{FOOD_BUFFER_PAX} pax buffer)</span>
                  </div>

                  <ul className="simple-inclusions">
                    {pkg.inclusions.slice(0, 5).map((item) => (
                      <li key={item}>
                        <Check size={16} className="simple-check-icon" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={onStartBooking}
                    className={`simple-book-btn ${isFeatured ? 'primary' : 'outline'}`}
                  >
                    Select {pkg.shortName} <ChevronRight size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. PAST EVENTS GALLERY — Assuretech-style Clean Grid */}
      <section id="gallery-section" className="simple-section simple-bg-soft">
        <div className="landing-container">
          <div className="reveal section-header-center">
            <span className="stats-label">03 / Event Portfolio</span>
            <h2 className="simple-title">
              Celebrations & <span className="serif-italic">Gathering Moments.</span>
            </h2>
            <p className="simple-subtitle">
              A small look at weddings, debuts, and kids' birthday parties we've recently catered.
            </p>
          </div>

          <div className="simple-gallery-grid">
            {galleryHighlights.map((photo) => (
              <div key={photo.id} className="simple-gallery-item reveal">
                <img src={photo.url} alt={photo.title} loading="lazy" />
                <div className="simple-gallery-overlay">
                  <span className="simple-gallery-tag">{photo.tag}</span>
                  <h4>{photo.title}</h4>
                </div>
              </div>
            ))}
          </div>

          <div className="gallery-action-wrap">
            <button type="button" onClick={onStartBooking} className="btn-hero-primary">
              Book Your Date Now <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS — Assuretech-style Step Framework */}
      <section className="simple-section">
        <div className="landing-container">
          <div className="reveal section-header-center">
            <span className="stats-label">04 / Planning Framework</span>
            <h2 className="simple-title">
              Seamless 3-Step <span className="serif-italic">Reservation.</span>
            </h2>
          </div>

          <div className="simple-steps-row">
            <div className="simple-step-item reveal">
              <div className="simple-step-num">01</div>
              <h3>Pick a Package</h3>
              <p>Choose Silver, Gold, or Platinum and select your 4 course dishes.</p>
            </div>
            <div className="simple-step-item reveal">
              <div className="simple-step-num">02</div>
              <h3>Select Your Date</h3>
              <p>Pick an available celebration date (requires 14 days advance notice).</p>
            </div>
            <div className="simple-step-item reveal">
              <div className="simple-step-num">03</div>
              <h3>Confirm via GCash</h3>
              <p>Settle the 50% downpayment via GCash QR to lock your reservation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONTACT & INQUIRIES — Assuretech-style Direct Desk */}
      <section id="contact-section" className="simple-section simple-bg-soft">
        <div className="landing-container">
          <div className="reveal section-header-center">
            <span className="stats-label">05 / Concierge Desk</span>
            <h2 className="simple-title">
              Connect with Our <span className="serif-italic">Event Specialists.</span>
            </h2>
            <p className="simple-subtitle">Call us directly or send a message below.</p>
          </div>

          <div className="simple-contact-container">
            <div className="simple-contact-details reveal">
              <div className="simple-contact-line">
                <Phone size={20} className="simple-contact-icon" />
                <div>
                  <strong>Hotline & GCash</strong>
                  <a href="tel:09287144597">0928 714 4597</a>
                </div>
              </div>

              <div className="simple-contact-line">
                <MapPin size={20} className="simple-contact-icon" />
                <div>
                  <strong>Location</strong>
                  <span>Baliwag, Bulacan, Philippines</span>
                </div>
              </div>

              <div className="simple-contact-line">
                <Calendar size={20} className="simple-contact-icon" />
                <div>
                  <strong>Lead Time Rule</strong>
                  <span>Minimum 14 days advance booking</span>
                </div>
              </div>
            </div>

            <div className="simple-contact-form-box reveal">
              {inquirySuccess && (
                <div className="alert-box success" style={{ marginBottom: '16px' }}>
                  Thank you! Your message has been sent to our coordinator.
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!inquiryName || !inquiryEmail || !inquiryMessage) return
                  createInquiryDirect(inquiryName, inquiryEmail, inquiryMessage)
                  setInquirySuccess(true)
                  setInquiryName('')
                  setInquiryEmail('')
                  setInquiryMessage('')
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Name</label>
                    <input
                      type="text"
                      className="input-field"
                      required
                      placeholder="Your name"
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email</label>
                    <input
                      type="email"
                      className="input-field"
                      required
                      placeholder="Your email"
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Message</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    required
                    placeholder="Ask about dates, menus, or custom setups..."
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', minHeight: '120px', resize: 'vertical', display: 'block' }}
                  />
                </div>

                <button type="submit" className="btn-hero-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Send Message <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
