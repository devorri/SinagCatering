import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { uploadImageToStorage } from '../../lib/storage'
import { useApp } from '../../context/AppContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  DEFAULT_BUSINESS_SETTINGS,
  fillPolicyText,
  refundPolicySummary,
} from '../../lib/businessSettings'
import type { BusinessSettings, TermsSection } from '../../lib/businessSettings'

type TextKey = {
  [K in keyof BusinessSettings]: BusinessSettings[K] extends string ? K : never
}[keyof BusinessSettings]
type NumberKey = {
  [K in keyof BusinessSettings]: BusinessSettings[K] extends number ? K : never
}[keyof BusinessSettings]

const card: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '14px',
  padding: '20px 22px',
  marginBottom: '18px',
}
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#3F3F46', marginBottom: '5px' }
const hintStyle: React.CSSProperties = { fontSize: '0.7rem', color: '#71717A', marginTop: '4px' }
const sectionTitle: React.CSSProperties = { margin: '0 0 4px', fontSize: '1.02rem', fontWeight: 800, color: '#18181B' }
const sectionDesc: React.CSSProperties = { margin: '0 0 16px', fontSize: '0.8rem', color: '#71717A' }

/** Admin → Business Settings: contact info, payment accounts, pricing rules, policies and terms. */
export const BusinessSettingsTab: React.FC = () => {
  const { business, saveBusinessSettings } = useApp()
  const { confirm } = useConfirm()
  const [draft, setDraft] = useState<BusinessSettings>(business)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // Pick up changes saved from another admin session while nothing is being edited
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(business), [draft, business])
  useEffect(() => {
    if (!isDirty) setDraft(business)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business])

  const setText = (key: TextKey, value: string) => setDraft((d) => ({ ...d, [key]: value }))
  const setNum = (key: NumberKey, value: string) => setDraft((d) => ({ ...d, [key]: value === '' ? 0 : Number(value) }))

  const textField = (key: TextKey, label: string, hint?: string, placeholder?: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input className="input-field" value={draft[key]} placeholder={placeholder} onChange={(e) => setText(key, e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem' }} />
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )
  const numberField = (key: NumberKey, label: string, hint?: string, suffix?: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input type="number" min={0} className="input-field" value={draft[key]} onChange={(e) => setNum(key, e.target.value)} style={{ width: '100%', padding: '8px 10px', fontSize: '0.85rem' }} />
        {suffix && <span style={{ fontSize: '0.78rem', color: '#71717A', whiteSpace: 'nowrap' }}>{suffix}</span>}
      </div>
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )

  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const qrField = (key: 'gcashQrUrl' | 'bankQrUrl', label: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <img src={draft[key]} alt={label} style={{ width: '64px', height: '64px', objectFit: 'contain', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#FFF' }} />
        <label className="btn" style={{ cursor: 'pointer' }}>
          <Upload size={14} /> {uploadingKey === key ? 'Uploading…' : 'Upload new QR'}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            disabled={uploadingKey !== null}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setUploadingKey(key)
              const res = await uploadImageToStorage(file, 'general')
              setUploadingKey(null)
              if (res.url) setText(key, res.url)
              else setNotice({ tone: 'error', text: res.error || 'QR upload failed.' })
            }}
          />
        </label>
      </div>
      <div style={hintStyle}>Saved when you click Save Changes.</div>
    </div>
  )

  // ---- Terms editing helpers ----
  const updateSection = (idx: number, patch: Partial<TermsSection>) =>
    setDraft((d) => ({ ...d, termsSections: d.termsSections.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }))
  const linesToList = (value: string) => value.split('\n').map((l) => l.trim()).filter(Boolean)

  const handleSave = async () => {
    if (draft.refundFullDays <= draft.refundPartialDays) {
      setNotice({ tone: 'error', text: 'The "full refund" days must be greater than the "partial refund" days.' })
      return
    }
    const termsChanged = JSON.stringify(draft.termsSections) !== JSON.stringify(business.termsSections)
    if (termsChanged) {
      const ok = await confirm({
        title: 'Publish updated Terms & Conditions?',
        message: 'You changed the Terms & Conditions. Every client will be asked to read and accept the new version on their next sign-in.',
        confirmText: 'Save & Publish',
        cancelText: 'Keep Editing',
        variant: 'primary',
      })
      if (!ok) return
    }
    setSaving(true)
    setNotice(null)
    const res = await saveBusinessSettings(draft)
    setSaving(false)
    setNotice(res.success
      ? { tone: 'success', text: 'Saved. The website, booking wizard, client portal and AI assistant are now using these settings.' }
      : { tone: 'error', text: res.error || 'Could not save settings.' })
  }

  const handleResetDefaults = async () => {
    const ok = await confirm({
      title: 'Load the original defaults?',
      message: 'This fills the form with the original Sinag values. Nothing is saved until you click Save Changes.',
      confirmText: 'Load Defaults',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (ok) setDraft({ ...DEFAULT_BUSINESS_SETTINGS, termsVersion: business.termsVersion })
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', position: 'sticky', top: '8px', zIndex: 5, boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
        <div>
          <h3 style={sectionTitle}>Business Settings</h3>
          <p style={{ ...sectionDesc, margin: 0 }}>
            Changes apply everywhere instantly: landing page, booking wizard, client portal, notifications, contract and the AI assistant.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={handleResetDefaults} disabled={saving}>
            <RotateCcw size={14} /> Defaults
          </button>
          <button type="button" className="btn" onClick={() => setDraft(business)} disabled={!isDirty || saving}>
            Discard
          </button>
          <button type="button" className="btn-submit-primary" onClick={handleSave} disabled={!isDirty || saving} style={{ width: 'auto', padding: '9px 18px' }}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ ...card, padding: '12px 16px', background: notice.tone === 'success' ? '#ECFDF5' : '#FEF2F2', borderColor: notice.tone === 'success' ? '#A7F3D0' : '#FECACA', color: notice.tone === 'success' ? '#065F46' : '#991B1B', fontSize: '0.84rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {notice.tone === 'success' && <CheckCircle2 size={16} />} {notice.text}
        </div>
      )}

      <div style={card}>
        <h4 style={sectionTitle}>Contact Details</h4>
        <p style={sectionDesc}>Shown in the header, footer, contact section, booking pages, notifications and the AI assistant.</p>
        <div style={grid}>
          {textField('businessName', 'Business name')}
          {textField('phone', 'Hotline / mobile number', 'Used for the Call buttons too.', '0928 714 4597')}
          {textField('email', 'Email address')}
          {textField('address', 'Location', undefined, 'Baliwag, Bulacan')}
          {textField('serviceArea', 'Service area', undefined, 'Bulacan and nearby provinces')}
          {textField('hours', 'Business hours', undefined, 'Mon-Sat, 9:00 AM - 7:00 PM')}
        </div>
      </div>

      <div style={card}>
        <h4 style={sectionTitle}>Payment Accounts</h4>
        <p style={sectionDesc}>Shown to clients on the payment step and in My Bookings. Double-check these before saving.</p>
        <div style={grid}>
          {textField('gcashName', 'GCash / QR Ph account name')}
          {textField('gcashNumber', 'GCash number')}
          {textField('bankName', 'Bank name', undefined, 'MariBank')}
          {textField('bankAccountName', 'Bank account name')}
          {textField('bankAccountNumber', 'Bank account number')}
          {textField('bankAccountTag', 'Bank account tag', 'Short label shown to clients, e.g. MariBank(****2765).')}
          {qrField('gcashQrUrl', 'GCash / QR Ph code image')}
          {qrField('bankQrUrl', 'Bank / InstaPay QR code image')}
          {textField('adminAlertPhone', 'Admin SMS alert number', 'Receives refund-request and booking alerts.')}
        </div>
      </div>

      <div style={card}>
        <h4 style={sectionTitle}>Pricing Rules</h4>
        <p style={sectionDesc}>Package tier prices are edited in Menu &amp; Pricing. These rules apply on top of every package.</p>
        <div style={grid}>
          {numberField('foodBufferPax', 'Free food buffer', 'Extra guests each tier covers at no cost.', 'guests')}
          {numberField('excessPaxRate', 'Excess guest rate', 'Charged per guest beyond the biggest tier + buffer.', '₱ / guest')}
          {numberField('downpaymentPercent', 'Downpayment', 'Share of the total needed to lock the date.', '%')}
          {numberField('reservationFee', 'Reserve Only fee', 'Deducted from the total later.', '₱')}
          {numberField('reserveHoldHours', 'Reserve Only hold time', 'Unpaid holds expire after this.', 'hours')}
          {numberField('maxExtraMain', 'Max extra main dishes', undefined, 'dishes')}
          {numberField('maxExtraPasta', 'Max extra pasta', undefined, 'dishes')}
          {numberField('maxExtraDessert', 'Max extra desserts', undefined, 'courses')}
        </div>
      </div>

      <div style={card}>
        <h4 style={sectionTitle}>Included Menu</h4>
        <p style={sectionDesc}>How many dishes clients choose in every package (Booking Wizard → Customize). The dishes themselves are managed in Menu &amp; Pricing.</p>
        <div style={grid}>
          {numberField('includedMains', 'Main dishes to choose', undefined, 'dishes')}
          {numberField('includedPastas', 'Pasta dishes to choose', undefined, 'dishes')}
          {numberField('includedDrinks', 'Drinks to choose', undefined, 'drinks')}
        </div>
        <div style={{ ...hintStyle, marginTop: '12px', fontSize: '0.78rem', color: '#3F3F46' }}>
          Preview: {draft.includedMains} mains + {draft.includedPastas} pasta + {draft.includedDrinks} drink{draft.includedDrinks > 1 ? 's' : ''}, plus dessert
        </div>
      </div>

      <div style={card}>
        <h4 style={sectionTitle}>Booking &amp; Refund Policy</h4>
        <p style={sectionDesc}>Used by the calendar, cancellations, refund computation, reminders and the AI assistant.</p>
        <div style={grid}>
          {numberField('leadTimeDays', 'Minimum advance booking', 'Earliest bookable date from today.', 'days')}
          {numberField('changeNoticeDays', 'Notice for changes / rebooking', undefined, 'days')}
          {numberField('refundFullDays', 'Full refund if cancelled at least', undefined, 'days before')}
          {numberField('refundPartialDays', 'Partial refund if cancelled at least', undefined, 'days before')}
          {numberField('refundPartialPercent', 'Partial refund amount', undefined, '%')}
          {numberField('reminderDays', 'Event reminder', 'Automated SMS / in-app reminder.', 'days before')}
        </div>
        <div style={{ ...hintStyle, marginTop: '12px', fontSize: '0.78rem', color: '#3F3F46' }}>
          Preview: {refundPolicySummary(draft)}
        </div>
      </div>

      <div style={card}>
        <h4 style={sectionTitle}>Terms &amp; Conditions</h4>
        <p style={sectionDesc}>
          One line per item. These placeholders are filled in automatically: <code>{'{fee}'}</code> <code>{'{holdHours}'}</code> <code>{'{leadDays}'}</code> <code>{'{changeDays}'}</code> <code>{'{fullDays}'}</code> <code>{'{fullDaysMinus1}'}</code> <code>{'{partialDays}'}</code> <code>{'{partialPercent}'}</code> <code>{'{downpaymentPercent}'}</code> <code>{'{phone}'}</code> <code>{'{email}'}</code>. Current version: <strong>{business.termsVersion}</strong>
        </p>

        {draft.termsSections.map((section, idx) => (
          <div key={idx} style={{ border: '1px solid #F0F1F3', borderRadius: '10px', padding: '14px', marginBottom: '12px', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <input className="input-field" value={section.heading} onChange={(e) => updateSection(idx, { heading: e.target.value })} style={{ flex: 1, padding: '8px 10px', fontSize: '0.88rem', fontWeight: 700 }} placeholder="Section heading" />
              <label style={{ fontSize: '0.74rem', color: '#52525B', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={Boolean(section.ordered)} onChange={(e) => updateSection(idx, { ordered: e.target.checked })} /> Numbered
              </label>
              <button
                type="button"
                title="Remove section"
                onClick={() => setDraft((d) => ({ ...d, termsSections: d.termsSections.filter((_, i) => i !== idx) }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '4px' }}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <label style={labelStyle}>Paragraphs (one per line)</label>
            <textarea className="input-field" rows={Math.max(2, (section.paragraphs?.length ?? 0) + 1)} value={(section.paragraphs ?? []).join('\n')} onChange={(e) => updateSection(idx, { paragraphs: linesToList(e.target.value) })} style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', marginBottom: '10px', resize: 'vertical' }} />
            <label style={labelStyle}>List items (one per line)</label>
            <textarea className="input-field" rows={Math.max(2, (section.items?.length ?? 0) + 1)} value={(section.items ?? []).join('\n')} onChange={(e) => updateSection(idx, { items: linesToList(e.target.value) })} style={{ width: '100%', padding: '8px 10px', fontSize: '0.82rem', resize: 'vertical' }} />
            {(section.items?.length || section.paragraphs?.length) ? (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ fontSize: '0.74rem', color: '#71717A', cursor: 'pointer' }}>Preview as clients see it</summary>
                <div style={{ fontSize: '0.8rem', color: '#3F3F46', marginTop: '6px' }}>
                  {section.paragraphs?.map((p, i) => <p key={i} style={{ margin: '4px 0' }}>{fillPolicyText(p, draft)}</p>)}
                  {section.items?.map((t, i) => <div key={i}>{section.ordered ? `${i + 1}.` : '•'} {fillPolicyText(t, draft)}</div>)}
                </div>
              </details>
            ) : null}
          </div>
        ))}

        <button
          type="button"
          className="btn"
          onClick={() => setDraft((d) => ({ ...d, termsSections: [...d.termsSections, { heading: 'New Section', paragraphs: [], items: [] }] }))}
        >
          <Plus size={14} /> Add Section
        </button>
      </div>
    </div>
  )
}
