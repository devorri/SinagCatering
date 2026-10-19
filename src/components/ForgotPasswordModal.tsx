import React, { useState, useEffect } from 'react'
import {
  X,
  Mail,
  Smartphone,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PasswordStrengthIndicator, getPasswordValidationError } from './PasswordStrengthIndicator'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialIdentifier?: string
  initialMethod?: 'email' | 'sms'
}

type ResetStep = 'request' | 'verify' | 'success'

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialIdentifier = '',
  initialMethod = 'email',
}) => {
  const { requestPasswordResetOTP, verifyAndResetPassword } = useApp()

  const [step, setStep] = useState<ResetStep>('request')
  const [method, setMethod] = useState<'email' | 'sms'>(initialMethod)
  const [identifier, setIdentifier] = useState(initialIdentifier)
  const [maskedTarget, setMaskedTarget] = useState('')
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null)

  // Verification fields
  const [otpInput, setOtpInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Loading & Error states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (isOpen) {
      setStep('request')
      setMethod(initialMethod)
      setIdentifier(initialIdentifier)
      setOtpInput('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setSimulatedOtp(null)
    }
  }, [isOpen, initialIdentifier, initialMethod])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  if (!isOpen) return null

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const res = await requestPasswordResetOTP(identifier, method)
    setIsSubmitting(false)

    if (!res.success) {
      setError(res.error || 'Failed to dispatch verification code.')
      return
    }

    setMaskedTarget(res.maskedTarget || identifier)
    if (res.simulatedOtp) {
      setSimulatedOtp(res.simulatedOtp)
    } else {
      setSimulatedOtp(null)
    }
    setStep('verify')
    setResendCooldown(60)
  }

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || isSubmitting) return
    setError('')
    setIsSubmitting(true)

    const res = await requestPasswordResetOTP(identifier, method)
    setIsSubmitting(false)

    if (!res.success) {
      setError(res.error || 'Failed to resend verification code.')
      return
    }

    if (res.simulatedOtp) {
      setSimulatedOtp(res.simulatedOtp)
    }
    setResendCooldown(60)
  }

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanOtp = otpInput.replace(/[^0-9]/g, '').trim()
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit OTP passcode.')
      return
    }

    const passwordValError = getPasswordValidationError(newPassword)
    if (passwordValError) {
      setError(passwordValError)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify both fields.')
      return
    }

    setIsSubmitting(true)
    const res = await verifyAndResetPassword(cleanOtp, newPassword)
    setIsSubmitting(false)

    if (!res.success) {
      setError(res.error || 'Verification failed. Please check your OTP code.')
      return
    }

    setStep('success')
  }

  return (
    <div className="login-modal-overlay" onClick={onClose} style={{ zIndex: 12000 }}>
      <div
        className="login-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '92%', borderRadius: '16px', padding: '30px 28px' }}
      >
        <button
          className="login-modal-close"
          onClick={onClose}
          aria-label="Close modal"
          style={{ top: '16px', right: '16px' }}
        >
          <X size={18} />
        </button>

        {/* STEP 1: REQUEST OTP */}
        {step === 'request' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(217, 119, 6, 0.12)',
                  color: 'var(--gold-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <Lock size={26} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', margin: '0 0 6px', color: 'var(--obsidian)' }}>
                Forgot Password?
              </h3>
              <p style={{ fontSize: '0.86rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                Choose where you want to receive your 6-digit verification OTP code.
              </p>
            </div>

            {/* Method Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '4px',
                background: '#F1F5F9',
                borderRadius: '10px',
                marginBottom: '18px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMethod('email')
                  setError('')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: method === 'email' ? '#FFFFFF' : 'transparent',
                  color: method === 'email' ? 'var(--obsidian)' : '#64748B',
                  fontWeight: method === 'email' ? 700 : 500,
                  fontSize: '0.84rem',
                  boxShadow: method === 'email' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Mail size={15} /> Via Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setMethod('sms')
                  setError('')
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: method === 'sms' ? '#FFFFFF' : 'transparent',
                  color: method === 'sms' ? 'var(--obsidian)' : '#64748B',
                  fontWeight: method === 'sms' ? 700 : 500,
                  fontSize: '0.84rem',
                  boxShadow: method === 'sms' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Smartphone size={15} /> Via SMS
              </button>
            </div>

            <form onSubmit={handleRequestOTP}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  {method === 'email' ? 'Registered Email Address' : 'Registered Mobile Number (PH)'}
                </label>
                <input
                  type={method === 'email' ? 'email' : 'tel'}
                  className="input-field"
                  required
                  placeholder={method === 'email' ? 'e.g. maria@example.com' : 'e.g. 0928 714 4597'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  style={{ width: '100%', fontSize: '0.92rem' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  background: 'rgba(217, 119, 6, 0.08)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  color: '#92400E',
                  marginBottom: '18px',
                  lineHeight: 1.45,
                }}
              >
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--gold-dark)' }} />
                <span>
                  The OTP code will be valid for <strong>15 minutes</strong>. Never share your authentication code with anyone.
                </span>
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#B91C1C',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-hero-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Sending OTP...
                  </>
                ) : (
                  <>
                    Send Reset OTP <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: VERIFY OTP & SET NEW PASSWORD */}
        {step === 'verify' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'rgba(5, 150, 105, 0.12)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <ShieldCheck size={26} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', margin: '0 0 6px', color: 'var(--obsidian)' }}>
                Verify & Reset Password
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                Enter the 6-digit OTP code sent to <strong style={{ color: 'var(--obsidian)' }}>{maskedTarget}</strong>
              </p>
            </div>

            {simulatedOtp && (
              <div
                style={{
                  background: '#FEF3C7',
                  border: '1px dashed #D97706',
                  color: '#92400E',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  marginBottom: '14px',
                  textAlign: 'center',
                }}
              >
                Test Mode OTP Code: <strong style={{ fontSize: '1rem', letterSpacing: '2px' }}>{simulatedOtp}</strong>
              </div>
            )}

            <form onSubmit={handleVerifyAndReset}>
              {/* 6-Digit OTP */}
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    One Time Password (OTP) <span className="required-star">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.76rem',
                      color: 'var(--gold-dark)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: 600,
                    }}
                  >
                    Change {method === 'email' ? 'email' : 'number'}
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  className="input-field"
                  required
                  placeholder="••••••"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    letterSpacing: '8px',
                    fontWeight: 700,
                    padding: '8px',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>Valid for 15 minutes</span>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendCooldown > 0 || isSubmitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.76rem',
                      color: resendCooldown > 0 ? '#94A3B8' : 'var(--terracotta)',
                      cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  New Password <span className="required-star">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="input-field"
                    required
                    placeholder="Enter new secure password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '42px', fontSize: '0.88rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: showNewPassword ? 'var(--terracotta)' : '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      zIndex: 2,
                    }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={newPassword} showChecklist={true} />
              </div>

              {/* Confirm Password */}
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Confirm New Password <span className="required-star">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input-field"
                    required
                    placeholder="Re-type new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ width: '100%', paddingRight: '42px', fontSize: '0.88rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: showConfirmPassword ? 'var(--terracotta)' : '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px',
                      zIndex: 2,
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#B91C1C',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-hero-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Updating Password...
                  </>
                ) : (
                  'Verify OTP & Save Password'
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(5, 150, 105, 0.12)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', margin: '0 0 10px', color: 'var(--obsidian)' }}>
              Password Reset Complete!
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '24px', lineHeight: 1.55 }}>
              Your password has been successfully updated. You can now log in to Sinag Catering with your new credentials.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose()
                if (onSuccess) onSuccess()
              }}
              className="btn-hero-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Return to Sign In <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
