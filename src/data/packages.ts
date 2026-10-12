export interface PackageTier {
  pax: number
  price: number
}

export interface CateringPackage {
  id: string
  name: string
  shortName: string
  bestFor: string
  description: string
  tiers: PackageTier[]
  pricePerHead?: number
  defaultPax?: number
  currency?: 'PHP'
  inclusions: string[]
  entertainment: string[]
  freebies: string[]
}

export interface CateringAddon {
  id: string
  name: string
  price: number
  currency: 'PHP'
}

export const SINAG_PACKAGES: CateringPackage[] = [
  {
    id: 'budget-basic',
    name: 'Budgetarian Kids Party Package',
    shortName: 'Budgetarian Basic',
    bestFor: 'simple kids birthdays with full food and party setup',
    description: 'Complete food buffet, table styling, service crew, and party freebies without entertainment add-ons.',
    tiers: [
      { pax: 50, price: 35000 },
      { pax: 70, price: 40000 },
      { pax: 100, price: 45000 },
      { pax: 150, price: 65000 },
      { pax: 200, price: 90000 },
    ],
    inclusions: [
      '4 main dishes',
      'Dessert and drinks',
      'Elegant buffet setup',
      'Food warmer or roll top with serving spoons',
      'Dinner plates, spoon and fork, glassware and pitcher',
      'Professional waiter services',
      'Fully dressed monoblock chairs',
      'Round tables with floor-length motif table cloth',
      'Decorated cake, gifts, and giveaways table',
      'Centerpiece for individual tables',
      'Ribbon for individual chairs',
      'Stage decor and backdrop',
      'Entrance setup',
    ],
    entertainment: [],
    freebies: [
      'Candy and sweet corner',
      'Event coordinator',
      'Ref magnet souvenir',
      'Styro name cut outs',
      'Lighted number standee',
    ],
  },
  {
    id: 'budget-entertainment',
    name: 'Budgetarian Kids Party Package with Freebies',
    shortName: 'Budgetarian Plus',
    bestFor: 'kids parties that need entertainers and photo coverage',
    description: 'Budgetarian inclusions plus entertainment options for a livelier children party.',
    tiers: [
      { pax: 50, price: 47000 },
      { pax: 70, price: 52000 },
      { pax: 100, price: 56000 },
      { pax: 150, price: 76000 },
      { pax: 200, price: 102000 },
    ],
    inclusions: [
      '4 main dishes',
      'Dessert and drinks',
      'Elegant buffet setup',
      'Food warmer or roll top with serving spoons',
      'Dinner plates, spoon and fork, glassware and pitcher',
      'Professional waiter services',
      'Fully dressed monoblock chairs',
      'Round tables with floor-length motif table cloth',
      'Decorated cake, gifts, and giveaways table',
      'Centerpiece for individual tables',
      'Ribbon for individual chairs',
      'Stage decor and backdrop',
      'Entrance setup',
    ],
    entertainment: ['Clown / host', 'Magician', 'Photo booth', 'Photographer', 'Lights and sounds'],
    freebies: [
      'Candy and sweet corner',
      'Event coordinator',
      'Ref magnet souvenir',
      'Styro name cut outs',
      'Lighted number standee',
    ],
  },
  {
    id: 'full-blast',
    name: 'Full Blast Kids Party Package with Freebies',
    shortName: 'Full Blast',
    bestFor: 'premium children parties with stage, ceiling, and complete entertainment',
    description: 'The most complete Sinag kids party setup with premium styling and entertainment coverage.',
    tiers: [
      { pax: 50, price: 55000 },
      { pax: 70, price: 60000 },
      { pax: 100, price: 63000 },
      { pax: 150, price: 84000 },
      { pax: 200, price: 109000 },
    ],
    inclusions: [
      '4 main dishes',
      'Dessert and drinks',
      'Elegant buffet setup',
      'Food warmer or roll top with serving spoons',
      'Dinner plates, spoon and fork, glassware and pitcher',
      'Professional waiter services',
      'Fully dressed monoblock chairs',
      'Round tables with floor-length motif table cloth',
      'Decorated cake, gifts, and giveaways table',
      'Centerpiece for individual tables',
      'Ribbon for individual chairs',
      'Full Blast stage decor and backdrop',
      'Full Blast entrance setup',
      'Balloon ceiling',
    ],
    entertainment: ['Clown / host', 'Magician', 'Photo booth', 'Photographer', 'Lights and sounds'],
    freebies: [
      'Candy and sweet corner',
      'Event coordinator',
      'Ref magnet souvenir',
      'Styro name cut outs',
      'Lighted number standee',
    ],
  },
]

export const AI_CATALOG_ADDONS: CateringAddon[] = [
  { id: 'ADD-CANDY-01', name: 'Chocolate Fountain & Candy Buffet', price: 150, currency: 'PHP' },
  { id: 'ADD-HOST-02', name: 'Party Emcee & Games Host', price: 200, currency: 'PHP' },
  { id: 'ADD-DESSERT-03', name: 'Assorted Dessert Station', price: 100, currency: 'PHP' },
]

export const formatMoney = (amount: number, currency: 'PHP' = 'PHP'): string =>
  `${currency} ${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`

export const FOOD_BUFFER_PAX = 10
export const EXCESS_PAX_RATE = 700
export const EXTRA_MAIN_RATE = 100
export const EXTRA_PASTA_RATE = 80
export const EXTRA_DESSERT_RATE = 50

export const MAIN_DISHES = ['Beef Broccoli', 'Cordon Bleu', 'Menudo', 'Caldereta', 'Mixed Veggies', 'Chicken Curry', 'Fish Fillet']
export const PASTA_DISHES = ['Pancit', 'Spaghetti', 'Carbonara']

