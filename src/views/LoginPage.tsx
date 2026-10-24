import React, { useState } from 'react'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PasswordStrengthIndicator, getPasswordValidationError } from '../components/PasswordStrengthIndicator'
import { LoadingScreen } from '../components/LoadingScreen'
import { ForgotPasswordModal } from '../components/ForgotPasswordModal'

interface LoginPageProps {
  onLoginSuccess: (role: 'client' | 'admin') => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { signIn, signUp } = useApp()

  // Client Form State
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientPassword, setClientPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [clientError, setClientError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientError('')

    if (!clientEmail.trim()) {
      setClientError('Please enter your email or username.')
      return
    }

    if (isRegistering && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      setClientError('Please enter a valid email format (e.g. name@domain.com).')
      return
    }

    if (isRegistering) {
      if (!clientName.trim() || clientName.trim().length < 2) {
        setClientError('Please enter your full name (minimum 2 characters).')
        return
      }

      const cleanedPhone = clientPhone.replace(/[^0-9]/g, '')
      if (!clientPhone.trim() || cleanedPhone.length < 10) {
        setClientError('Please provide a valid Philippine mobile number (e.g. 0928 714 4597).')
        return
      }

      const passwordError = getPasswordValidationError(clientPassword)
      if (passwordError) {
        setClientError(passwordError)
        return
      }

      if (clientPassword !== confirmPassword) {
        setClientError('Passwords do not match. Please verify both fields.')
        return
      }

      if (!agreedToPrivacy) {
        setClientError('Please agree to the Data Privacy consent in compliance with Republic Act No. 10173 to proceed.')
        return
      }
    } else {
      if (!clientPassword) {
        setClientError('Please enter your password.')
        return
      }
    }

    setIsLoggingIn(true)
    const result = isRegistering
      ? await signUp(clientName, clientEmail, clientPhone, clientPassword)
      : await signIn(clientEmail, clientPassword)
    if (result.error) {
      setIsLoggingIn(false)
      setClientError(result.error)
      return
    }
    if (result.confirmationRequired) {
      setIsLoggingIn(false)
      setClientError('Check your email to confirm your account, then sign in here.')
      return
    }
    const authenticatedUser = result.user
    if (authenticatedUser) {
      setTimeout(() => {
        setIsLoggingIn(false)
        onLoginSuccess(authenticatedUser.role)
      }, 600)
    } else {
      setIsLoggingIn(false)
    }
  }

  if (isLoggingIn) {
    return (
      <LoadingScreen
        message={isRegistering ? 'Creating Client Account...' : 'Authenticating Session...'}
        subMessage="Preparing your reservations and catering preferences..."
      />
    )
  }

  return (
    <div className="portal-container" style={{ padding: 'clamp(20px, 4vw, 60px) 16px' }}>
      <div className="portal-auth-card" style={{ maxWidth: '520px', width: '100%', margin: '20px auto 40px', padding: 'clamp(28px, 5vw, 44px)', boxSizing: 'border-box' }}>
        <img
          src="/sinag_logo.png"
          alt="Sinag Catering"
          className="brand-logo-img"
          style={{ width: '56px', height: '56px', margin: '0 auto 16px', display: 'block', objectFit: 'contain' }}
        />
        <h2 className="portal-auth-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', fontWeight: 400, color: 'var(--ink, #1f1d1a)', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Sinag Portal Access
        </h2>
        <p className="portal-auth-sub" style={{ color: 'var(--muted, #6b7280)', fontSize: '0.95rem', margin: '0 0 28px', lineHeight: 1.45 }}>
          Sign in or register to manage your event reservation.
        </p>

        {/* Client Login / Register Form */}
        <form onSubmit={handleClientSubmit}>
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
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
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
                  placeholder="0928 714 4597"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  required
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
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
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
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
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
              <PasswordStrengthIndicator password={clientPassword} showChecklist={true} />
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
              <div className="form-group" style={{ textAlign: 'left' }}>
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
              <div className="privacy-consent-box" style={{ textAlign: 'left' }}>
                <ShieldCheck size={18} />
                <div>
                  <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>
                  <p>
                    Your personal information is collected solely for event reservation, booking verification, date protection, and concierge support by Sinag Catering. Your data is protected with strict confidentiality and will never be shared with unauthorized third parties.
                  </p>
                </div>
              </div>

              <label className="privacy-checkbox-label" style={{ textAlign: 'left' }}>
                <input
                  type="checkbox"
                  required
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                />
                <span>
                  I have read and consent to the collection and processing of my personal data under <strong>Republic Act No. 10173</strong>. <span className="required-star">*</span>
                </span>
              </label>
            </>
          )}

          {clientError && (
            <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '12px', marginBottom: '0', textAlign: 'left' }}>
              {clientError}
            </p>
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
          >
            {isRegistering ? 'Register & Continue' : 'Sign In'} <ArrowRight size={16} />
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering)
                setClientError('')
              }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Already registered? Sign in instead' : 'New client? Register an account'}
            </button>
          </div>

        </form>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialIdentifier={clientEmail}
        initialMethod="email"
        onSuccess={() => {
          setShowForgotPassword(false)
        }}
      />
    </div>
  )
}
