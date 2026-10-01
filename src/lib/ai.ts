import { supabase } from './supabase'
import { AI_CATALOG_ADDONS, formatMoney, SINAG_PACKAGES } from '../data/packages'

export interface AIFormData {
  package_id: string
  package_name: string
  guest_count: number
  estimated_total: number
  selected_menu: string[]
  addons: string[]
}

export interface AIResponse {
  text: string
  escalate: boolean
  pkgId?: string
  guestCount?: number
  isLiveApi?: boolean
  formData?: AIFormData
}

const AI_PACKAGES = SINAG_PACKAGES.filter((pkg) => pkg.id.startsWith('PKG-'))

const extractGuestCount = (input: string): number | undefined => {
  const match = input.match(/\b(\d{1,4})\s*(?:guests?|people|persons?|pax|heads)\b/i)
  return match ? Number(match[1]) : undefined
}

const choosePackage = (input: string) => {
  const message = input.toLowerCase()
  if (/wedding|corporate|gala|formal|executive/.test(message)) {
    return AI_PACKAGES.find((pkg) => pkg.id === 'PKG-PREMIER-03')!
  }
  if (/family|reunion|adult|classic/.test(message)) {
    return AI_PACKAGES.find((pkg) => pkg.id === 'PKG-CLASSIC-02')!
  }
  return AI_PACKAGES.find((pkg) => pkg.id === 'PKG-KIDDIE-01')!
}

const makeFormData = (input: string, raw?: Partial<AIFormData> | null): AIFormData => {
  const requestedPackage = AI_PACKAGES.find((pkg) => pkg.id === raw?.package_id)
  const pkg = requestedPackage ?? choosePackage(input)
  const parsedCount = Number(raw?.guest_count)
  const guestCount = Number.isFinite(parsedCount) && parsedCount > 0
    ? Math.min(Math.floor(parsedCount), 1000)
    : extractGuestCount(input) ?? pkg.defaultPax ?? 50
  const requestedAddonIds = Array.isArray(raw?.addons) ? raw.addons : []
  const inputLower = input.toLowerCase()
  const addonIds = requestedPackage
    ? requestedAddonIds.filter((id) => AI_CATALOG_ADDONS.some((addon) => addon.id === id))
    : AI_CATALOG_ADDONS.filter((addon) => {
        if (addon.id === 'ADD-CANDY-01') return /candy|chocolate|kids?|birthday/.test(inputLower)
        if (addon.id === 'ADD-HOST-02') return /host|emcee|games/.test(inputLower)
        return /dessert|sweet/.test(inputLower)
      }).map((addon) => addon.id)
  const addonsTotal = AI_CATALOG_ADDONS
    .filter((addon) => addonIds.includes(addon.id))
    .reduce((sum, addon) => sum + addon.price, 0)

  return {
    package_id: pkg.id,
    package_name: pkg.name,
    guest_count: guestCount,
    estimated_total: guestCount * (pkg.pricePerHead ?? 0) + addonsTotal,
    selected_menu: pkg.inclusions,
    addons: addonIds,
  }
}

const isRecommendationRequest = (input: string): boolean =>
  /recommend|suggest|best|package|setup|birthday|wedding|reunion|buffet|guests?|pax/i.test(input)

export const generateDynamicAIResponse = (input: string): AIResponse => {
  if (!isRecommendationRequest(input)) {
    return {
      text: 'I can match your event to one of our three catering packages. Please share the event type and approximate guest count, or contact our concierge desk for payment and policy questions.',
      escalate: true,
    }
  }

  const formData = makeFormData(input)
  const addonNames = formData.addons
    .map((id) => AI_CATALOG_ADDONS.find((addon) => addon.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const addonText = addonNames.length ? ` I included ${addonNames.join(' and ')}.` : ''
  const perHead = AI_PACKAGES.find((pkg) => pkg.id === formData.package_id)?.pricePerHead ?? 0

  return {
    text: `Based on your event, I recommend ${formData.package_name} for ${formData.guest_count} guests. It includes ${formData.selected_menu.join(', ')}. The estimate is ${formatMoney(formData.estimated_total)} at ${formatMoney(perHead)} per guest.${addonText}`,
    escalate: false,
    pkgId: formData.package_id,
    guestCount: formData.guest_count,
    isLiveApi: false,
    formData,
  }
}

export const querySinagAI = async (
  userInput: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<AIResponse> => {
  if (!supabase) return generateDynamicAIResponse(userInput)

  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: userInput,
        history: history.slice(-4).map(({ role, content }) => ({ role, content: content.slice(0, 1000) })),
      },
    })

    if (error || !data || typeof data.chat_reply !== 'string') {
      return generateDynamicAIResponse(userInput)
    }

    const formData = data.form_data
      ? makeFormData(userInput, data.form_data as Partial<AIFormData>)
      : undefined

    return {
      text: data.chat_reply,
      escalate: !formData && data.escalate === true,
      pkgId: formData?.package_id,
      guestCount: formData?.guest_count,
      isLiveApi: true,
      formData,
    }
  } catch {
    return generateDynamicAIResponse(userInput)
  }
}