export const findTierForGuestCount = (pkg: CateringPackage, guestCount: number) => {
  if (pkg.pricePerHead !== undefined) {
    return { pax: guestCount, price: guestCount * pkg.pricePerHead }
  }
  return pkg.tiers.find((tier) => guestCount <= tier.pax + FOOD_BUFFER_PAX) || pkg.tiers[pkg.tiers.length - 1]
}

export interface RecommendedPackageResult {
  pkg: CateringPackage
  tier: PackageTier
  estimatedTotal: number
  score: number
  suggestedAddons: {
    extraMain: number
    extraPasta: number
    extraDessert: number
    addonIds: string[]
  }
  customizationNotes: string[]
  budgetExceeded?: boolean
}

export const recommendPackage = (
  guestCount: number,
  budget: number,
  needsEntertainment: boolean,
): RecommendedPackageResult => {
  // 1. Evaluate each package base configuration
  const evaluatedPackages = SINAG_PACKAGES.map((pkg) => {
    const tier = findTierForGuestCount(pkg, guestCount)
    const overage = Math.max(0, guestCount - (tier.pax + FOOD_BUFFER_PAX))
    const baseTotal = tier.price + overage * EXCESS_PAX_RATE

    let fitScore = 0
    if (needsEntertainment && pkg.entertainment.length > 0) fitScore += 50
    if (!needsEntertainment && pkg.id === 'budget-basic') fitScore += 40
    if (pkg.id === 'full-blast') fitScore += 30

    return { pkg, tier, baseTotal, fitScore }
  })

  // Filter packages that can fit within budget at base level
  const affordablePackages = evaluatedPackages.filter((ep) => ep.baseTotal <= budget)

  // Never return a price above the customer's ceiling. The UI may use the
  // lowest tier as a reference, but it is not an applicable recommendation.
  if (affordablePackages.length === 0) {
    const lowest = [...evaluatedPackages].sort((a, b) => a.baseTotal - b.baseTotal)[0]
    return {
      pkg: lowest.pkg,
      tier: lowest.tier,
      estimatedTotal: 0,
      score: 0,
      suggestedAddons: { extraMain: 0, extraPasta: 0, extraDessert: 0, addonIds: [] },
      customizationNotes: [`No standard package fits this budget. The lowest available configuration is ${formatMoney(lowest.baseTotal)}.`],
      budgetExceeded: true,
    }
  }

  // Sort affordable packages by preference: highest tier fitting entertainment preferences
  affordablePackages.sort((a, b) => {
    if (needsEntertainment) {
      const aEnt = a.pkg.entertainment.length > 0 ? 1 : 0
      const bEnt = b.pkg.entertainment.length > 0 ? 1 : 0
      if (bEnt !== aEnt) return bEnt - aEnt
    }
    return b.baseTotal - a.baseTotal || b.fitScore - a.fitScore
  })

  const chosen = affordablePackages[0]
  let currentTotal = chosen.baseTotal
  const suggestedAddons = { extraMain: 0, extraPasta: 0, extraDessert: 0, addonIds: [] as string[] }
  const customizationNotes: string[] = []

  // 2. Optimal Value Matching: utilize remaining headroom up to the user budget
  let remainingBudget = budget - currentTotal

  // If we have headroom for extra main dishes (up to 2 dishes)
  const extraMainCostPerDish = guestCount * EXTRA_MAIN_RATE
  while (suggestedAddons.extraMain < 2 && remainingBudget >= extraMainCostPerDish) {
    suggestedAddons.extraMain += 1
    remainingBudget -= extraMainCostPerDish
    currentTotal += extraMainCostPerDish
  }
  if (suggestedAddons.extraMain > 0) {
    customizationNotes.push(`+${suggestedAddons.extraMain} Extra Main Dish${suggestedAddons.extraMain > 1 ? 'es' : ''} (+₱${(suggestedAddons.extraMain * extraMainCostPerDish).toLocaleString()})`)
  }

  // If we have headroom for extra pasta (up to 1 dish)
  const extraPastaCost = guestCount * EXTRA_PASTA_RATE
  if (suggestedAddons.extraPasta < 1 && remainingBudget >= extraPastaCost) {
    suggestedAddons.extraPasta += 1
    remainingBudget -= extraPastaCost
    currentTotal += extraPastaCost
    customizationNotes.push(`+1 Extra Gourmet Pasta Dish (+₱${extraPastaCost.toLocaleString()})`)
  }

  // If we have headroom for extra dessert (up to 1 dish)
  const extraDessertCost = guestCount * EXTRA_DESSERT_RATE
  if (suggestedAddons.extraDessert < 1 && remainingBudget >= extraDessertCost) {
    suggestedAddons.extraDessert += 1
    remainingBudget -= extraDessertCost
    currentTotal += extraDessertCost
    customizationNotes.push(`+1 Extra Specialty Dessert Station (+₱${extraDessertCost.toLocaleString()})`)
  }

  // Include catalog add-on if applicable
  for (const addon of AI_CATALOG_ADDONS) {
    const addonPrice = addon.price * guestCount
    if (remainingBudget >= addonPrice) {
      suggestedAddons.addonIds.push(addon.id)
      currentTotal += addonPrice
      customizationNotes.push(`+${addon.name} (+₱${addonPrice.toLocaleString()})`)
      break
    }
  }

  return {
    pkg: chosen.pkg,
    tier: chosen.tier,
    estimatedTotal: currentTotal,
    score: chosen.fitScore + 50,
    suggestedAddons,
    customizationNotes,
    budgetExceeded: false,
  }
}

