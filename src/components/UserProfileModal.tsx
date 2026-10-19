import React, { useState, useEffect } from 'react'
import {
  X,
  User as UserIcon,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PasswordStrengthIndicator, getPasswordValidationError } from './PasswordStrengthIndicator'
import { ForgotPasswordModal } from './ForgotPasswordModal'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateUserProfile, changeUserPassword } = useApp()

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile')

  // Profile Edit fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('')
  const [profileErrorMsg, setProfileErrorMsg] = useState('')

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('')
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('')

  // Forgot password OTP modal trigger
  const [showOtpResetModal, setShowOtpResetModal] = useState(false)

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '')
      setPhone(currentUser.phone || '')
      setProfileSuccessMsg('')
      setProfileErrorMsg('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccessMsg('')
      setPasswordErrorMsg('')
    }
  }, [currentUser, isOpen])

  if (!isOpen || !currentUser) return null

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccessMsg('')
    setProfileErrorMsg('')

    if (!name.trim() || name.trim().length < 2) {
      setProfileErrorMsg('Please provide a valid full name (minimum 2 characters).')
      return
    }

    setProfileSaving(true)
    const res = await updateUserProfile(name, phone)
    setProfileSaving(false)

    if (!res.success) {
      setProfileErrorMsg(res.error || 'Failed to update profile.')
      return
    }

    setProfileSuccessMsg('Profile information updated successfully!')
    setTimeout(() => setProfileSuccessMsg(''), 4000)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSuccessMsg('')
    setPasswordErrorMsg('')

    if (!currentPassword) {
      setPasswordErrorMsg('Please enter your current password.')
      return
    }

    const valErr = getPasswordValidationError(newPassword)
    if (valErr) {
      setPasswordErrorMsg(valErr)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New passwords do not match. Please verify both fields.')
      return
    }

    setPasswordSaving(true)
    const res = await changeUserPassword(currentPassword, newPassword)
    setPasswordSaving(false)

    if (!res.success) {
      setPasswordErrorMsg(res.error || 'Failed to change password.')
      return
    }

    setPasswordSuccessMsg('Password changed successfully!')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setPasswordSuccessMsg(''), 5000)
  }

  const userInitials = (currentUser.name || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <>
      <div className="login-modal-overlay" onClick={onClose} style={{ zIndex: 11000 }}>
        <div
          className="login-modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '540px', width: '92%', borderRadius: '16px', padding: '28px 24px' }}
        >
          <button
            className="login-modal-close"
            onClick={onClose}
            aria-label="Close modal"
            style={{ top: '16px', right: '16px' }}
          >
            <X size={18} />
          </button>

          {/* User Header Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold))',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
              }}
            >
              {userInitials || 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', margin: 0, color: 'var(--obsidian)' }}>
                  {currentUser.name}
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: currentUser.role === 'admin' ? '#FEF2F2' : '#F0FDF4',
                    color: currentUser.role === 'admin' ? '#B91C1C' : '#15803D',
                    border: `1px solid ${currentUser.role === 'admin' ? '#FCA5A5' : '#BBF7D0'}`,
                  }}
                >
                  {currentUser.role === 'admin' ? 'Administrator' : 'Client Account'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748B' }}>
                {currentUser.email}
              </p>
            </div>
          </div>

          {/* Modal Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              padding: '4px',
              background: '#F1F5F9',
              borderRadius: '10px',
              marginBottom: '20px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 12px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === 'profile' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'profile' ? 'var(--obsidian)' : '#64748B',
                fontWeight: activeTab === 'profile' ? 700 : 500,
                fontSize: '0.84rem',
                boxShadow: activeTab === 'profile' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <UserIcon size={15} /> Personal Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '9px 12px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === 'security' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'security' ? 'var(--obsidian)' : '#64748B',
                fontWeight: activeTab === 'security' ? 700 : 500,
                fontSize: '0.84rem',
                boxShadow: activeTab === 'security' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Lock size={15} /> Password & Security
            </button>
          </div>

          {/* TAB 1: PERSONAL DETAILS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Full Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Registered Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="input-field"
                    disabled
                    value={currentUser.email}
                    style={{
                      width: '100%',
                      background: '#F8FAFC',
                      color: '#64748B',
                      cursor: 'not-allowed',
                      fontSize: '0.9rem',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.72rem',
                      color: '#059669',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle2 size={13} /> Verified
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                  Your primary login identifier and receipt delivery destination.
                </span>
              </div>

              <div className="form-group" style={{ textAlign: 'left', marginBottom: '18px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Philippine Mobile Number (SMS Alerts)
                </label>
                <input
                  type="tel"
                  className="input-field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0928 714 4597"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                />
                <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                  Used for SMS OTP verification and catering banquet updates.
                </span>
              </div>

              {profileSuccessMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    color: '#15803D',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
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
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={onClose} className="btn-nav-logout" style={{ padding: '8px 16px' }}>
                  Close
                </button>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="btn-hero-primary"
                  style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                >
                  <Save size={15} /> {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PASSWORD & SECURITY */}
          {activeTab === 'security' && (
            <div>
              <form onSubmit={handleChangePassword}>
                <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Current Password <span className="required-star">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      className="input-field"
                      required
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={{ width: '100%', paddingRight: '42px', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                      title={showCurrentPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: showCurrentPassword ? 'var(--terracotta)' : '#94A3B8',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px',
                        zIndex: 2,
                      }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ textAlign: 'left', marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    New Password <span className="required-star">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="input-field"
                      required
                      placeholder="Enter new strong password"
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

                <div className="form-group" style={{ textAlign: 'left', marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Confirm New Password <span className="required-star">*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="input-field"
                      required
                      placeholder="Re-enter new password"
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

                {passwordSuccessMsg && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      color: '#15803D',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      marginBottom: '16px',
                    }}
                  >
                    <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}

                {passwordErrorMsg && (
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
                    <span>{passwordErrorMsg}</span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowOtpResetModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--terracotta)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Forgot current password? Reset via OTP
                  </button>

                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="btn-hero-primary"
                    style={{ padding: '8px 20px', fontSize: '0.85rem' }}
                  >
                    <KeyRound size={15} /> {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Embedded OTP Reset Modal for forgotten password */}
      {showOtpResetModal && (
        <ForgotPasswordModal
          isOpen={showOtpResetModal}
          onClose={() => setShowOtpResetModal(false)}
          initialIdentifier={currentUser.email}
          initialMethod="email"
          onSuccess={() => {
            setShowOtpResetModal(false)
            setPasswordSuccessMsg('Password updated successfully via OTP!')
          }}
        />
      )}
    </>
  )
}
