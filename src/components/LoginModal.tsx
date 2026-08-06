import React, { useState } from 'react'
import { ArrowRight, X, UserPlus } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onContinueAsGuest: () => void
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess, onContinueAsGuest }) => {
  const { login } = useApp()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Please provide a valid email address.')
      return
    }

    if (isRegistering && !name.trim()) {
      setError('Please enter your full name to register.')
      return
    }

    const displayName = isRegistering ? name : email.split('@')[0]
    login(email.toLowerCase(), displayName, 'client')
    onSuccess()
  }

  const handleQuickLogin = (qEmail: string, qName: string) => {
    login(qEmail, qName, 'client')
    onSuccess()
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--gold)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <UserPlus size={24} style={{ color: '#FFF' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', margin: '0 0 6px' }}>
            Sign In to Book
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
            Sign in to save your booking and track your reservation status.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="input-field"
                required
                placeholder="e.g. Maria Santos"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
            />
          </div>

          {error && (
            <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-hero-primary" style={{ width: '100%' }}>
            {isRegistering ? 'Register & Start Booking' : 'Sign In & Start Booking'} <ArrowRight size={16} />
          </button>

          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegistering ? 'Already registered? Sign in instead' : 'New client? Register an account'}
            </button>
          </div>
        </form>

        <div className="login-modal-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          onClick={onContinueAsGuest}
          className="btn-hero-outline"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.88rem' }}
        >
          Continue as Guest
        </button>

        <div className="demo-login-bar" style={{ marginTop: '20px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Demo Accounts:
          </span>
          <button type="button" onClick={() => handleQuickLogin('maria@email.com', 'Maria Santos')} className="btn-demo-chip" style={{ width: '100%' }}>
            👤 Maria Santos
          </button>
          <button type="button" onClick={() => handleQuickLogin('juan@email.com', 'Juan Dela Cruz')} className="btn-demo-chip" style={{ width: '100%' }}>
            👤 Juan Dela Cruz
          </button>
        </div>
      </div>
    </div>
  )
}
