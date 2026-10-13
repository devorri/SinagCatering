import React from 'react'
import { Check } from 'lucide-react'

export interface PasswordAnalysis {
  hasMinLength: boolean
  isStrongLength: boolean
  hasUppercase: boolean
  hasSpecial: boolean
  hasNumber: boolean
  score: 0 | 1 | 2 | 3
  label: 'Too Short' | 'Weak' | 'Good' | 'Strong' | ''
  color: string
}

export const analyzePassword = (password: string): PasswordAnalysis => {
  if (!password) {
    return {
      hasMinLength: false,
      isStrongLength: false,
      hasUppercase: false,
      hasSpecial: false,
      hasNumber: false,
      score: 0,
      label: '',
      color: '#CBD5E0',
    }
  }

  const hasMinLength = password.length >= 8
  const isStrongLength = password.length >= 12
  const hasUppercase = /[A-Z]/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  if (!hasMinLength) {
    return {
      hasMinLength,
      isStrongLength,
      hasUppercase,
      hasSpecial,
      hasNumber,
      score: 1,
      label: 'Weak',
      color: '#E53E3E',
    }
  }

  // Has at least 8 characters
  const meetsBasicRequirements = hasUppercase && hasSpecial

  if (meetsBasicRequirements && isStrongLength) {
    return {
      hasMinLength,
      isStrongLength,
      hasUppercase,
      hasSpecial,
      hasNumber,
      score: 3,
      label: 'Strong',
      color: '#2D6A4F',
    }
  }

  if (meetsBasicRequirements) {
    return {
      hasMinLength,
      isStrongLength,
      hasUppercase,
      hasSpecial,
      hasNumber,
      score: 2,
      label: 'Good',
      color: '#D97706',
    }
  }

  // 8+ chars but missing caps or special
  return {
    hasMinLength,
    isStrongLength,
    hasUppercase,
    hasSpecial,
    hasNumber,
    score: 1,
    label: 'Weak',
    color: '#E53E3E',
  }
}

export const getPasswordValidationError = (password: string): string | null => {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).'
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%...).'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9).'
  }
  return null
}

interface PasswordStrengthIndicatorProps {
  password: string
  showChecklist?: boolean
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showChecklist = true,
}) => {
  const analysis = analyzePassword(password)

  const getSegmentColor = (segmentIndex: number) => {
    if (analysis.score >= segmentIndex) {
      return analysis.color
    }
    return 'rgba(0, 0, 0, 0.08)'
  }

  const checklist = [
    {
      label: analysis.isStrongLength ? '12+ characters (Strong)' : 'At least 8 characters',
      valid: analysis.hasMinLength,
      highlight: analysis.isStrongLength,
    },
    {
      label: 'Uppercase letter (A-Z)',
      valid: analysis.hasUppercase,
    },
    {
      label: 'Special character (!@#$...)',
      valid: analysis.hasSpecial,
    },
    {
      label: 'Number (0-9)',
      valid: analysis.hasNumber,
    },
  ]

  return (
    <div className="password-strength-wrap" style={{ marginTop: '8px', marginBottom: '8px' }}>
      {/* Visual meter bar with 3 segments */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '4px', flex: 1, height: '5px' }}>
          {[1, 2, 3].map((segment) => (
            <div
              key={segment}
              style={{
                flex: 1,
                borderRadius: '4px',
                background: getSegmentColor(segment),
                transition: 'background 0.25s ease',
              }}
            />
          ))}
        </div>
        {analysis.label && (
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: analysis.color,
              padding: '2px 8px',
              borderRadius: '999px',
              background:
                analysis.score === 3
                  ? 'rgba(45, 106, 79, 0.12)'
                  : analysis.score === 2
                  ? 'rgba(217, 119, 6, 0.12)'
                  : 'rgba(229, 62, 62, 0.12)',
            }}
          >
            {analysis.label}
          </span>
        )}
      </div>

      {/* Live requirement checklist */}
      {showChecklist && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '6px',
            padding: '8px 10px',
            background: 'var(--paper-warm, #FDFAF4)',
            border: '1px solid var(--line, #F0E4C8)',
            borderRadius: '6px',
            fontSize: '0.73rem',
          }}
        >
          {checklist.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: item.valid ? 'var(--emerald, #2D6A4F)' : 'var(--muted, #9A7A50)',
                fontWeight: item.valid ? 600 : 400,
                transition: 'color 0.2s ease',
              }}
            >
              {item.valid ? (
                <Check size={12} strokeWidth={2.8} style={{ color: 'var(--emerald, #2D6A4F)', flexShrink: 0 }} />
              ) : (
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '1px solid var(--muted-light, #C4A06A)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
