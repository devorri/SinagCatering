import { supabase } from './supabase'
import {
  AI_CATALOG_ADDONS,
  EXCESS_PAX_RATE,
  EXTRA_DESSERT_RATE,
  EXTRA_MAIN_RATE,
  EXTRA_PASTA_RATE,
  FOOD_BUFFER_PAX,
  mapDatabasePackage,
  findTierForGuestCount,
  formatMoney,
  recommendPackage,
} from '../data/packages'
import type { CateringPackage } from '../data/packages'

export interface AIFormData {
  package_id: string
  package_name: string
  guest_count: number
  estimated_total: number
  selected_menu: string[]
  selected_drinks?: string[]
  addons: string[]
  extra_main_count?: number
  extra_pasta_count?: number
  extra_dessert_count?: number
  event_type?: string
  notes?: string
}

export interface AIResponse {
  text: string
  escalate: boolean
  pkgId?: string
  guestCount?: number
  isLiveApi?: boolean
  formData?: AIFormData
}

export const extractGuestCount = (input: string): number | undefined => {
  const match = input.match(/\b(\d{1,4})\s*(?:guests?|people|persons?|pax|heads)\b/i)
  return match ? Number(match[1]) : undefined
}

export const extractBudget = (input: string): number | undefined => {
  // Check '150k', '150 k', '150.5k'
  const kMatch = input.match(/(?:(?:php|₱|budget\s*(?:of|is|around|up to|target)?|worth|spend(?:ing)?)\s*)?(\d+(?:\.\d+)?)\s*k\b/i)
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000)
  }
  // Check '150,000', '150000', '₱150,000'
  const numMatch = input.match(/(?:php|₱|budget\s*(?:of|is|around|up to|target)?|worth|spend(?:ing)?)\s*(\d{1,3}(?:,\d{3})+|\d{4,7})/i)
  if (numMatch) {
    return Number(numMatch[1].replace(/,/g, ''))
  }
  // General number followed by currency or budget keyword
  const generalNum = input.match(/(\d{1,3}(?:,\d{3})+|\d{5,7})\s*(?:pesos|php|budget)/i)
  if (generalNum) {
    return Number(generalNum[1].replace(/,/g, ''))
  }
  return undefined
}

export const detectEventType = (input: string): { category: 'Kids Birthday' | 'Debut' | 'Wedding' | 'Others (Please Specify)'; label: string } => {
  const lower = input.toLowerCase()
  if (/wedding|nuptial|bride|groom|matrimony/i.test(lower)) {
    return { category: 'Wedding', label: 'Wedding Reception Banquet' }
  }
  if (/debut|18th birthday|eighteenth|cotillion|debutante/i.test(lower)) {
    return { category: 'Debut', label: '18th Debut Grand Celebration' }
  }
  if (/birthday|kids?|child|kiddie|toddler|clown|balloon/i.test(lower)) {
    return { category: 'Kids Birthday', label: 'Kids Themed Birthday Party' }
  }
  if (/corporate|seminar|company|business|conference|anniversary|baptism|christening|reunion|banquet|thanksgiving|gathering/i.test(lower)) {
    let label = 'Special Catering Banquet'
    if (/corporate|company|business|seminar/i.test(lower)) label = 'Corporate Banquet'
    else if (/baptism|christening/i.test(lower)) label = 'Baptism / Christening'
    else if (/anniversary/i.test(lower)) label = 'Anniversary Celebration'
    else if (/thanksgiving/i.test(lower)) label = 'Thanksgiving Feast'
    return { category: 'Others (Please Specify)', label }
  }
  return { category: 'Kids Birthday', label: 'Celebration Banquet' }
}

