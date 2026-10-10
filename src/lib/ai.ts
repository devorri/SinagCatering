import { supabase } from './supabase'
import {
  AI_CATALOG_ADDONS,
  EXCESS_PAX_RATE,
  EXTRA_DESSERT_RATE,
  EXTRA_MAIN_RATE,
  EXTRA_PASTA_RATE,
  FOOD_BUFFER_PAX,
  SINAG_PACKAGES,
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

export const generateLocalAIResponse = (input: string, livePackages: CateringPackage[] = SINAG_PACKAGES): AIResponse => {
  const count = extractGuestCount(input) || 70
  const inputLower = input.toLowerCase()
  const needsEntertainment = /clown|magic|entertainment|host|photo|sounds/i.test(inputLower)
  const isGrand = /grand|blast|premium|full|ceiling/i.test(inputLower)

  let chosenPkg = livePackages[1] || livePackages[0] // default Budgetarian Plus
  if (isGrand) {
    chosenPkg = livePackages.find((p) => p.id === 'full-blast') || chosenPkg
  } else if (!needsEntertainment && /simple|basic|budget|low cost/i.test(inputLower)) {
    chosenPkg = livePackages.find((p) => p.id === 'budget-basic') || chosenPkg
  } else {
    const reco = recommendPackage(count, 60000, needsEntertainment)
    if (reco?.pkg) chosenPkg = reco.pkg
  }

  const selectedAddons: string[] = []
  if (/candy|chocolate|fountain/i.test(inputLower)) selectedAddons.push('ADD-CANDY-01')
  if (/emcee|games|host/i.test(inputLower) && chosenPkg.id === 'budget-basic') selectedAddons.push('ADD-HOST-02')
  if (/dessert|station/i.test(inputLower)) selectedAddons.push('ADD-DESSERT-03')

  const extraDessert = /extra dessert|sweets/i.test(inputLower) ? 1 : 0
  const extraMain = /extra main|additional dish/i.test(inputLower) ? 1 : 0
  const extraPasta = /extra pasta/i.test(inputLower) ? 1 : 0

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
    event_type: 'Kids Birthday',
    notes: `AI Recommendation based on inquiry: "${input}". 50% Downpayment: ${formatMoney(downpayment)}.`,
  }

  return {
    text: `Mabuhay! Based on your event, I recommend the **${chosenPkg.name}** for **${count} guests**.\n\n` +
      `• **Estimated Total:** ${formatMoney(total)} (50% Downpayment: ${formatMoney(downpayment)})\n` +
      `• **Menu Inclusions:** ${chosenPkg.inclusions.slice(0, 3).join(', ')} and more\n` +
      (chosenPkg.entertainment.length > 0 ? `• **Entertainment Included:** ${chosenPkg.entertainment.join(', ')}\n` : '') +
      (selectedAddons.length > 0 ? `• **Add-ons:** ${selectedAddons.join(', ')}\n` : '') +
      `\nYou can click **"Auto-Fill Booking Wizard with AI Plan"** below to instantly load this setup into the reservation form!`,
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
  let currentPackages = SINAG_PACKAGES
  if (supabase) {
    try {
      const { data: dbPackages } = await supabase.from('packages').select('*')
      if (dbPackages && dbPackages.length > 0) {
        currentPackages = dbPackages.map((p) => ({
          id: p.id,
          name: p.name,
          shortName: p.name.split(' ')[0] || p.name,
          bestFor: p.ideal_for || '',
          description: p.ideal_for || '',
          tiers: Array.isArray(p.tier_prices) ? p.tier_prices : [{ pax: 50, price: p.base_price || 35000 }],
          pricePerHead: p.price_per_head || undefined,
          defaultPax: p.default_pax || 50,
          currency: 'PHP',
          inclusions: Array.isArray(p.included_menu) ? p.included_menu : [],
          entertainment: p.id === 'budget-basic' ? [] : ['Clown / host', 'Magician', 'Photo booth', 'Photographer', 'Lights & sounds'],
          freebies: ['Candy & sweet corner', 'Event coordinator', 'Souvenirs', 'Standee'],
        }))
      }
    } catch {
      // Use SINAG_PACKAGES
    }
  }

  // 2. Call Google Gemini with gemini-3.8-flash if API key is present
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ||
    (import.meta.env.VITE_AI_API_KEY as string | undefined)

  if (apiKey) {
    try {
      const packageCatalogDescription = currentPackages.map((p) => {
        const tierSummary = p.tiers.map((t) => `${t.pax} pax: PHP ${t.price.toLocaleString()}`).join(', ')
        return `[ID: ${p.id}] "${p.name}": Tiers (${tierSummary}). Excess pax: +PHP 700/pax with 10 buffer pax. Menu: ${p.inclusions.join(', ')}. Entertainment: ${p.entertainment.join(', ') || 'None'}.`
      }).join('\n')

      const systemPrompt = `You are Sinag Catering's warm, expert AI Concierge based in Baliwag, Bulacan.
Your role: Recommend the best kids party or celebration package from our official database. Answer questions accurately with authentic Filipino hospitality.

Official Packages Database:
${packageCatalogDescription}

Add-ons Catalog:
- ADD-CANDY-01: Chocolate Fountain & Candy Buffet (PHP 150)
- ADD-HOST-02: Party Emcee & Games Host (PHP 200)
- ADD-DESSERT-03: Assorted Dessert Station (PHP 100)
- Extra Main Course: PHP 100 per guest
- Extra Pasta Course: PHP 80 per guest
- Extra Dessert Course: PHP 50 per guest

Payment Policy: 50% downpayment locks the date. Remaining balance payable on event day.

Return your response in strict JSON format with this structure:
{
  "chat_reply": "Friendly response explaining the package and breakdown in markdown",
  "form_data": {
    "package_id": "budget-basic | budget-entertainment | full-blast",
    "package_name": "Exact package name",
    "guest_count": number,
    "event_type": "Kids Birthday | Debut | Wedding | Others (Please Specify)",
    "addons": ["ADD-CANDY-01", etc],
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

          if (rawForm && rawForm.package_id) {
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
              event_type: rawForm.event_type || 'Kids Birthday',
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
