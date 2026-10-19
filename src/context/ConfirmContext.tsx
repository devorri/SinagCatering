import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, X } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary' | 'success'
  icon?: ReactNode
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        options,
        resolve,
      })
    })
  }, [])

  const handleConfirm = () => {
    if (dialogState) {
      dialogState.resolve(true)
      setDialogState(null)
    }
  }

  const handleCancel = () => {
    if (dialogState) {
      dialogState.resolve(false)
      setDialogState(null)
    }
  }

  // Keyboard shortcut listener (Enter = confirm, Escape = cancel)
  React.useEffect(() => {
    if (!dialogState?.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialogState])

  const options = dialogState?.options
  const variant = options?.variant || 'primary'

  const renderIcon = () => {
    if (options?.icon) return options.icon
    switch (variant) {
      case 'danger':
        return <AlertTriangle size={24} style={{ color: '#DC2626' }} />
      case 'warning':
        return <AlertTriangle size={24} style={{ color: '#D97706' }} />
      case 'success':
        return <CheckCircle2 size={24} style={{ color: '#059669' }} />
      case 'primary':
      default:
        return <HelpCircle size={24} style={{ color: '#B45309' }} />
    }
  }

  const getConfirmBtnStyle = () => {
    switch (variant) {
      case 'danger':
        return {
          background: '#DC2626',
          color: '#FFFFFF',
          border: '1px solid #B91C1C',
        }
      case 'warning':
        return {
          background: '#D97706',
          color: '#FFFFFF',
          border: '1px solid #B45309',
        }
      case 'success':
        return {
          background: '#059669',
          color: '#FFFFFF',
          border: '1px solid #047857',
        }
      case 'primary':
      default:
        return {
          background: '#18181B',
          color: '#FFFFFF',
          border: '1px solid #18181B',
        }
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* Global Confirmation Modal Dialog */}
      {dialogState?.isOpen && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 12, 10, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.18s ease-out',
          }}
          onClick={handleCancel}
        >
          <div
            className="modal-card"
            style={{
              maxWidth: '460px',
              width: '100%',
              margin: 'auto',
              borderRadius: '16px',
              background: '#FFFFFF',
              boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              overflow: 'hidden',
              animation: 'scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            {/* Header / Brand Accent */}
            <div
              style={{
                height: '4px',
                width: '100%',
                background:
                  variant === 'danger'
                    ? 'linear-gradient(90deg, #DC2626, #EF4444)'
                    : variant === 'warning'
                    ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                    : variant === 'success'
                    ? 'linear-gradient(90deg, #059669, #10B981)'
                    : 'linear-gradient(90deg, #C5A059, #8C6D37)',
              }}
            />

            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    background:
                      variant === 'danger'
                        ? '#FEE2E2'
                        : variant === 'warning'
                        ? '#FEF3C7'
                        : variant === 'success'
                        ? '#D1FAE5'
                        : '#FEF3C7',
                  }}
                >
                  {renderIcon()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3
                      id="confirm-dialog-title"
                      style={{
                        margin: '0 0 6px',
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        color: '#18181B',
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {options?.title || 'Please Confirm'}
                    </h3>
                    <button
                      type="button"
                      onClick={handleCancel}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#9CA3AF',
                        padding: '4px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      aria-label="Close dialog"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.88rem',
                      lineHeight: 1.55,
                      color: '#4B5563',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {options?.message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid #F3F4F6',
                }}
              >
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    background: '#F3F4F6',
                    color: '#374151',
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {options?.cancelText || 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
                    ...getConfirmBtnStyle(),
                  }}
                >
                  {options?.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}