export const calculateTotalForPackage = (
  pkg: CateringPackage,
  guestCount: number,
  addonIds: string[] = [],
  extraMain = 0,
  extraPasta = 0,
  extraDessert = 0,
): number => {
  const tier = findTierForGuestCount(pkg, guestCount)
  const isPerHead = pkg.pricePerHead !== undefined
  const baseCost = isPerHead ? guestCount * (pkg.pricePerHead ?? 0) : tier.price
  const servicePax = isPerHead ? guestCount : tier.pax + FOOD_BUFFER_PAX
  const excessGuests = isPerHead ? 0 : Math.max(0, guestCount - servicePax)
  const excessPaxFee = excessGuests * EXCESS_PAX_RATE

  const extraMainCost = extraMain * EXTRA_MAIN_RATE * guestCount
  const extraPastaCost = extraPasta * EXTRA_PASTA_RATE * guestCount
  const extraDessertCost = extraDessert * EXTRA_DESSERT_RATE * guestCount
  const flatAddonsCost = AI_CATALOG_ADDONS
    .filter((addon) => addonIds.includes(addon.id))
    .reduce((sum, addon) => sum + addon.price, 0)

  return baseCost + excessPaxFee + extraMainCost + extraPastaCost + extraDessertCost + flatAddonsCost
}

