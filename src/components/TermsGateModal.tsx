import React, { useEffect, useRef, useState } from 'react'
import { ScrollText, ShieldCheck, ChevronDown, LogOut, Loader2 } from 'lucide-react'
import { TERMS_SECTIONS, TERMS_VERSION } from '../lib/terms'

interface TermsGateModalProps {
  userName: string
  onAccept: () => Promise<void> | void
  onDecline: () => void
}

/**
 * Unskippable Terms & Conditions gate. The "I Agree" button only unlocks after
 * the client scrolls to the very bottom of the terms. There is no close button,
 * Escape key or backdrop click — the only ways out are Agree or Sign Out.
 */
export const TermsGateModal: React.FC<TermsGateModalProps> = ({ userName, onAccept, onDecline }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [reachedBottom, setReachedBottom] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const pct = max <= 0 ? 1 : el.scrollTop / max
    setProgress(Math.min(1, Math.max(0, pct)))
    if (max <= 2 || el.scrollTop >= max - 8) setReachedBottom(true)
  }

  useEffect(() => {
    // Lock page scroll behind the gate
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis
    lenis?.stop()
    const t = window.setTimeout(checkScroll, 50)
    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      lenis?.start()
    }
  }, [])

  const handleAgree = async () => {
    if (!reachedBottom || isSaving) return
    setIsSaving(true)
    try {
      await onAccept()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="terms-gate-overlay" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
      <div className="terms-gate-card">
        <div className="terms-gate-header">
          <div className="terms-gate-icon">
            <ScrollText size={20} />
          </div>
          <div>
            <h2 id="terms-gate-title">Terms &amp; Conditions</h2>
            <p>
              Mabuhay, <strong>{userName}</strong>! Please read Sinag Catering&apos;s terms before using the client portal.
            </p>
          </div>
        </div>

        <div className="terms-gate-progress" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <div
          ref={scrollRef}
          className="terms-gate-body"
          onScroll={checkScroll}
          tabIndex={0}
          data-lenis-prevent
        >
          {TERMS_SECTIONS.map((section) => (
            <section key={section.heading} className="terms-gate-section">
              <h3>{section.heading}</h3>
              {section.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {section.items && (
                section.ordered ? (
                  <ol>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )
              )}
            </section>
          ))}
          <p className="terms-gate-version">Terms version {TERMS_VERSION}</p>
        </div>

        <div className="terms-gate-footer">
          <span className={`terms-gate-hint ${reachedBottom ? 'done' : ''}`}>
            {reachedBottom ? (
              <>
                <ShieldCheck size={14} /> You&apos;ve reached the end of the terms.
              </>
            ) : (
              <>
                <ChevronDown size={14} /> Scroll to the bottom to enable &ldquo;I Agree&rdquo;
              </>
            )}
          </span>
          <div className="terms-gate-actions">
            <button type="button" className="terms-gate-decline" onClick={onDecline} disabled={isSaving}>
              <LogOut size={14} /> Decline &amp; Sign Out
            </button>
            <button
              type="button"
              className="terms-gate-agree"
              onClick={handleAgree}
              disabled={!reachedBottom || isSaving}
              aria-disabled={!reachedBottom || isSaving}
            >
              {isSaving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              I Agree to the Terms &amp; Conditions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
