import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronRight,
  Sparkles,
  Phone,
  X,
  ChevronLeft,
  Layers,
  Camera,
} from 'lucide-react'
import {
  ALL_GALLERY_ITEMS,
} from '../data/galleryData'
import type { GalleryItem } from '../data/galleryData'

interface GalleryPageProps {
  onStartBooking: () => void
  onNavigateHome?: () => void
}

const CATEGORIES = [
  'All',
  'Weddings',
  'Birthdays',
  'Debuts',
  'Christening',
  'Buffet & Food',
  'Styling & Setups',
  'Special Events',
] as const

type CategoryType = (typeof CATEGORIES)[number]

export const GalleryPage: React.FC<GalleryPageProps> = ({ onStartBooking }) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return ALL_GALLERY_ITEMS
    return ALL_GALLERY_ITEMS.filter((item) => item.category === selectedCategory)
  }, [selectedCategory])

  const activeLightboxItem: GalleryItem | null =
    lightboxIndex !== null ? filteredItems[lightboxIndex] ?? null : null

  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index)
  }

  const handleCloseLightbox = () => {
    setLightboxIndex(null)
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (lightboxIndex === null) return
    setLightboxIndex((prev) => (prev! > 0 ? prev! - 1 : filteredItems.length - 1))
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (lightboxIndex === null) return
    setLightboxIndex((prev) => (prev! < filteredItems.length - 1 ? prev! + 1 : 0))
  }

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseLightbox()
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : filteredItems.length - 1))
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : 0))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, filteredItems.length])

  // Prevent scroll behind lightbox
  useEffect(() => {
    if (lightboxIndex === null) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [lightboxIndex])

  return (
    <div className="gallery-page-container">
      {/* 1. HERO HEADER */}
      <section className="gallery-hero-header">
        <div className="landing-container">
          <div className="gallery-hero-content">
            <div className="gallery-kicker">
              <Camera size={14} />
              <span>Sinag Visual Portfolio</span>
            </div>
            <h1 className="gallery-page-title">
              Celebration & <span className="serif-italic">Banquet Gallery.</span>
            </h1>
            <p className="gallery-page-subtitle">
              Browse through our collection of real weddings, joyous kids’ birthdays,
              regal debuts, sacred christenings, appetizing Filipino buffets, and custom setups.
            </p>

            {/* Category Filter Pills */}
            <div className="gallery-category-nav" role="tablist" aria-label="Filter gallery categories">
              {CATEGORIES.map((cat) => {
                const count =
                  cat === 'All'
                    ? ALL_GALLERY_ITEMS.length
                    : ALL_GALLERY_ITEMS.filter((i) => i.category === cat).length
                const isActive = selectedCategory === cat

                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`gallery-cat-pill ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory(cat)
                      setLightboxIndex(null)
                    }}
                  >
                    <span>{cat}</span>
                    <span className="cat-count-badge">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. GALLERY GRID SECTION */}
      <section className="gallery-grid-section">
        <div className="landing-container">
          <div className="gallery-results-meta">
            <span>
              Showing <strong>{filteredItems.length}</strong> photo{filteredItems.length === 1 ? '' : 's'} in{' '}
              <strong>{selectedCategory}</strong>
            </span>
            <span className="gallery-meta-hint">Click any photo to view in high resolution</span>
          </div>

          <div className="curated-gallery-grid">
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className="curated-gallery-card"
                onClick={() => handleOpenLightbox(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleOpenLightbox(idx)
                  }
                }}
                aria-label={`View photo: ${item.title}`}
              >
                <div className="gallery-card-media">
                  <img src={item.url} alt={item.title} loading="lazy" />
                  <div className="gallery-card-badge">
                    <Layers size={12} />
                    <span>{item.category}</span>
                  </div>
                </div>
                <div className="gallery-card-info">
                  <h3 className="gallery-item-title">{item.title}</h3>
                  <p className="gallery-item-desc">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="gallery-empty-state">
              <Camera size={40} />
              <h3>No photos found in this category</h3>
              <p>Please select another category above to view our event portfolio.</p>
              <button
                type="button"
                className="btn-hero-outline"
                onClick={() => setSelectedCategory('All')}
              >
                View All Categories
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3. LIGHTBOX MODAL */}
      {activeLightboxItem && createPortal(
        <div
          className="gallery-lightbox-overlay"
          onClick={handleCloseLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="gallery-lightbox-close"
              onClick={handleCloseLightbox}
              aria-label="Close photo preview"
            >
              <X size={22} />
            </button>

            <button
              type="button"
              className="gallery-lightbox-nav prev"
              onClick={handlePrev}
              aria-label="Previous photo"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              type="button"
              className="gallery-lightbox-nav next"
              onClick={handleNext}
              aria-label="Next photo"
            >
              <ChevronRight size={24} />
            </button>

            <div className="gallery-lightbox-image-wrap">
              <img
                src={activeLightboxItem.url}
                alt={activeLightboxItem.title}
                className="gallery-lightbox-img"
              />
            </div>

            <div className="gallery-lightbox-footer">
              <div className="gallery-lightbox-details">
                <div className="gallery-lightbox-tags">
                  <span className="gallery-lightbox-badge">{activeLightboxItem.category}</span>
                  <span className="gallery-lightbox-counter">
                    {lightboxIndex! + 1} of {filteredItems.length}
                  </span>
                </div>
                <h3 className="gallery-lightbox-title">{activeLightboxItem.title}</h3>
                <p className="gallery-lightbox-desc">{activeLightboxItem.description}</p>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* 4. CALL TO ACTION BANNER */}
      <section className="gallery-cta-banner">
        <div className="landing-container">
          <div className="gallery-cta-box">
            <div className="gallery-cta-text">
              <div className="gallery-cta-kicker">
                <Sparkles size={14} />
                <span>Ready to Create Unforgettable Memories?</span>
              </div>
              <h2>Bring this celebration ambiance to your event.</h2>
              <p>
                Every standard booking includes curated buffet presentation, linen styling,
                chafing dishes, full dining set, attentive crew, and a complimentary +10 pax food buffer.
              </p>
            </div>
            <div className="gallery-cta-buttons">
              <button type="button" onClick={onStartBooking} className="btn-hero-primary">
                Start Booking Now <ChevronRight size={16} />
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
export default GalleryPage
