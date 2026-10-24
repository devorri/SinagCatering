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
  imageUrl?: string
  details?: Record<string, any>
}

export interface CateringAddon {
  id: string
  name: string
  price: number
  currency: 'PHP'
  rateType?: 'flat' | 'per_head'
  description?: string
}

export const STORAGE_FILES_BASE = 'https://wldhvmbcvjbnwkgiafpg.supabase.co/storage/v1/object/public/Files'

export const SINAG_PACKAGES: CateringPackage[] = [
  {
    id: 'budget-basic',
    name: 'Budgetarian Celebration Package',
    shortName: 'Budgetarian Basic',
    bestFor: 'celebrations and gatherings with full food and event setup',
    imageUrl: `${STORAGE_FILES_BASE}/packages/pkg_budget_basic.jpg`,
    description: 'Complete food buffet, table styling, service crew, and celebration freebies without entertainment add-ons.',
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
    name: 'Budgetarian Package with Freebies and Entertainment',
    shortName: 'Budgetarian Plus',
    bestFor: 'parties and celebrations that need entertainers and photo coverage',
    imageUrl: `${STORAGE_FILES_BASE}/packages/pkg_budget_entertainment.jpg`,
    description: 'Budgetarian inclusions plus entertainment coverage for a lively celebration.',
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
    name: 'Full Blast Package with Freebies',
    shortName: 'Full Blast',
    bestFor: 'premium celebrations with stage styling, balloon ceiling, and complete entertainment',
    imageUrl: `${STORAGE_FILES_BASE}/packages/pkg_full_blast.jpg`,
    description: 'The most complete Sinag celebration setup with premium styling and entertainment coverage.',
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
  { id: 'ADD-CANDY-01', name: 'Chocolate Fountain & Candy Buffet', price: 1500, currency: 'PHP' },
  { id: 'ADD-HOST-02', name: 'Party Emcee & Games Host', price: 2000, currency: 'PHP' },
  { id: 'ADD-DESSERT-03', name: 'Assorted Dessert Station', price: 1000, currency: 'PHP' },
]

export const mapDatabasePackage = (record: any): CateringPackage => {
  const details = record.details && typeof record.details === 'object' ? record.details : {}
  const tiers = Array.isArray(record.tier_prices) ? record.tier_prices : []
  return {
    id: record.id,
    name: record.name,
    shortName: record.name,
    bestFor: record.ideal_for || '',
    description: record.ideal_for || '',
    tiers,
    pricePerHead: record.price_per_head ?? undefined,
    defaultPax: record.default_pax ?? tiers[0]?.pax,
    currency: 'PHP',
    inclusions: Array.isArray(details.inclusions) ? details.inclusions : (Array.isArray(record.included_menu) ? record.included_menu : []),
    entertainment: Array.isArray(details.entertainment) ? details.entertainment : [],
    freebies: Array.isArray(details.freebies) ? details.freebies : [],
    imageUrl: details.image_url || record.image_url || undefined,
    details,
  }
}

export const formatMoney = (amount: number, currency: 'PHP' = 'PHP'): string =>
  `${currency} ${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`

export const FOOD_BUFFER_PAX = 10
export const EXCESS_PAX_RATE = 700
export const EXTRA_MAIN_RATE = 100
export const EXTRA_PASTA_RATE = 80
export const EXTRA_DESSERT_RATE = 50

export const MAIN_DISHES = ['Beef Broccoli', 'Cordon Bleu', 'Menudo', 'Caldereta', 'Mixed Veggies', 'Chicken Curry', 'Fish Fillet']
export const PASTA_DISHES = ['Pancit', 'Spaghetti', 'Carbonara']

export interface DishMetadata {
  name: string
  category: 'main' | 'pasta'
  tag: string
  description: string
  image: string
}

export const DISH_DETAILS: Record<string, DishMetadata> = {
  'Beef Broccoli': {
    name: 'Beef Broccoli',
    category: 'main',
    tag: 'Signature Beef',
    description: 'Tender beef strips simmered in savory garlic soy sauce with crisp broccoli.',
    image: `${STORAGE_FILES_BASE}/menu/food_beef_broccoli.jpg`,
  },
  'Cordon Bleu': {
    name: 'Cordon Bleu',
    category: 'main',
    tag: 'Poultry Favorite',
    description: 'Crispy breaded chicken breast stuffed with savory ham and molten cheese.',
    image: `${STORAGE_FILES_BASE}/menu/food_cordon_bleu.jpg`,
  },
  'Menudo': {
    name: 'Menudo',
    category: 'main',
    tag: 'Fiesta Classic',
    description: 'Tender pork cubes and liver simmered in spiced tomato stew with vegetables.',
    image: `${STORAGE_FILES_BASE}/menu/food_menudo.jpg`,
  },
  'Caldereta': {
    name: 'Caldereta',
    category: 'main',
    tag: 'Hearty Braised Beef',
    description: 'Slow-braised beef in a rich liver-infused tomato gravy with bell peppers.',
    image: `${STORAGE_FILES_BASE}/menu/food_caldereta.jpg`,
  },
  'Mixed Veggies': {
    name: 'Mixed Veggies',
    category: 'main',
    tag: 'Buttered Medley',
    description: 'Fresh seasonal vegetables sautéed in butter and garlic, paired with quail eggs.',
    image: `${STORAGE_FILES_BASE}/menu/food_mixed_veggies_quail_egg.jpg`,
  },
  'Chicken Curry': {
    name: 'Chicken Curry',
    category: 'main',
    tag: 'Aromatic Curry',
    description: 'Tender chicken braised in fragrant yellow coconut curry with tender potatoes.',
    image: `${STORAGE_FILES_BASE}/menu/food_chicken_curry.jpg`,
  },
  'Fish Fillet': {
    name: 'Fish Fillet',
    category: 'main',
    tag: 'Crispy Seafood',
    description: 'Golden-crusted dory fish fillets served with homemade tartar dipping sauce.',
    image: `${STORAGE_FILES_BASE}/menu/food_fish_fillet.jpg`,
  },
  'Pancit': {
    name: 'Pancit',
    category: 'pasta',
    tag: 'Traditional Feast',
    description: 'Sautéed bihon and canton noodles tossed with shredded vegetables and meat.',
    image: `${STORAGE_FILES_BASE}/menu/food_pancit.jpg`,
  },
  'Spaghetti': {
    name: 'Spaghetti',
    category: 'pasta',
    tag: 'Sweet-Style Pinoy',
    description: 'Party-favorite sweet-savory ground meat sauce topped with shredded cheddar.',
    image: `${STORAGE_FILES_BASE}/menu/food_spag.jpg`,
  },
  'Carbonara': {
    name: 'Carbonara',
    category: 'pasta',
    tag: 'Creamy Bacon',
    description: 'Al dente pasta coated in luscious garlic cream with crispy smoked bacon.',
    image: `${STORAGE_FILES_BASE}/menu/food_carbonara.jpg`,
  },
}

export const DRINK_OPTIONS = ['Blue Lemonade', 'Iced Tea', 'Cucumber'] as const
export type DrinkOption = typeof DRINK_OPTIONS[number]

export interface DrinkMetadata {
  name: string
  tag: string
  description: string
  image: string
  color: string
  accentColor: string
}

export const DRINK_DETAILS: Record<string, DrinkMetadata> = {
  'Blue Lemonade': {
    name: 'Blue Lemonade',
    tag: 'Citrus Cooler',
    description: 'Vibrant chilled sweet-tangy blue lemonade garnished with fresh lemon slices and mint leaves.',
    image: `${STORAGE_FILES_BASE}/menu/drink_blue_lemonade.jpg`,
    color: '#0284C7',
    accentColor: '#F0F9FF',
  },
  'Iced Tea': {
    name: 'Iced Tea',
    tag: 'Signature House Blend',
    description: 'Crisp and refreshing house-blend sweet iced tea brewed fresh and served ice-chilled.',
    image: `${STORAGE_FILES_BASE}/menu/drink_iced_tea.jpg`,
    color: '#D97706',
    accentColor: '#FFFBEB',
  },
  'Cucumber': {
    name: 'Cucumber',
    tag: 'Crisp Refresher',
    description: 'Cooling cucumber-infused lemon refreshment with crisp fresh cucumber ribbon slices.',
    image: `${STORAGE_FILES_BASE}/menu/drink_cucumber.jpg`,
    color: '#059669',
    accentColor: '#ECFDF5',
  },
}

export const findTierForGuestCount = (pkg: CateringPackage, guestCount: number) => {
  if (pkg.pricePerHead !== undefined) {
    return { pax: guestCount, price: guestCount * pkg.pricePerHead }
  }
  const tiers = Array.isArray(pkg.tiers) && pkg.tiers.length > 0
    ? pkg.tiers
    : [{ pax: pkg.defaultPax || 50, price: (pkg.details as any)?.base_price || 35000 }]
  return tiers.find((tier) => guestCount <= tier.pax + FOOD_BUFFER_PAX) || tiers[tiers.length - 1]
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

export function recommendPackage(
  guestCount: number,
  budget: number,
  needsEntertainment?: boolean,
  packagesList?: CateringPackage[]
): RecommendedPackageResult
export function recommendPackage(
  packagesList: CateringPackage[],
  guestCount: number,
  budget: number,
  needsEntertainment?: boolean
): RecommendedPackageResult
export function recommendPackage(
  arg1: number | CateringPackage[],
  arg2: number,
  arg3?: number | boolean,
  arg4?: boolean | CateringPackage[]
): RecommendedPackageResult {
  let pkgList = SINAG_PACKAGES
  let guestCount = 50
  let budget = 50000
  let needsEntertainment: boolean | undefined = undefined

  if (Array.isArray(arg1)) {
    pkgList = arg1.length > 0 ? arg1 : SINAG_PACKAGES
    guestCount = arg2
    budget = Number(arg3 || 50000)
    if (typeof arg4 === 'boolean') {
      needsEntertainment = arg4
    }
  } else {
    guestCount = arg1
    budget = arg2
    if (typeof arg3 === 'boolean') {
      needsEntertainment = arg3
    }
    if (Array.isArray(arg4) && arg4.length > 0) {
      pkgList = arg4
    }
  }

  // 1. Evaluate each package base configuration solely based on Guest Count and Budget
  const evaluatedPackages = pkgList.map((pkg) => {
    const tier = findTierForGuestCount(pkg, guestCount)
    const overage = Math.max(0, guestCount - (tier.pax + FOOD_BUFFER_PAX))
    const baseTotal = tier.price + overage * EXCESS_PAX_RATE

    // Package richness score: packages with complete entertainment & freebies offer higher all-inclusive value
    const featureScore = (pkg.entertainment?.length || 0) * 15 + (pkg.freebies?.length || 0) * 5

    let fitScore = featureScore
    if (needsEntertainment !== undefined) {
      if (needsEntertainment && pkg.entertainment.length > 0) fitScore += 50
      if (!needsEntertainment && pkg.id === 'budget-basic') fitScore += 40
    }

    return { pkg, tier, baseTotal, fitScore, featureScore }
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

  // Sort affordable packages:
  // Automatically evaluate based on highest tier base package that cleanly fits budget,
  // followed by package all-inclusive richness (entertainment & freebies)
  affordablePackages.sort((a, b) => {
    if (needsEntertainment !== undefined) {
      const aEnt = a.pkg.entertainment.length > 0 ? 1 : 0
      const bEnt = b.pkg.entertainment.length > 0 ? 1 : 0
      if (bEnt !== aEnt) return (bEnt - aEnt) * (needsEntertainment ? 1 : -1)
    }
    return b.baseTotal - a.baseTotal || b.featureScore - a.featureScore || b.fitScore - a.fitScore
  })

  const chosen = affordablePackages[0]
  let currentTotal = chosen.baseTotal
  const suggestedAddons = { extraMain: 0, extraPasta: 0, extraDessert: 0, addonIds: [] as string[] }
  const customizationNotes: string[] = []

  // 2. Optimal Value Matching: utilize remaining headroom up to the user budget
  let remainingBudget = budget - currentTotal

  // If we have headroom for extra main dishes (up to 3 dishes, +₱100/pax)
  const extraMainCostPerDish = guestCount * EXTRA_MAIN_RATE
  while (suggestedAddons.extraMain < 3 && remainingBudget >= extraMainCostPerDish) {
    suggestedAddons.extraMain += 1
    remainingBudget -= extraMainCostPerDish
    currentTotal += extraMainCostPerDish
  }
  if (suggestedAddons.extraMain > 0) {
    customizationNotes.push(`+${suggestedAddons.extraMain} Extra Main Dish${suggestedAddons.extraMain > 1 ? 'es' : ''} (+₱${(suggestedAddons.extraMain * extraMainCostPerDish).toLocaleString()})`)
  }

  // If we have headroom for extra pasta (up to 2 dishes, +₱80/pax)
  const extraPastaCost = guestCount * EXTRA_PASTA_RATE
  while (suggestedAddons.extraPasta < 2 && remainingBudget >= extraPastaCost) {
    suggestedAddons.extraPasta += 1
    remainingBudget -= extraPastaCost
    currentTotal += extraPastaCost
  }
  if (suggestedAddons.extraPasta > 0) {
    customizationNotes.push(`+${suggestedAddons.extraPasta} Extra Pasta Dish${suggestedAddons.extraPasta > 1 ? 'es' : ''} (+₱${(suggestedAddons.extraPasta * extraPastaCost).toLocaleString()})`)
  }

  // If we have headroom for extra dessert (up to 2 dishes, +₱50/pax)
  const extraDessertCost = guestCount * EXTRA_DESSERT_RATE
  while (suggestedAddons.extraDessert < 2 && remainingBudget >= extraDessertCost) {
    suggestedAddons.extraDessert += 1
    remainingBudget -= extraDessertCost
    currentTotal += extraDessertCost
  }
  if (suggestedAddons.extraDessert > 0) {
    customizationNotes.push(`+${suggestedAddons.extraDessert} Extra Dessert Course${suggestedAddons.extraDessert > 1 ? 's' : ''} (+₱${(suggestedAddons.extraDessert * extraDessertCost).toLocaleString()})`)
  }

  // Include flat catalog add-ons if headroom allows (Candy Station, Emcee, Dessert Station)
  for (const addon of AI_CATALOG_ADDONS) {
    if (remainingBudget >= addon.price) {
      suggestedAddons.addonIds.push(addon.id)
      remainingBudget -= addon.price
      currentTotal += addon.price
      customizationNotes.push(`+${addon.name} (+₱${addon.price.toLocaleString()})`)
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

