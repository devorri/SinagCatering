import React from 'react'

interface LoadingScreenProps {
  message?: string
  subMessage?: string
  fullScreen?: boolean
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Sinag's Catering Services",
  subMessage = 'Preparing exquisite banquet experience...',
  fullScreen = true,
}) => {
  return (
    <div
      style={{
        position: fullScreen ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        minHeight: fullScreen ? '100vh' : '360px',
        zIndex: fullScreen ? 99998 : 10,
        background: 'radial-gradient(ellipse at top, #1C1917 0%, #0F0E0D 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontFamily: 'var(--font-sans)',
        padding: '24px',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      {/* Soft Glow Effect */}
      <div
        style={{
          position: 'absolute',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(197, 160, 89, 0.18) 0%, rgba(0,0,0,0) 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      {/* Brand Logo with Pulsing Halo */}
      <div style={{ position: 'relative', marginBottom: '22px' }}>
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(197,160,89,0.2) 0%, rgba(255,255,255,0.05) 100%)',
            border: '1.5px solid rgba(197, 160, 89, 0.45)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 28px rgba(197, 160, 89, 0.25)',
            animation: 'pulseGlow 2.2s infinite ease-in-out',
          }}
        >
          <img
            src="/sinag_logo.png"
            alt="Sinag Catering"
            style={{ width: '56px', height: '56px', objectFit: 'contain' }}
            onError={(e) => {
              // Fallback if logo not loaded
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: '1.45rem',
          fontWeight: 800,
          color: '#F4E8D1',
          letterSpacing: '0.04em',
          margin: '0 0 8px',
          textAlign: 'center',
          fontFamily: 'var(--font-serif)',
        }}
      >
        {message}
      </h2>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '0.86rem',
          color: 'rgba(244, 232, 209, 0.65)',
          margin: '0 0 24px',
          textAlign: 'center',
          maxWidth: '320px',
          letterSpacing: '0.02em',
        }}
      >
        {subMessage}
      </p>

      {/* Golden Shimmer Progress Bar */}
      <div
        style={{
          width: '180px',
          height: '3px',
          background: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '45%',
            background: 'linear-gradient(90deg, transparent, #C5A059, #F5D77F, transparent)',
            borderRadius: '999px',
            animation: 'shimmerSweep 1.4s infinite ease-in-out',
          }}
        />
      </div>
    </div>
  )
}
