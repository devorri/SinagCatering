import React, { useState } from 'react'
import { ShieldCheck, ArrowRight } from 'lucide-react'
import { useApp } from '../context/AppContext'

interface LoginPageProps {
  onLoginSuccess: (role: 'client' | 'admin') => void
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useApp()
  const [authMode, setAuthMode] = useState<'client' | 'admin'>('client')

  // Client Form State
  const [clientEmail, setClientEmail] = useState('')
  const [clientName, setClientName] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [clientError, setClientError] = useState('')

  // Admin Form State
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')

  const handleClientSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setClientError('')

    if (!clientEmail.trim()) {
      setClientError('Please provide a valid email address.')
      return
    }

    if (isRegistering && !clientName.trim()) {
      setClientError('Please enter your full name to register.')
      return
    }

    const name = isRegistering ? clientName : clientEmail.split('@')[0]
    login(clientEmail.toLowerCase(), name, 'client')
    onLoginSuccess('client')
  }

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAdminError('')

    if (adminEmail === 'admin@sinagcatering.ph' && adminPassword === 'admin') {
      login(adminEmail, 'Administrator', 'admin')
      onLoginSuccess('admin')
    } else {
      setAdminError('Invalid admin credentials. Use admin@sinagcatering.ph / admin')
    }
  }

  const handleQuickClientLogin = (email: string, name: string) => {
    login(email, name, 'client')
    onLoginSuccess('client')
  }

  const handleQuickAdminLogin = () => {
    login('admin@sinagcatering.ph', 'Administrator', 'admin')
    onLoginSuccess('admin')
  }

  return (
    <div className="portal-container">
      <div className="portal-auth-card" style={{ maxWidth: '520px' }}>
        <h2 className="portal-auth-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem' }}>
          Sinag Portal Access
        </h2>
        <p className="portal-auth-sub">Sign in to manage event reservations, submit payments, or access executive tools.</p>

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

            {clientError && (
              <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {clientError}
              </p>
            )}

            <button type="submit" className="btn-hero-primary" style={{ width: '100%' }}>
              {isRegistering ? 'Register & Access Dashboard' : 'Sign In as Client'} <ArrowRight size={16} />
            </button>

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {isRegistering ? 'Already registered? Sign in instead' : 'New client? Register an account'}
              </button>
            </div>

            <div className="demo-login-bar">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Demo Accounts:
              </span>
              <button
                type="button"
                onClick={() => handleQuickClientLogin('maria@email.com', 'Maria Santos')}
                className="btn-demo-chip"
              >
                👤 Maria Santos (Wedding Client)
              </button>
              <button
                type="button"
                onClick={() => handleQuickClientLogin('juan@email.com', 'Juan Dela Cruz')}
                className="btn-demo-chip"
              >
                👤 Juan Dela Cruz (Birthday Client)
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
              <input
                type="password"
                className="input-field"
                required
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </div>

            {adminError && (
              <p style={{ color: 'var(--terracotta)', fontSize: '0.85rem', marginBottom: '16px' }}>
                {adminError}
              </p>
            )}

            <button type="submit" className="btn-hero-primary" style={{ width: '100%' }}>
              Unlock Executive Console <ShieldCheck size={16} />
            </button>

            <div className="demo-login-bar">
              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                Quick Admin Access:
              </span>
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                className="btn-demo-chip"
              >
                🔐 Sign In as Administrator
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
