import React, { useState } from 'react'
import {
  ChevronRight,
  Sparkles,
  Phone,
  X,
  Star,
  Users,
  Utensils,
  Award,
  MessageSquareHeart,
  Maximize2,
} from 'lucide-react'
import {
  CLIENT_REACTION_SCREENSHOTS,
} from '../data/galleryData'
import type { ClientReactionScreenshot } from '../data/galleryData'

interface TestimonialsPageProps {
  onStartBooking: () => void
}

export const TestimonialsPage: React.FC<TestimonialsPageProps> = ({ onStartBooking }) => {
  const [activeReactionModal, setActiveReactionModal] = useState<ClientReactionScreenshot | null>(null)

  return (
    <div className="testimonials-page-container">
      {/* 1. HERO HEADER */}
      <section className="testimonials-hero-header">
        <div className="landing-container">
          <div className="testimonials-hero-content">
            <div className="testimonials-kicker">
              <MessageSquareHeart size={14} />
              <span>Real Client Reactions & Feedback</span>
            </div>
            <h1 className="testimonials-page-title">
              Loved by Families, <span className="serif-italic">Cherished in Memories.</span>
            </h1>
            <p className="testimonials-page-subtitle">
              Browse authentic message screenshots sent directly by clients after their celebrations.
              Click any screenshot below to view in full size.
            </p>

            {/* Metrics Trust Strip */}
            <div className="testimonials-stats-strip">
              <div className="t-stat-card">
                <div className="t-stat-icon-wrap">
                  <Star size={18} className="fill-gold" />
                </div>
                <div>
                  <span className="t-stat-num">4.9 / 5.0</span>
                  <span className="t-stat-label">Client Satisfaction Rating</span>
                </div>
              </div>

              <div className="t-stat-card">
                <div className="t-stat-icon-wrap">
                  <Users size={18} />
                </div>
                <div>
                  <span className="t-stat-num">250+</span>
                  <span className="t-stat-label">Successful Events Catered</span>
                </div>
              </div>

              <div className="t-stat-card">
                <div className="t-stat-icon-wrap">
                  <Utensils size={18} />
                </div>
                <div>
                  <span className="t-stat-num">+10 Pax</span>
                  <span className="t-stat-label">Free Buffer with Zero Shortages</span>
                </div>
              </div>

              <div className="t-stat-card">
                <div className="t-stat-icon-wrap">
                  <Award size={18} />
                </div>
                <div>
                  <span className="t-stat-num">100%</span>
                  <span className="t-stat-label">Verified Client Feedback</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REAL CHAT REACTION SCREENSHOTS GRID */}
      <section className="simple-section simple-bg-soft">
        <div className="landing-container">
          <div className="reveal section-header-center">
            <span className="stats-label">Client Messages</span>
            <h2 className="simple-title">
              Authentic Feedback <span className="serif-italic">From Celebrations.</span>
            </h2>
            <p className="simple-subtitle">
              Click any client conversation screenshot to zoom in.
            </p>
          </div>

          <div className="reactions-interactive-grid">
            {CLIENT_REACTION_SCREENSHOTS.map((reax) => (
              <div
                key={reax.id}
                className="reaction-interactive-card"
                onClick={() => setActiveReactionModal(reax)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveReactionModal(reax)
                  }
                }}
                aria-label={`View ${reax.title}`}
              >
                <div className="reax-img-wrap">
                  <img src={reax.url} alt={reax.title} loading="lazy" />
                  <div className="reax-zoom-hint">
                    <Maximize2 size={15} />
                    <span>Click to Zoom</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. LIGHTBOX MODAL FOR SCREENSHOTS */}
      {activeReactionModal && (
        <div
          className="reaction-modal-overlay"
          onClick={() => setActiveReactionModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Client reaction message"
        >
          <div className="reaction-modal-box" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="gallery-lightbox-close"
              onClick={() => setActiveReactionModal(null)}
              aria-label="Close message preview"
            >
              <X size={22} />
            </button>

            <div className="reaction-modal-media">
              <img src={activeReactionModal.url} alt={activeReactionModal.title} />
            </div>
          </div>
        </div>
      )}

      {/* 4. CALL TO ACTION BANNER */}
      <section className="testimonials-cta-banner">
        <div className="landing-container">
          <div className="testimonials-cta-box">
            <div className="testimonials-cta-text">
              <div className="gallery-cta-kicker">
                <Sparkles size={14} />
                <span>Ready to Celebrate With Us?</span>
              </div>
              <h2>Experience thoughtful, generous catering for your event.</h2>
              <p>
                Every standard package includes complimentary tableware, buffet linens,
                roll-top warmers, attentive service staff, and a +10 pax food buffer.
              </p>
            </div>
            <div className="testimonials-cta-buttons">
              <button type="button" onClick={onStartBooking} className="btn-hero-primary">
                Start Booking <ChevronRight size={16} />
              </button>
              <a href="tel:09287144597" className="btn-hero-outline">
                <Phone size={15} /> 0928 714 4597
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
export default TestimonialsPage
