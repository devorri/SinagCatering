import React, { useEffect, useRef, useState } from 'react'
import { Bot, Send, ShieldAlert, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { EXCESS_PAX_RATE, FOOD_BUFFER_PAX, SINAG_PACKAGES, findTierForGuestCount, recommendPackage } from '../data/packages'

interface Message {
  sender: 'user' | 'bot'
  text: string
  timestamp: Date
  escalated?: boolean
  recommendedPkgId?: string
  recommendedGuestCount?: number
}

interface AIAssistantProps {
  isOpen: boolean
  onClose: () => void
  onApplyRecommendation?: (pkgId: string, guestCount: number) => void
}

const QUICK_REPLIES = [
  'Recommend package for 100 guests',
  'How much is Full Blast?',
  'Do you have entertainment?',
  'What is the refund policy?',
  'Do you accept GCash?',
]

const parseInlineMarkdown = (text: string): string => {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

const extractGuestCount = (input: string) => {
  const paxMatch = input.match(/(\d{2,3})\s*(pax|guest|guests|people|person)?/i)
  return paxMatch ? Number(paxMatch[1]) : 70
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, onApplyRecommendation }) => {
  const { createInquiryDirect, currentUser } = useApp()
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Mabuhay! I am Sinag's AI Concierge. I can recommend a kids party package, estimate prices, explain inclusions, and forward custom requests to the admin team.",
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

  const packageSummary = () => {
    return SINAG_PACKAGES.map((pkg) => {
      const tierList = pkg.tiers.map((tier) => `${tier.pax} pax: PHP ${tier.price.toLocaleString()}`).join(', ')
      return `**${pkg.shortName}** - ${tierList}`
    }).join('\n')
  }

  const getAIResponse = (input: string): { text: string; escalate: boolean; pkgId?: string; guestCount?: number } => {
    const cleanInput = input.toLowerCase()
    const guestCount = extractGuestCount(input)

    if (cleanInput.includes('recommend') || cleanInput.includes('suggest') || cleanInput.includes('best')) {
      const needsEntertainment = cleanInput.includes('entertain') || cleanInput.includes('clown') || cleanInput.includes('host') || cleanInput.includes('magician')
      const budgetMatch = input.match(/(?:budget|php|p)\s*([0-9,]+)/i)
      const budget = budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : 70000
      const recommendation = recommendPackage(guestCount, budget, needsEntertainment)
      return {
        text: `For **${guestCount} guests**, I recommend **${recommendation.pkg.name}**.\n\nEstimated total: **PHP ${recommendation.estimatedTotal.toLocaleString()}** using the ${recommendation.tier.pax} pax tier plus ${FOOD_BUFFER_PAX} pax food buffer.\n\nReason: it best matches your pax count${needsEntertainment ? ', entertainment needs,' : ''} and budget profile.`,
        escalate: false,
        pkgId: recommendation.pkg.id,
        guestCount,
      }
    }

    if (cleanInput.includes('price') || cleanInput.includes('cost') || cleanInput.includes('how much') || cleanInput.includes('package')) {
      const matchedPackage = SINAG_PACKAGES.find((pkg) => cleanInput.includes(pkg.shortName.toLowerCase()) || cleanInput.includes(pkg.id.split('-')[0]))
      if (matchedPackage) {
        const tier = findTierForGuestCount(matchedPackage, guestCount)
        return {
          text: `For **${guestCount} guests**, **${matchedPackage.name}** uses the **${tier.pax} pax** tier at **PHP ${tier.price.toLocaleString()}**. Each flyer tier includes a **+${FOOD_BUFFER_PAX} pax food buffet** allowance. Extra guests beyond that are estimated at PHP ${EXCESS_PAX_RATE}/head, subject to admin confirmation.`,
          escalate: false,
          pkgId: matchedPackage.id,
          guestCount,
        }
      }
      return {
        text: `Here are the current kids party packages:\n\n${packageSummary()}\n\nEach tier includes +${FOOD_BUFFER_PAX} pax food buffet.`,
        escalate: false,
      }
    }

    if (cleanInput.includes('entertain') || cleanInput.includes('clown') || cleanInput.includes('magician') || cleanInput.includes('photo')) {
      return {
        text: '**Budgetarian Plus** and **Full Blast** include entertainment options: clown/host, magician, photo booth, photographer, and lights and sounds. The basic Budgetarian package can be upgraded by request.',
        escalate: false,
      }
    }

    if (cleanInput.includes('freebie') || cleanInput.includes('included') || cleanInput.includes('inclusion')) {
      return {
        text: 'Common inclusions include 4 main dishes, dessert and drinks, elegant buffet setup, serving equipment, plates, utensils, glassware, professional waiter service, dressed chairs, round tables, cake/gift table, centerpieces, chair ribbons, stage decor, and entrance setup. Freebies include candy corner, event coordinator, ref magnet souvenir, Styro name cut outs, and lighted number standee.',
        escalate: false,
      }
    }

    if (cleanInput.includes('refund') || cleanInput.includes('cancel')) {
      return {
        text: 'Cancellation policy: **30 days or more** before the event gets 100% refund, **14 to 29 days** gets 50% refund, and **less than 14 days** is non-refundable. Rebooking is handled inside the Client Portal.',
        escalate: false,
      }
    }

    if (cleanInput.includes('payment') || cleanInput.includes('downpayment') || cleanInput.includes('gcash') || cleanInput.includes('maya')) {
      return {
        text: 'A **50% downpayment** is required after submitting a reservation. The Client Portal lets customers upload proof of payment for admin verification. GCash/Maya details can be confirmed with Sinag at **0928 714 4597**.',
        escalate: false,
      }
    }

    if (cleanInput.includes('location') || cleanInput.includes('area') || cleanInput.includes('baliwag') || cleanInput.includes('bulacan')) {
      return {
        text: "Sinag's Catering is based in **Baliwag, Bulacan**. Flyer prices apply within the City of Baliwag area. Out-of-area events may need a new quotation for transport, crew meal, downgrade/upgrade, or added setup costs.",
        escalate: false,
      }
    }

    return {
      text: 'I forwarded this as an inquiry so the admin team can answer accurately. For faster follow-up, you can also call **0928 714 4597**.',
      escalate: true,
    }
  }

  const queueBotResponse = (text: string) => {
    setIsTyping(true)
    setTimeout(() => {
      const response = getAIResponse(text)
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: response.text,
          timestamp: new Date(),
          escalated: response.escalate,
          recommendedPkgId: response.pkgId,
          recommendedGuestCount: response.guestCount,
        },
      ])

      if (response.escalate) {
        createInquiryDirect(currentUser?.name || 'Guest User', currentUser?.email || 'guest@email.com', text)
      }
    }, 500)
  }

  const handleSend = (text = inputValue) => {
    if (!text.trim()) return
    setMessages((prev) => [...prev, { sender: 'user', text, timestamp: new Date() }])
    setInputValue('')
    queueBotResponse(text)
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
            <span style={{ fontSize: '0.72rem', color: 'var(--gold-light)' }}>Online - Party Assistant</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }} aria-label="Close Chat">
          <X size={20} />
        </button>
      </div>

      <div className="ai-chat-body">
        {messages.map((msg, index) => (
          <div key={index} className={`msg-bubble ${msg.sender}`}>
            <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
              {msg.text.split('\n').map((line, i) => (
                <p key={i} style={{ margin: '4px 0' }} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }} />
              ))}
            </div>
            {msg.recommendedPkgId && msg.recommendedGuestCount && onApplyRecommendation && (
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onApplyRecommendation(msg.recommendedPkgId!, msg.recommendedGuestCount!)
                    onClose()
                  }}
                  className="btn-hero-primary"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
                >
                  ✨ Auto-Fill Booking Wizard with AI Plan
                </button>
              </div>
            )}
            {msg.escalated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginTop: '6px', color: 'var(--gold-dark)' }}>
                <ShieldAlert size={12} /> Sent to admin inquiry inbox.
              </div>
            )}
          </div>
        ))}
        {isTyping && <div className="msg-bubble bot">Typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && (
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
          placeholder="Ask Sinag Concierge..."
        />
        <button onClick={() => handleSend()} disabled={!inputValue.trim()} className="btn-submit-primary" style={{ width: 'auto', padding: '10px 16px' }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
