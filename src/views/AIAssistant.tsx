import React, { useEffect, useRef, useState } from 'react'
import { Bot, RotateCcw, Send, ShieldAlert, Sparkles, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { querySinagAI } from '../lib/ai'
import { formatMoney } from '../data/packages'

import type { AIFormData, ChatTurn } from '../lib/ai'

interface Message {
  sender: 'user' | 'bot'
  text: string
  /** ISO timestamp (kept as a string so the chat can be saved and restored). */
  timestamp: string
  escalated?: boolean
  suggestions?: string[]
  /** One clickable card per bookable option. */
  quotes?: AIFormData[]
  /** Older saved chats stored a single card here. */
  formData?: AIFormData
}

interface AIAssistantProps {
  isOpen: boolean
  onClose: () => void
  onApplyRecommendation?: (formData: AIFormData) => void
}

const STARTER_SUGGESTIONS = [
  'Magkano for 100 guests?',
  'I have a ₱50k budget',
  "What's on the menu?",
  'Is my date available?',
  'How do I book?',
]

const HISTORY_SENT = 20
const MAX_SAVED_MESSAGES = 60

const greeting = (name?: string): Message => ({
  sender: 'bot',
  text: `Hi${name ? ` ${name.split(' ')[0]}` : ''}! I'm Sinag's assistant. Planning a birthday, debut, wedding or any celebration? Tell me about it and I'll help you pick a package, compute the cost, and check dates. Pwede rin po mag-Tagalog!`,
  timestamp: new Date().toISOString(),
  suggestions: STARTER_SUGGESTIONS,
})

const storageKeyFor = (userId?: string) => (userId ? `sinag_ai_chat_${userId}` : 'sinag_ai_chat_guest')

/** Signed-in chats survive across visits on this device; guest chats last until the tab is closed. */
const loadMessages = (userId?: string): Message[] | null => {
  try {
    const store = userId ? localStorage : sessionStorage
    const raw = store.getItem(storageKeyFor(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed.filter((m) => m && typeof m.text === 'string' && (m.sender === 'user' || m.sender === 'bot'))
  } catch {
    return null
  }
}

const saveMessages = (messages: Message[], userId?: string) => {
  try {
    const store = userId ? localStorage : sessionStorage
    store.setItem(storageKeyFor(userId), JSON.stringify(messages.slice(-MAX_SAVED_MESSAGES)))
  } catch {
    // storage full or blocked — the chat still works in memory
  }
}

const clearSavedMessages = (userId?: string) => {
  try {
    ;(userId ? localStorage : sessionStorage).removeItem(storageKeyFor(userId))
  } catch {
    // ignore
  }
}

const formatTime = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return time
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}, ${time}`
}

const parseInlineMarkdown = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/^#{1,4}\s+(.*)$/, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')

export const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, onApplyRecommendation }) => {
  const { createInquiryDirect, currentUser, bookings, blockedDates, packages, menuItems, addons, business } = useApp()
  const userId = currentUser?.id

  const [messages, setMessages] = useState<Message[]>(() => loadMessages(userId) ?? [greeting(currentUser?.name)])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedForUser = useRef<string | undefined>(userId)

  // Switch to the right saved conversation when the user signs in or out
  useEffect(() => {
    if (loadedForUser.current === userId) return
    loadedForUser.current = userId
    setMessages(loadMessages(userId) ?? [greeting(currentUser?.name)])
  }, [userId, currentUser?.name])

  useEffect(() => {
    saveMessages(messages, userId)
  }, [messages, userId])

  useEffect(() => {
    if (!isOpen) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const handleSend = async (text = inputValue) => {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    const userMsg: Message = { sender: 'user', text: trimmed, timestamp: new Date().toISOString() }
    const history: ChatTurn[] = messages.slice(-HISTORY_SENT).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))

    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    try {
      const response = await querySinagAI(trimmed, history, {
        packages,
        menuItems,
        addons,
        bookings,
        blockedDates,
        currentUser: currentUser ? { name: currentUser.name, email: currentUser.email, role: currentUser.role } : null,
      })

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: response.text,
          timestamp: new Date().toISOString(),
          escalated: response.escalate,
          suggestions: response.suggestions,
          quotes: response.quotes ?? (response.formData ? [response.formData] : []),
        },
      ])

      if (response.escalate) {
        createInquiryDirect(
          currentUser?.name || 'Guest User',
          currentUser?.email || 'guest@email.com',
          `[From AI chat] ${response.escalationSummary || trimmed}`,
        )
      }
    } catch (err) {
      console.error('Error in AI assistant query:', err)
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: `Sorry, nagka-problema ako sa connection. Try again in a bit, or call our team at **${business.phone}**.`,
          timestamp: new Date().toISOString(),
          suggestions: ['Try again', 'How do I book?'],
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleNewChat = () => {
    if (isTyping) return
    clearSavedMessages(userId)
    setMessages([greeting(currentUser?.name)])
    setInputValue('')
  }

  const lastIndex = messages.length - 1
  const lastMessage = messages[lastIndex]
  const showSuggestions = !isTyping && lastMessage?.sender === 'bot' && (lastMessage.suggestions?.length ?? 0) > 0

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
              {isTyping ? 'Typing…' : `Online · ${business.address}`}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={handleNewChat} className="ai-header-btn" aria-label="Start a new chat" title="New chat" disabled={isTyping}>
            <RotateCcw size={16} />
          </button>
          <button onClick={onClose} className="ai-header-btn" aria-label="Close Chat" title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="ai-chat-body">
        {messages.map((msg, index) => (
          <div key={`${msg.timestamp}-${index}`} className={`msg-row ${msg.sender}`}>
            <div className={`msg-bubble ${msg.sender}`}>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.55 }}>
                {msg.text.split('\n').map((line, i) =>
                  line.trim() === ''
                    ? <div key={i} style={{ height: '6px' }} />
                    : <p key={i} style={{ margin: '2px 0' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }} />,
                )}
              </div>

              {(msg.quotes ?? (msg.formData ? [msg.formData] : [])).map((quote) => (
                <div key={`${quote.package_id}-${quote.guest_count}`} className="ai-quote-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--terracotta)' }}>{quote.package_name}</strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{quote.guest_count} pax</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>
                    Est. Total: {formatMoney(quote.estimated_total)}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginBottom: '6px' }}>
                    {business.downpaymentPercent}% downpayment: {formatMoney(Math.round(quote.estimated_total * (business.downpaymentPercent / 100)))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {quote.event_type && <span className="ai-quote-tag" style={{ background: '#FEF3C7', color: '#92400E' }}>{quote.event_type}</span>}
                    {Boolean(quote.extra_main_count) && <span className="ai-quote-tag" style={{ background: '#FFEDD5', color: '#9A3412' }}>+{quote.extra_main_count} Extra Mains</span>}
                    {Boolean(quote.extra_pasta_count) && <span className="ai-quote-tag" style={{ background: '#DBEAFE', color: '#1E40AF' }}>+{quote.extra_pasta_count} Extra Pasta</span>}
                    {Boolean(quote.extra_dessert_count) && <span className="ai-quote-tag" style={{ background: '#FEF9C3', color: '#854D0E' }}>+{quote.extra_dessert_count} Extra Dessert</span>}
                    {quote.addons.length > 0 && <span className="ai-quote-tag" style={{ background: '#DCFCE7', color: '#166534' }}>+{quote.addons.length} Add-on{quote.addons.length > 1 ? 's' : ''}</span>}
                  </div>
                  {onApplyRecommendation && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyRecommendation(quote)
                        onClose()
                      }}
                      className="btn-hero-primary"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem', justifyContent: 'center', marginTop: '10px' }}
                    >
                      <Sparkles size={14} /> Book this
                    </button>
                  )}
                </div>
              ))}

              {(msg.quotes?.length || msg.formData) && (
                <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '6px' }}>Estimates only — final price confirmed by Sinag.</div>
              )}

              {msg.escalated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginTop: '6px', color: 'var(--gold-dark)' }}>
                  <ShieldAlert size={12} /> Sent to the Sinag team
                </div>
              )}
            </div>
            <span className="msg-time">{formatTime(msg.timestamp)}</span>
          </div>
        ))}

        {isTyping && (
          <div className="msg-row bot">
            <div className="msg-bubble bot ai-typing" aria-label="Sinag AI is typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {showSuggestions && (
          <div className="ai-inline-chips">
            {lastMessage.suggestions!.map((reply) => (
              <button key={reply} className="chip-btn" onClick={() => handleSend(reply)}>
                {reply}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          className="ai-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type your message…"
          maxLength={1000}
        />
        <button
          onClick={() => handleSend()}
          disabled={!inputValue.trim() || isTyping}
          className="btn-submit-primary"
          style={{ width: 'auto', padding: '10px 16px' }}
          aria-label="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
