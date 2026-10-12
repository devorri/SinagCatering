import React, { useState } from 'react'
import { ArrowRight, X, Eye, EyeOff, AlertCircle, Lock, Sparkles, CheckCircle2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PasswordStrengthIndicator, getPasswordValidationError } from './PasswordStrengthIndicator'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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

    if (isRegistering) {
      if (!name.trim()) {
        setError('Please enter your full name to register.')
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
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        <div className="login-modal-header">
          <img
            src="/sinag_logo.png"
            alt="Sinag Catering"
            className="brand-logo-img"
            style={{ width: '52px', height: '52px', margin: '0 auto 12px', display: 'block' }}
          />
          <div className="login-modal-badge">
            <Sparkles size={12} style={{ color: 'var(--terracotta)' }} />
            <span>Sinag Client Access</span>
          </div>
          <h2 className="login-modal-title">
            {isRegistering ? 'Create Client Account' : 'Sign In to Book'}
          </h2>
          <p className="login-modal-sub">
            {isRegistering
              ? 'Register your client account to reserve dates, customize menus, and track event progress.'
              : 'Sign in to access your reservation details and complete your event booking.'}
          </p>
        </div>

        {/* Tab switcher for Sign In vs Register */}
        <div className="login-modal-tabs">
          <button
            type="button"
            className={`login-modal-tab ${!isRegistering ? 'active' : ''}`}
            onClick={() => handleTabChange(false)}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`login-modal-tab ${isRegistering ? 'active' : ''}`}
            onClick={() => handleTabChange(true)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  required
                  placeholder="e.g. Maria Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Mobile Number (For SMS & Updates)</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="0928 714 4597"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              className="input-field"
              required
              placeholder="maria@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ width: '100%', paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isRegistering ? (
              <PasswordStrengthIndicator password={password} showChecklist={true} />
            ) : (
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
                Enter your account password
              </span>
            )}
          </div>

          {isRegistering && (
            <div className="form-group">
              <label>Confirm Password</label>
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
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
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
            className="btn-hero-primary"
            style={{ width: '100%', marginTop: '6px', minHeight: '48px', justifyContent: 'center' }}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Please wait...'
              : isRegistering
                ? 'Register & Continue to Booking'
                : 'Sign In & Continue to Booking'}
            <ArrowRight size={16} />
          </button>

          <div style={{ marginTop: '18px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => handleTabChange(!isRegistering)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {isRegistering
                ? 'Already have an account? Sign in instead'
                : 'New client? Create an account to start'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '16px',
              color: 'var(--muted)',
              fontSize: '0.78rem',
            }}
          >
            <Lock size={12} />
            <span>Secure reservation access for Sinag clients</span>
          </div>
        </form>
      </div>
    </div>
  )
}
