import React, { useState } from 'react'
import { Check, ChevronRight, ShieldCheck, Sparkles, Star, WandSparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { SINAG_PACKAGES, FOOD_BUFFER_PAX, formatMoney } from '../data/packages'

interface LandingPageProps {
  onNavigateToClient: () => void
  onStartBooking: () => void
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartBooking }) => {
  const { reviews, addReview, createInquiryDirect } = useApp()

  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [inquiryName, setInquiryName] = useState('')
  const [inquiryEmail, setInquiryEmail] = useState('')
  const [inquiryMessage, setInquiryMessage] = useState('')
  const [inquirySuccess, setInquirySuccess] = useState(false)

  const photoPresets = [
    'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=500&auto=format&fit=crop&q=60',
    'https://images.unsplash.com/photo-1555244162-803834f70033?w=500&auto=format&fit=crop&q=60',
  ]

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    addReview(newRating, newComment, photoPresets[0])
    setNewComment('')
    setNewRating(5)
  }

  return (
    <div>
      {/* HERO / HOME SECTION */}
      <section id="top" className="landing-dark-hero">
        <div className="hero-split-layout">
          <div className="hero-blob-col">
            <div className="hero-blob-bg" />
            <div className="hero-circle-img-wrap logo-hero-wrap">
              <img src="/sinag_logo.png" alt="Sinag Catering logo" className="hero-circle-img logo-hero-img" />
            </div>
          </div>

          <div className="hero-text-col">
            <div className="hero-tag-pill">
              <Sparkles size={13} />
              <span>Planning, Catering, Event Coordination</span>
            </div>

            <h1 className="hero-display-serif">
              <span className="hero-line">We want you to</span>
              <span className="gold-italic">SHINE like a SUN</span>
              <span className="hero-line">in your special day.</span>
            </h1>

            <p className="hero-lead-text">
              Sinag's Catering Services brings your celebration to life with complete kids party packages, food buffers, entertainment coordination, and effortless online booking.
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
                <span className="hero-stat-num">6</span>
                <span className="hero-stat-lbl">Party Packages</span>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <span className="hero-stat-num">50-200</span>
                <span className="hero-stat-lbl">Pax Tiers</span>
              </div>
              <div className="hero-stat-divider" />
              <div>
                <span className="hero-stat-num">AI</span>
                <span className="hero-stat-lbl">Recommendations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT US SECTION */}
      <section id="about-section" className="section-wrapper" style={{ background: '#FFFDF9', borderBottom: '1px solid var(--line)' }}>
        <div className="section-header">
          <span className="section-tag">Who We Are</span>
          <h2 className="section-title">About Sinag Catering Services</h2>
          <p className="section-desc">
            Based in Baliwag, Bulacan, Sinag Catering Services specializes in creating magical kids birthday parties, baptisms, debuts, and family celebrations with gourmet food and full event styling.
          </p>
        </div>

        <div className="process-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div className="process-card">
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', marginBottom: '16px', color: 'var(--obsidian)' }}>
              <Sparkles size={24} />
            </div>
            <h3>Kids Party Specialist</h3>
            <p>From themed balloon backdrops to kids dessert tables and entertainment, we bring joy and color to your child's big day.</p>
          </div>

          <div className="process-card">
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', marginBottom: '16px', color: 'var(--obsidian)' }}>
              <ShieldCheck size={24} />
            </div>
            <h3>Generous Food Buffer</h3>
            <p>Sinag's PHP package tiers include a complimentary <strong>+10 pax food buffer</strong>. The AI catalog uses per-guest pricing.</p>
          </div>

          <div className="process-card">
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', marginBottom: '16px', color: 'var(--obsidian)' }}>
              <Star size={24} />
            </div>
            <h3>All-Inclusive Freebies</h3>
            <p>Enjoy free tarpaulin design, party hats, game prizes, and full crew coordination included in our Gold & Platinum packages.</p>
          </div>

          <div className="process-card">
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--gold-light)', display: 'grid', placeItems: 'center', marginBottom: '16px', color: 'var(--obsidian)' }}>
              <WandSparkles size={24} />
            </div>
            <h3>Smart AI Concierge</h3>
            <p>Our built-in AI assistant helps you select the optimal package and menu items tailored to your budget and guest count.</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button type="button" onClick={onStartBooking} className="btn-hero-primary">
            Start Booking Your Event <ChevronRight size={16} />
          </button>
        </div>
      </section>

      {/* SERVICES & PACKAGES SECTION */}
      <section id="services-section" className="section-wrapper">
        <div className="section-header">
          <span className="section-tag">Our Services & Packages</span>
          <h2 className="section-title">Signature Party Catering Packages</h2>
          <p className="section-desc">Browse Sinag's PHP catering tiers and the AI catalog's per-guest buffet packages.</p>
        </div>

        <div className="process-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          {SINAG_PACKAGES.map((pkg) => (
            <div key={pkg.id} className="process-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '2px solid var(--line)', padding: '32px 28px', background: '#FFF' }}>
              <span className="section-tag" style={{ alignSelf: 'flex-start', marginBottom: '12px' }}>{pkg.shortName}</span>
              <h3 style={{ fontSize: '1.6rem', margin: '0 0 10px', fontFamily: 'var(--font-display)' }}>{pkg.name}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '20px' }}>{pkg.description}</p>
              
              <div style={{ padding: '14px 18px', background: 'var(--paper-warm)', borderRadius: '12px', marginBottom: '24px' }}>
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', display: 'block' }}>Starting Tier</span>
                <strong style={{ fontSize: '1.4rem', color: 'var(--terracotta)' }}>{formatMoney(
                  pkg.pricePerHead !== undefined
                    ? pkg.pricePerHead * (pkg.defaultPax ?? pkg.tiers[0].pax)
                    : pkg.tiers[0].price,
                  pkg.currency,
                )}</strong>
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{pkg.pricePerHead !== undefined
                  ? ` / ${pkg.defaultPax ?? pkg.tiers[0].pax} pax`
                  : ` / ${pkg.tiers[0].pax} pax (+${FOOD_BUFFER_PAX} buffer)`}</span>
              </div>

              <div style={{ flex: 1, marginBottom: '24px' }}>
                <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '12px' }}>Package Highlights:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
                  {pkg.inclusions.map((item) => (
                    <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} /> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <button type="button" onClick={onStartBooking} className="btn-hero-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Book {pkg.shortName} <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS FLOW SECTION */}
      <section className="section-wrapper" style={{ background: 'var(--paper-warm)', borderTop: '1px solid var(--line)' }}>
        <div className="section-header">
          <span className="section-tag">Complete System Flow</span>
          <h2 className="section-title">From Package Choice to Event Schedule</h2>
          <p className="section-desc">Clients can reserve dates and admins can manage bookings, staff, calendar blocks, payments, reviews, and inquiries.</p>
        </div>

        <div className="process-grid">
          {[
            ['01', 'Choose Package', 'Select a Sinag catering package suited to your celebration.'],
            ['02', 'Customize & AI Helper', 'Fine-tune guest count, add-on dishes, and get instant AI recommendations.'],
            ['03', 'Reserve Schedule', 'Pick an available date from the interactive calendar and submit your reservation.'],
            ['04', 'Admin Operations', 'Admin confirms requests, checks downpayments, assigns staff, and coordinates your event.'],
          ].map(([num, title, body]) => (
            <div key={num} className="process-card">
              <span className="font-number">{num}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '36px' }}>
          <button type="button" onClick={onStartBooking} className="btn-hero-primary">
            Start Booking Now <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <section className="section-wrapper" style={{ background: 'var(--paper-warm)', borderTop: '1px solid var(--line)' }}>
        <div className="section-header">
          <span className="section-tag">Client Reviews</span>
          <h2 className="section-title">Event Feedback</h2>
          <p className="section-desc">Customers can post reviews, and the admin can reply or moderate them.</p>
        </div>

        <div className="reviews-grid">
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div>
                <div className="review-stars">
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Star key={index} size={16} fill="var(--gold)" color="var(--gold)" />
                  ))}
                </div>
                <p className="review-text">"{review.comment}"</p>
              </div>
              <div>
                <div className="review-author-row">
                  <img src={review.imageUrl || photoPresets[1]} alt={review.userName} className="review-avatar" />
                  <div className="review-author-info">
                    <span className="review-author-name">{review.userName}</span>
                    <span className="review-author-event">{review.date}</span>
                  </div>
                </div>
                {review.reply && <div className="review-reply-box"><strong>Sinag Reply:</strong> {review.reply}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="review-form-card">
          <h3>Leave a Review</h3>
          <form onSubmit={handleReviewSubmit}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Star Rating</label>
              <div style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <Star key={num} size={22} fill={num <= newRating ? 'var(--gold)' : 'none'} color={num <= newRating ? 'var(--gold)' : 'var(--muted)'} onClick={() => setNewRating(num)} />
                ))}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Your Feedback</label>
              <textarea className="input-field" rows={3} value={newComment} onChange={(e) => setNewComment(e.target.value)} required />
            </div>
            <button type="submit" className="btn-submit-primary">Post Testimonial</button>
          </form>
        </div>
      </section>

      <section id="contact-section" className="section-wrapper">
        <div className="section-header">
          <span className="section-tag">Direct Inquiry</span>
          <h2 className="section-title">Ask Sinag</h2>
          <p className="section-desc">Questions about custom upgrades, out-of-town fees, or special setups go to the admin inquiry inbox.</p>
        </div>

        <div className="contact-card">
          {inquirySuccess && <div className="alert-box success">Thank you. Your inquiry was sent to the admin team.</div>}
          <form onSubmit={(e) => {
            e.preventDefault()
            if (!inquiryName || !inquiryEmail || !inquiryMessage) return
            createInquiryDirect(inquiryName, inquiryEmail, inquiryMessage)
            setInquirySuccess(true)
            setInquiryName('')
            setInquiryEmail('')
            setInquiryMessage('')
          }}>
            <div className="booking-form-grid">
              <div className="form-group">
                <label>Your Name</label>
                <input type="text" className="input-field" value={inquiryName} onChange={(e) => setInquiryName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" className="input-field" value={inquiryEmail} onChange={(e) => setInquiryEmail(e.target.value)} required />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Message / Inquiry</label>
              <textarea className="input-field" rows={4} value={inquiryMessage} onChange={(e) => setInquiryMessage(e.target.value)} required />
            </div>
            <button type="submit" className="btn-hero-primary" style={{ width: '100%' }}>Send Inquiry Message</button>
          </form>
        </div>
      </section>
    </div>
  )
}