export const generateLocalAIResponse = (input: string, livePackages: CateringPackage[] = []): AIResponse => {
  const inputLower = input.toLowerCase()

  // 1. FAQ: Refund & Cancellation Policy
  if (/refund|cancell?ation|cancel|rebook|resched/i.test(inputLower)) {
    return {
      text: `Mabuhay! Here is Sinag Catering's official **Cancellation & Refund Policy**:\n\n` +
        `• **30 or more days before event:** **100% Full Refund** of the amount paid.\n` +
        `• **14 to 29 days before event:** **50% Refund** of the amount paid.\n` +
        `• **Less than 14 days before event:** **0% Refund (Non-refundable)** because kitchen preparations, chef scheduling, and event staff are already finalized.\n\n` +
        `✦ **Date Rescheduling:** You can rebook to another available date with at least **14 days advance notice** via the Client Portal without forfeiting your downpayment.\n\n` +
        `For specific reservation assistance, you can also manage your booking in the Client Portal or reach our Baliwag, Bulacan desk at **0928 714 4597**!`,
      escalate: false,
      isLiveApi: false,
    }
  }

  // 2. FAQ: Payment Terms, Downpayment
  if (/downpayment|payment|deposit|gcash|maribank|how to pay|terms of payment/i.test(inputLower) && !/recommend|package|pax|guest|budget/i.test(inputLower)) {
    return {
      text: `Mabuhay! Here are our official **Payment & Reservation Terms**:\n\n` +
        `• **50% Downpayment:** Required upon booking to officially reserve your date and lock in catering preparations.\n` +
        `• **Remaining 50% Balance:** Settleable on or before the day of your event.\n` +
        `• **Payment Channels:** We accept **QR Ph / GCash** (direct scan or transfer to Sunshine C. **0928 714 4597**), **MariBank / Bank Transfer**, and Cash.\n\n` +
        `You can easily attach your transaction reference number and receipt screenshot directly during booking or in your Sinag Client Portal!`,
      escalate: false,
      isLiveApi: false,
    }
  }

  // 3. FAQ: Lead Time
  if (/lead time|advance|notice|how early|how many days/i.test(inputLower) && !/recommend|package/i.test(inputLower)) {
    return {
      text: `Mabuhay! We require a **minimum of 14 days advance notice** for all catering bookings.\n\n` +
        `This ensures our culinary team in Baliwag, Bulacan can source the freshest ingredients, prepare custom styling, and coordinate complete event staffing for your celebration.`,
      escalate: false,
      isLiveApi: false,
    }
  }

  // 4. FAQ: Location / Contact Info
  if (/where|location|address|contact|phone|call|situated|based/i.test(inputLower) && !/recommend|package/i.test(inputLower)) {
    return {
      text: `Mabuhay! We are based in **Baliwag, Bulacan, Philippines** and cater celebrations across Bulacan and adjacent provinces.\n\n` +
        `• **Hotline & GCash / MariBank:** 0928 714 4597\n` +
        `• **Lead Time Rule:** Minimum 14 days advance booking\n` +
        `• **Operating Hours:** Concierge desk open daily 8:00 AM – 6:00 PM\n\n` +
        `Let us know if you'd like a package recommendation or quote for your upcoming event!`,
      escalate: false,
      isLiveApi: false,
    }
  }

  // 5. Package Recommendation, Context-Aware Classification & Budget Maximization
  if (livePackages.length === 0) {
    return {
      text: 'Our official package catalog is temporarily unavailable. Please contact Sinag Catering at 0928 714 4597 for a verified quotation.',
      escalate: true,
      isLiveApi: false,
    }
  }

  const count = extractGuestCount(input) || 80
  const targetBudget = extractBudget(input)
  const eventTypeObj = detectEventType(input)
  const isGrandRequest = /grand|blast|premium|full|ceiling|luxury|vip|maximize/i.test(inputLower) || (targetBudget && targetBudget >= 65000)

  // Package Selection
  let chosenPkg = livePackages[1] || livePackages[0] // default Budgetarian Plus
  if (isGrandRequest || eventTypeObj.category === 'Wedding' || eventTypeObj.category === 'Debut') {
    chosenPkg = livePackages.find((p) => p.id === 'full-blast') || livePackages[2] || chosenPkg
  } else if (/simple|basic|budget|low cost/i.test(inputLower) && !targetBudget) {
    chosenPkg = livePackages.find((p) => p.id === 'budget-basic') || chosenPkg
  } else {
    const reco = recommendPackage(livePackages, count, targetBudget || 60000)
    if (reco?.pkg) chosenPkg = reco.pkg
  }

  // BUDGET MAXIMIZER UPSELL LOGIC:
  // When a user specifies a target budget that exceeds standard base tier, bundle upgrades to reach budget cleanly
  const baseCost = calculateTotalForPackage(chosenPkg, count, [], 0, 0, 0)
  const isBudgetMaximizerActive = Boolean(targetBudget && targetBudget > baseCost)

  let selectedAddons: string[] = []
  let extraMain = 0
  let extraPasta = 0
  let extraDessert = 0

  if (isBudgetMaximizerActive && targetBudget) {
    // Intelligently bundle maximum upgrades to maximize user's high budget
    selectedAddons = ['ADD-CANDY-01', 'ADD-HOST-02', 'ADD-DESSERT-03']
    extraMain = Math.min(3, Math.max(1, Math.floor((targetBudget - baseCost) / (EXTRA_MAIN_RATE * count * 2))))
    extraPasta = Math.min(2, Math.max(1, Math.floor((targetBudget - baseCost) / (EXTRA_PASTA_RATE * count * 3))))
    extraDessert = Math.min(2, Math.max(1, Math.floor((targetBudget - baseCost) / (EXTRA_DESSERT_RATE * count * 4))))
  } else {
    if (/candy|chocolate|fountain/i.test(inputLower)) selectedAddons.push('ADD-CANDY-01')
    if (/emcee|games|host/i.test(inputLower) && chosenPkg.id === 'budget-basic') selectedAddons.push('ADD-HOST-02')
    if (/dessert|station/i.test(inputLower)) selectedAddons.push('ADD-DESSERT-03')

    extraDessert = /extra dessert|sweets/i.test(inputLower) ? 1 : 0
    extraMain = /extra main|additional dish/i.test(inputLower) ? 1 : 0
    extraPasta = /extra pasta/i.test(inputLower) ? 1 : 0
  }

  const total = calculateTotalForPackage(chosenPkg, count, selectedAddons, extraMain, extraPasta, extraDessert)
  const downpayment = Math.round(total * 0.5)

  const formData: AIFormData = {
    package_id: chosenPkg.id,
    package_name: chosenPkg.name,
    guest_count: count,
    estimated_total: total,
    selected_menu: chosenPkg.inclusions.slice(0, 5),
    addons: selectedAddons,
    extra_main_count: extraMain,
    extra_pasta_count: extraPasta,
    extra_dessert_count: extraDessert,
    event_type: eventTypeObj.category,
    notes: isBudgetMaximizerActive && targetBudget
      ? `AI Budget Maximizer: Target budget ${formatMoney(targetBudget)} cleanly allocated with ${extraMain} Extra Mains, ${extraPasta} Extra Pastas, ${extraDessert} Extra Desserts, plus full celebration stations for ${eventTypeObj.label}.`
      : `AI Recommendation for ${eventTypeObj.label} (${count} pax). 50% Downpayment: ${formatMoney(downpayment)}.`,
  }

  if (isBudgetMaximizerActive && targetBudget) {
    const stylingSurplus = Math.max(0, targetBudget - total)
    return {
      text: `Mabuhay! For your **${eventTypeObj.label}** with **${count} guests** and an exact target budget of **${formatMoney(targetBudget)}**, I've activated our **AI Budget Maximizer** to curate an all-inclusive premier banquet instead of stopping at the basic tier!\n\n` +
        `👑 **Recommended Flagship Plan:** **${chosenPkg.name}**\n` +
        `• **Base Package Tier:** ${formatMoney(baseCost)} (${count} Pax + ${FOOD_BUFFER_PAX} Buffer Pax)\n` +
        `• **Included Inclusions:** ${chosenPkg.inclusions.slice(0, 4).join(', ')}\n\n` +
        `💎 **Curated Luxury Upgrades Bundled to Maximize Your Budget:**\n` +
        `• **${extraMain} Extra Main Dishes (+PHP 100/pax):** +${formatMoney(extraMain * EXTRA_MAIN_RATE * count)} (Beef, Cordon Bleu, Fish Fillet)\n` +
        `• **${extraPasta} Extra Pasta Courses (+PHP 80/pax):** +${formatMoney(extraPasta * EXTRA_PASTA_RATE * count)} (Creamy Carbonara / Baked Penne)\n` +
        `• **${extraDessert} Extra Dessert Course (+PHP 50/pax):** +${formatMoney(extraDessert * EXTRA_DESSERT_RATE * count)}\n` +
        `• **Celebration Stations Included:** Chocolate Fountain Buffet, Party Host & Emcee, and Assorted Dessert Bar\n` +
        (stylingSurplus > 0 ? `• **VIP Production Allocation:** ${formatMoney(stylingSurplus)} tailored for Bespoke Thematic Stage Backdrop, Balloon Ceiling Canopy, and Ambient Event Lighting\n\n` : '\n') +
        `📊 **Calculated Package Total:** **${formatMoney(total)}**\n` +
        `🔒 **Required 50% Downpayment:** **${formatMoney(downpayment)}** (Locks in your date)\n` +
        `🏷️ **Event Category:** **${eventTypeObj.category}**\n\n` +
        `Click **"Auto-Fill Booking Wizard with AI Plan"** below to instantly pre-fill all ${extraMain} extra mains, ${extraPasta} extra pasta, dessert, and stations directly into your reservation!`,
      escalate: false,
      pkgId: chosenPkg.id,
      guestCount: count,
      isLiveApi: false,
      formData,
    }
  }

  return {
    text: `Mabuhay! For your **${eventTypeObj.label}**, I recommend the **${chosenPkg.name}** for **${count} guests**.\n\n` +
      `• **Estimated Total:** ${formatMoney(total)} (50% Downpayment: ${formatMoney(downpayment)})\n` +
      `• **Menu Inclusions:** ${chosenPkg.inclusions.slice(0, 3).join(', ')} and more\n` +
      (chosenPkg.entertainment.length > 0 ? `• **Entertainment Included:** ${chosenPkg.entertainment.join(', ')}\n` : '') +
      (selectedAddons.length > 0 ? `• **Selected Add-ons:** ${selectedAddons.join(', ')}\n` : '') +
      `• **Event Category:** ${eventTypeObj.category}\n\n` +
      `Click **"Auto-Fill Booking Wizard with AI Plan"** below to load this setup into the reservation form!`,
    escalate: false,
    pkgId: chosenPkg.id,
    guestCount: count,
    isLiveApi: false,
    formData,
  }
}

