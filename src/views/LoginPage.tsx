import React, { useState } from 'react'
import { ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface LoginPageProps {
  onLoginSuccess: (role: 'client' | 'admin') => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { signIn, signUp } = useApp()
  const [authMode, setAuthMode] = useState<'client' | 'admin'>('client')

  // Client Form State
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientPassword, setClientPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [clientError, setClientError] = useState('')

  // Admin Form State
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [adminError, setAdminError] = useState('')

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setClientError('')

    if (!clientEmail.trim()) {
      setClientError('Please provide a valid email address.')
      return
    }

    // Password validation (Item 6)
    if (!clientPassword || clientPassword.length < 8) {
      setClientError('Password must be at least 8 characters long.')
      return
    }

    if (isRegistering) {
      if (!clientName.trim()) {
        setClientError('Please enter your full name to register.')
        return
      }

      if (clientPassword !== confirmPassword) {
        setClientError('Passwords do not match. Please verify both fields.')
        return
      }

    }

    const result = isRegistering
      ? await signUp(clientName, clientEmail, clientPhone, clientPassword)
      : await signIn(clientEmail, clientPassword)
    if (result.error) {
      setClientError(result.error)
      return
    }
    if (result.confirmationRequired) {
      setClientError('Check your email to confirm your account, then sign in here.')
      return
    }
    if (result.user) onLoginSuccess(result.user.role)
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError('')
    const result = await signIn(adminEmail, adminPassword)
    if (result.error) {
      setAdminError(result.error)
      return
    }
    if (result.user?.role !== 'admin') {
      setAdminError('This account does not have administrator access.')
      return
    }
    onLoginSuccess('admin')
  }

  return (
    <div className="portal-container">
      <div className="portal-auth-card" style={{ maxWidth: '520px' }}>
        <h2 className="portal-auth-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem' }}>
          Sinag Portal Access
        </h2>
        <p className="portal-auth-sub">Sign in to manage event reservations, verify payments, or access executive tools.</p>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--paper-warm)', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', marginBottom: '32px' }}>
          <button
            type="button"
            className={`package-tab-btn ${authMode === 'client' ? 'active' : ''}`}
            onClick={() => setAuthMode('client')}
            style={{ fontSize: '0.82rem' }}
          >
            Client Sign In
          </button>
          <button
            type="button"
            className={`package-tab-btn ${authMode === 'admin' ? 'active' : ''}`}
            onClick={() => setAuthMode('admin')}
            style={{ fontSize: '0.82rem' }}
          >
            Admin Console
          </button>
        </div>

        {/* Client Login / Register Form */}
        {authMode === 'client' && (
          <form onSubmit={handleClientSubmit}>
            {isRegistering && (
              <>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    placeholder="e.g. Maria Santos"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Mobile Number (For Semaphore SMS & OTP)</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="0928 714 4597"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    required
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
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>

            {/* Checklist Item 6: Password Input with Masking & Visibility Toggle */}
            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  required
                  placeholder="••••••••"
                  value={clientPassword}
                  onChange={(e) => setClientPassword(e.target.value)}
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
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
                Must be at least 8 characters
              </span>
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

            {clientError && (
              <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {clientError}
              </p>
            )}

            <button type="submit" className="btn-hero-primary" style={{ width: '100%', marginTop: '6px' }}>
              {isRegistering ? 'Register & Access Dashboard' : 'Sign In as Client'} <ArrowRight size={16} />
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering)
                  setClientError('')
                }}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isRegistering ? 'Already registered? Sign in instead' : 'New client? Register an account'}
              </button>
            </div>

          </form>
        )}

        {/* Admin Login Form */}
        {authMode === 'admin' && (
          <form onSubmit={handleAdminSubmit}>
            <div className="form-group">
              <label>Admin Email</label>
              <input
                type="email"
                className="input-field"
                required
                placeholder="admin@sinagcatering.ph"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  className="input-field"
                  required
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
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
                  {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {adminError && (
              <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {adminError}
              </p>
            )}

            <button type="submit" className="btn-hero-primary" style={{ width: '100%' }}>
              Unlock Executive Console <ShieldCheck size={16} />
            </button>

          </form>
        )}
      </div>
    </div>
  )
}
