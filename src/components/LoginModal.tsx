import React, { useState } from 'react'
import { ArrowRight, X, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PasswordStrengthIndicator, getPasswordValidationError } from './PasswordStrengthIndicator'
import { ForgotPasswordModal } from './ForgotPasswordModal'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signIn, signUp } = useApp()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  if (!isOpen) return null

  const resetState = () => {
    setError('')
    setInfoMessage('')
  }

  const handleTabChange = (registerMode: boolean) => {
    setIsRegistering(registerMode)
    resetState()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')

    if (!email.trim()) {
      setError('Please provide a valid email address.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email format (e.g. name@domain.com).')
      return
    }

    if (isRegistering) {
      if (!name.trim() || name.trim().length < 2) {
        setError('Please enter your full name (minimum 2 characters).')
        return
      }

      const cleanedPhone = phone.replace(/[^0-9]/g, '')
      if (!phone.trim() || cleanedPhone.length < 10) {
        setError('Please provide a valid Philippine mobile number (e.g. 0928 714 4597).')
        return
      }

      const passwordError = getPasswordValidationError(password)
      if (passwordError) {
        setError(passwordError)
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify both fields.')
        return
      }

      if (!agreedToPrivacy) {
        setError('Please agree to the Data Privacy consent in compliance with Republic Act No. 10173 to proceed.')
        return
      }
    } else {
      if (!password) {
        setError('Please enter your password.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const result = isRegistering
        ? await signUp(name, email, phone, password)
        : await signIn(email, password)

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.confirmationRequired) {
        setInfoMessage('Check your email to confirm your account, then sign in.')
        return
      }

      if (result.user) {
        onSuccess()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-card" style={{ maxWidth: '520px', width: '100%', padding: 'clamp(28px, 5vw, 44px)', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="login-modal-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/sinag_logo.png"
            alt="Sinag Catering"
            className="brand-logo-img"
            style={{ width: '56px', height: '56px', margin: '0 auto 16px', display: 'block', objectFit: 'contain' }}
          />
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', fontWeight: 400, color: 'var(--ink, #1f1d1a)', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Sinag Portal Access
          </h2>
          <p style={{ color: 'var(--muted, #6b7280)', fontSize: '0.95rem', margin: 0, lineHeight: 1.45 }}>
            Sign in or register to manage your event reservation.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151', marginBottom: '8px' }}>
                  FULL NAME <span className="required-star" style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="e.g. Maria Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151', marginBottom: '8px' }}>
                  MOBILE NUMBER (FOR SMS & UPDATES) <span className="required-star" style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="tel"
                  className="input-field"
                  required
                  placeholder="0928 714 4597"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151', marginBottom: '8px' }}>
              EMAIL ADDRESS <span className="required-star" style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="maria@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
            />
          </div>

          <div className="form-group" style={{ textAlign: 'left', marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#374151', marginBottom: '8px' }}>
              PASSWORD <span className="required-star" style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ width: '100%', padding: '12px 42px 12px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted, #6b7280)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  zIndex: 2,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isRegistering ? (
              <PasswordStrengthIndicator password={password} showChecklist={true} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted, #6b7280)' }}>
                  Enter your account password
                </span>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--terracotta, #8c4a2f)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {isRegistering && (
            <>
              <div className="form-group">
                <label>
                  Confirm Password <span className="required-star">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input-field"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    style={{ width: '100%', paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: showConfirmPassword ? 'var(--terracotta)' : 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      zIndex: 2,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Republic Act No. 10173 Data Privacy Act Notice & Consent */}
              <div className="privacy-consent-box">
                <ShieldCheck size={18} />
                <div>
                  <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>
                  <p>
                    Your personal information is collected solely for event reservation, booking verification, date protection, and concierge support by Sinag Catering. Your data is protected with strict confidentiality and will never be shared with unauthorized third parties.
                  </p>
                </div>
              </div>

              <label className="privacy-checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>
                  I have read and consent to the collection and processing of my personal data under <strong>Republic Act No. 10173</strong>. <span className="required-star">*</span>
                </span>
              </label>
            </>
          )}

          {error && (
            <div className="login-modal-alert">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="login-modal-alert info">
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{infoMessage}</span>
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              marginTop: '22px',
              padding: '13px 18px',
              background: '#1f1d1a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Please wait...'
              : isRegistering
                ? 'Register & Continue'
                : 'Sign In'}
            <ArrowRight size={16} />
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => handleTabChange(!isRegistering)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {isRegistering
                ? 'Already registered? Sign in instead'
                : 'New client? Register an account'}
            </button>
          </div>
        </form>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialIdentifier={email}
        initialMethod="email"
        onSuccess={() => setShowForgotPassword(false)}
      />
    </div>
  )
}