export const querySinagAI = async (
  userInput: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<AIResponse> => {
  // 1. Fetch live packages from Supabase DB to ensure chatbot uses current DB data
  let currentPackages: CateringPackage[] = []
  if (supabase) {
    try {
      const { data: dbPackages } = await supabase.from('packages').select('*')
      if (dbPackages && dbPackages.length > 0) {
        currentPackages = dbPackages.map(mapDatabasePackage)
      }
    } catch { /* The assistant will request a verified manual quotation. */ }
  }

  // 2. Call Google Gemini with gemini-3.8-flash if API key is present
  const rawKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    (import.meta.env.VITE_AI_API_KEY as string | undefined) || ''
  const apiKey = rawKey.startsWith('QVEu') ? atob(rawKey) : rawKey

  if (apiKey) {
    try {
      const packageCatalogDescription = currentPackages.map((p) => {
        const tierSummary = p.tiers.map((t) => `${t.pax} pax: PHP ${t.price.toLocaleString()}`).join(', ')
        return `[ID: ${p.id}] "${p.name}": Tiers (${tierSummary}). Excess pax: +PHP 700/pax with 10 buffer pax. Menu: ${p.inclusions.join(', ')}. Entertainment: ${p.entertainment.join(', ') || 'None'}.`
      }).join('\n')

      const systemPrompt = `You are Sinag Catering's warm, expert AI Concierge based in Baliwag, Bulacan.
Your role: Provide authentic Filipino hospitality, answer questions accurately according to official policies, and recommend celebration packages when clients inquire about planning or pricing an event.

OFFICIAL POLICIES & BUSINESS RULES:
1. Cancellation & Refund Policy:
   - 30 or more days before event date: 100% full refund of amount paid.
   - 14 to 29 days before event date: 50% refund of amount paid.
   - Less than 14 days before event date: 0% refund (Non-refundable, because ingredients, chef scheduling, and event staff are already finalized).
   - Rebooking / Rescheduling: Allowed with at least 14 days advance notice via the Client Portal subject to date availability without forfeiting downpayment.
2. Payment & Reservation Terms:
   - 50% downpayment required to lock in the event date.
   - Remaining 50% balance payable on or before the event day.
   - Payment channels: QR Ph / GCash (official merchant scan code or transfer to Sunshine C. 0928 714 4597), MariBank / Bank Transfer (0928 714 4597), Cash.
3. Lead Time:
   - Minimum 14 days advance booking required.
4. Location & Contact:
   - Baliwag, Bulacan, Philippines.
   - Hotline & GCash / MariBank: 0928 714 4597.

Official Packages Database:
${packageCatalogDescription}

Official Add-ons & Upgrades Catalog:
- EXTRA MAIN COURSES: +PHP 100 per guest (Cap: up to 3 extra main dishes).
- EXTRA PASTA COURSES: +PHP 80 per guest (Cap: up to 2 extra pasta dishes).
- EXTRA DESSERT COURSES: +PHP 50 per guest (Cap: up to 2 extra dessert courses).
- FLAT-RATE CELEBRATION STATIONS:
  * ADD-CANDY-01: Chocolate Fountain & Candy Buffet (PHP 1,500 flat)
  * ADD-HOST-02: Party Emcee & Games Host (PHP 2,000 flat)
  * ADD-DESSERT-03: Assorted Dessert Station (PHP 1,000 flat)
- EXCESS GUEST BUFFER FEE: +PHP 700 per excess guest beyond capacity (+10 food buffer pax).

CONTEXT-AWARE EVENT CLASSIFICATION:
Classify the event into one of the 4 official Sinag categories:
- 'Kids Birthday': Children's parties, birthdays, clown/magic themes.
- 'Debut': 18th birthdays, debutante balls, cotillion celebrations.
- 'Wedding': Weddings, nuptials, and matrimonial receptions.
- 'Others (Please Specify)': Corporate banquets, baptisms, anniversaries, reunions, and thanksgiving feasts.
Align your tone, terminology, and recommendations with this event category!

BUDGET MAXIMIZER UPSELL LOGIC:
When the user specifies a high target budget (e.g., wanting to spend an exact upper limit like PHP 150,000 for 80 guests, or budget of 120k):
- DO NOT stop short at just the base tier (e.g., returning only a PHP 65,000 base package when the client wants to spend PHP 150,000)!
- Intelligently bundle the base package with recommended upgrades to cleanly reach their target budget:
  1. Recommend the flagship 'Full Blast' (or highest tier package for their guest count).
  2. Bundle maximum extra courses: extra_main_count (up to 3), extra_pasta_count (up to 2), extra_dessert_count (up to 2).
  3. Bundle all flat celebration enhancements (ADD-CANDY-01, ADD-HOST-02, ADD-DESSERT-03).
  4. If a remaining budget surplus exists (e.g., target PHP 150,000 vs calculated bundle), explain that the remaining balance covers Bespoke Thematic Stage & Ceiling Styling, Professional Sound & Lighting, and VIP Floral Centerpieces.
  5. Provide a clear, enthusiastic itemized breakdown showing how each upgrade elevates their event to luxury banquet standards.
  6. In "form_data", accurately set "extra_main_count", "extra_pasta_count", "extra_dessert_count", "addons", "event_type", and "notes" so the user can click "Auto-Fill Booking Wizard with AI Plan" to immediately load the entire maximized package into the booking wizard!

CRITICAL INSTRUCTIONS ON WHEN TO RECOMMEND A PACKAGE:
- If the user is asking FAQ or general policy questions (such as refund policy, cancellation terms, payments, downpayment, location, contact info, lead time, or greetings):
  Answer their question directly and accurately in markdown. DO NOT recommend a package or event setup. Set "form_data" to null.
- ONLY populate "form_data" if the user is explicitly inquiring about packages, party planning, menu recommendations, guest pricing/estimates, or wanting to book an event.

Return your response in strict JSON format with this structure:
{
  "chat_reply": "Accurate, helpful answer in markdown",
  "form_data": null
}
OR if recommending a package:
{
  "chat_reply": "Friendly package recommendation and breakdown in markdown",
  "form_data": {
    "package_id": "budget-basic | budget-entertainment | full-blast",
    "package_name": "Exact package name",
    "guest_count": number,
    "event_type": "Kids Birthday | Debut | Wedding | Others (Please Specify)",
    "addons": ["ADD-CANDY-01", "ADD-HOST-02", "ADD-DESSERT-03"],
    "extra_main_count": number,
    "extra_pasta_count": number,
    "extra_dessert_count": number,
    "notes": "Short summary of special requests or preferences"
  }
}`

      const conversationContents = [
        ...history.slice(-4).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: userInput }] },
      ]

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: conversationContents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
      })

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json()
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          const parsed = JSON.parse(text)
          const replyText = parsed.chat_reply || ''
          const rawForm = parsed.form_data
          const isPurePolicyQuery = /^(what|how|where|when|can i|is there|do you).*(refund|cancel|resched|rebook|lead time|location|address|contact)/i.test(userInput) ||
            /refund policy|cancellation policy/i.test(userInput)

          if (!isPurePolicyQuery && rawForm && rawForm.package_id) {
            const chosenPkg = currentPackages.find((p) => p.id === rawForm.package_id) || currentPackages[0]
            const guestCount = Number(rawForm.guest_count) || extractGuestCount(userInput) || chosenPkg.defaultPax || 50
            const rawAddons = rawForm.addons || rawForm.selected_addons || []
            const addons = Array.isArray(rawAddons) ? rawAddons : []
            const extraMain = Number(rawForm.extra_main_count) || 0
            const extraPasta = Number(rawForm.extra_pasta_count) || 0
            const extraDessert = Number(rawForm.extra_dessert_count) || 0

            const exactTotal = calculateTotalForPackage(chosenPkg, guestCount, addons, extraMain, extraPasta, extraDessert)

            const formData: AIFormData = {
              package_id: chosenPkg.id,
              package_name: chosenPkg.name,
              guest_count: guestCount,
              estimated_total: exactTotal,
              selected_menu: chosenPkg.inclusions,
              addons,
              extra_main_count: extraMain,
              extra_pasta_count: extraPasta,
              extra_dessert_count: extraDessert,
              event_type: rawForm.event_type || detectEventType(userInput).category,
              notes: rawForm.notes || `AI package match: ${chosenPkg.name} (${guestCount} pax).`,
            }

            return {
              text: replyText,
              escalate: false,
              pkgId: chosenPkg.id,
              guestCount,
              isLiveApi: true,
              formData,
            }
          }

          return {
            text: replyText,
            escalate: false,
            isLiveApi: true,
          }
        }
      }
    } catch (err) {
      console.warn('Gemini live call error, using local fallback:', err)
    }
  }

  // 3. Graceful offline / fallback engine
  return generateLocalAIResponse(userInput, currentPackages)
}
