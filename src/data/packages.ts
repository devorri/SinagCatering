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
  inclusions: string[]
  entertainment: string[]
  freebies: string[]
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

export const FOOD_BUFFER_PAX = 10
export const EXCESS_PAX_RATE = 700
export const EXTRA_MAIN_RATE = 100
export const EXTRA_PASTA_RATE = 80
export const EXTRA_DESSERT_RATE = 50

export const findTierForGuestCount = (pkg: CateringPackage, guestCount: number) => {
  return pkg.tiers.find((tier) => guestCount <= tier.pax + FOOD_BUFFER_PAX) || pkg.tiers[pkg.tiers.length - 1]
}

export const recommendPackage = (guestCount: number, budget: number, needsEntertainment: boolean) => {
  const candidates = SINAG_PACKAGES.map((pkg) => {
    const tier = findTierForGuestCount(pkg, guestCount)
    const overage = Math.max(0, guestCount - (tier.pax + FOOD_BUFFER_PAX))
    const estimatedTotal = tier.price + overage * EXCESS_PAX_RATE
    let score = 0

    if (budget >= estimatedTotal) score += 40
    else score -= Math.min(35, Math.round((estimatedTotal - budget) / 1000))

    if (needsEntertainment && pkg.entertainment.length > 0) score += 30
    if (!needsEntertainment && pkg.id === 'budget-basic') score += 24
    if (pkg.id === 'full-blast' && guestCount >= 100) score += 10
    if (pkg.id === 'budget-entertainment' && needsEntertainment && budget < 70000) score += 12

    return { pkg, tier, estimatedTotal, score }
  }).sort((a, b) => b.score - a.score)

  return candidates[0]
}
