import React, { useEffect, useRef, useState } from 'react'
import { Bot, Send, ShieldAlert, X, Sparkles, CheckCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { querySinagAI } from '../lib/ai'
import { formatMoney } from '../data/packages'

import type { AIFormData } from '../lib/ai'

interface Message {
  sender: 'user' | 'bot'
  text: string
  timestamp: Date
  escalated?: boolean
  recommendedPkgId?: string
  recommendedGuestCount?: number
  isLiveApi?: boolean
  formData?: AIFormData
}

interface AIAssistantProps {
  isOpen: boolean
  onClose: () => void
  onApplyRecommendation?: (formData: AIFormData) => void
}

const QUICK_REPLIES = [
  'Recommend a package for 100 guests',
  'Best package for my child\'s birthday, 35 guests?',
  'Do you have entertainment?',
  'What is the refund policy?',
  'Do you accept GCash?',
]

const parseInlineMarkdown = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, onApplyRecommendation }) => {
  const { createInquiryDirect, currentUser } = useApp()
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Mabuhay! I am Sinag's AI Concierge. I can recommend kids party packages, compute exact prices for your guest count, explain entertainment inclusions, and answer downpayment queries.",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  if (!isOpen) return null

  const handleSend = async (text = inputValue) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    const userMsg: Message = { sender: 'user', text: trimmed, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    try {
      // Build conversation history for LLM
      const history = messages.slice(-4).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }))

      // Call dynamic backend AI API endpoint
      const response = await querySinagAI(trimmed, history)

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: response.text,
          timestamp: new Date(),
          escalated: response.escalate,
          recommendedPkgId: response.pkgId,
          recommendedGuestCount: response.guestCount,
          isLiveApi: response.isLiveApi,
          formData: response.formData,
        },
      ])

      if (response.escalate) {
        createInquiryDirect(
          currentUser?.name || 'Guest User',
          currentUser?.email || 'guest@email.com',
          trimmed,
        )
      }
    } catch (err) {
      console.error('Error in AI assistant query:', err)
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: "I'm having trouble connecting right now, but our reservation desk is ready to help at **0928 714 4597** or via the Booking Wizard!",
          timestamp: new Date(),
          escalated: true,
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="ai-chat-window">
      <div className="ai-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--gold-gradient)', display: 'grid', placeItems: 'center', color: 'var(--obsidian)' }}>
            <Bot size={18} />
          </div>
          <div>
            <h3 className="ai-chat-title">Sinag AI Concierge</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--gold-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
              Package guidance · Baliwag, Bulacan
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }} aria-label="Close Chat">
          <X size={20} />
        </button>
      </div>

      <div className="ai-chat-body">
        {messages.map((msg, index) => (
          <div key={index} className={`msg-bubble ${msg.sender}`}>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.55 }}>
              {msg.text.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }} />
              ))}
            </div>

            {msg.formData && (
              <div style={{ marginTop: '10px', background: 'rgba(232, 130, 10, 0.08)', border: '1px solid var(--gold-light)', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--terracotta)' }}>{msg.formData.package_name}</strong>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)' }}>{msg.formData.guest_count} pax</span>
                </div>
                {msg.formData.estimated_total >= 0 && (
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                    Est. Total: {formatMoney(msg.formData.estimated_total)}
                  </div>
                )}
                {msg.formData.selected_menu && msg.formData.selected_menu.length > 0 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '6px' }}>
                    Includes: {msg.formData.selected_menu.slice(0, 3).join(', ')}{msg.formData.selected_menu.length > 3 ? '...' : ''}
                  </div>
                )}
              </div>
            )}

            {msg.formData && onApplyRecommendation && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onApplyRecommendation(msg.formData!)
                    onClose()
                  }}
                  className="btn-hero-primary"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
                >
                  <Sparkles size={14} /> Auto-Fill Booking Wizard with AI Plan
                </button>
              </div>
            )}

            {msg.isLiveApi && (
              <div style={{ fontSize: '0.68rem', color: '#10B981', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle size={10} /> Live Backend AI Response
              </div>
            )}

            {msg.escalated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginTop: '6px', color: 'var(--gold-dark)' }}>
                <ShieldAlert size={12} /> Forwarded to admin concierge inbox.
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="msg-bubble bot" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Sinag AI is calculating response...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && (
        <div className="quick-chips-row">
          {QUICK_REPLIES.map((reply) => (
            <button key={reply} className="chip-btn" onClick={() => handleSend(reply)}>
              {reply}
            </button>
          ))}
        </div>
      )}

      <div className="ai-chat-input-bar">
        <input
          type="text"
          className="ai-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask Sinag AI about packages, guest pricing, buffers..."
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputValue.trim() || isTyping}
          className="btn-submit-primary"
          style={{ width: 'auto', padding: '10px 16px' }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
