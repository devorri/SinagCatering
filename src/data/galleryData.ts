const rawAssets = import.meta.glob('../../gallery/**/*.jpg', { eager: true, import: 'default', query: '?url' }) as Record<string, string>

export function getGalleryAssetUrl(path: string): string {
  const normalized = `../../gallery/${path.replace(/^\/+/, '')}`
  return rawAssets[normalized] || ''
}

export interface GalleryItem {
  id: string
  path: string
  url: string
  title: string
  category: 'Weddings' | 'Birthdays' | 'Debuts' | 'Christening' | 'Buffet & Food' | 'Styling & Setups' | 'Special Events'
  description: string
}

export const ALL_GALLERY_ITEMS: GalleryItem[] = [
  // Weddings
  {
    id: 'wed-1',
    path: 'weddings/wedding_jane_1.jpg',
    url: getGalleryAssetUrl('weddings/wedding_jane_1.jpg'),
    title: 'Wedding Reception Banquet',
    category: 'Weddings',
    description: 'Bespoke couples banquet setup with warm ambient styling and guest dining.',
  },
  {
    id: 'wed-2',
    path: 'weddings/wedding_floral_red_white_anthony_1.jpg',
    url: getGalleryAssetUrl('weddings/wedding_floral_red_white_anthony_1.jpg'),
    title: 'Red & White Floral Ceremony Feast',
    category: 'Weddings',
    description: 'Floral motifs and white linen banquet tables.',
  },
  {
    id: 'wed-3',
    path: 'weddings/wedding_white_floral_jj_1.jpg',
    url: getGalleryAssetUrl('weddings/wedding_white_floral_jj_1.jpg'),
    title: 'White Floral Grand Banquet',
    category: 'Weddings',
    description: 'Lush floral runner and polished tableware setup.',
  },
  {
    id: 'wed-4',
    path: 'weddings/wedding_maria_1.jpg',
    url: getGalleryAssetUrl('weddings/wedding_maria_1.jpg'),
    title: 'Garden Reception Dining',
    category: 'Weddings',
    description: 'Garden styling with customized head table and curated guest dining.',
  },
  {
    id: 'wed-5',
    path: 'weddings/wedding_jane_2.jpg',
    url: getGalleryAssetUrl('weddings/wedding_jane_2.jpg'),
    title: 'Floral Canopy Dining Detail',
    category: 'Weddings',
    description: 'Floral accents and roll-top chafing warmers presentation.',
  },

  // Birthdays
  {
    id: 'bday-1',
    path: 'birthdays/birthday_carnival_luna_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_carnival_luna_1.jpg'),
    title: 'Carnival Birthday Celebration',
    category: 'Birthdays',
    description: 'Thematic circus stage backdrop, balloon arch, and party dining setup.',
  },
  {
    id: 'bday-2',
    path: 'birthdays/birthday_disney_moana_rayzie_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_disney_moana_rayzie_1.jpg'),
    title: 'Moana Themed Kids Party',
    category: 'Birthdays',
    description: 'Island backdrop with thematic decorations and full buffet line.',
  },
  {
    id: 'bday-3',
    path: 'birthdays/birthday_safari_khalil_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_safari_khalil_1.jpg'),
    title: 'Safari Expedition Birthday',
    category: 'Birthdays',
    description: 'Animal safari backdrop with balloon installations and table styling.',
  },
  {
    id: 'bday-4',
    path: 'birthdays/birthday_roblox_stefan_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_roblox_stefan_1.jpg'),
    title: 'Roblox Themed Birthday',
    category: 'Birthdays',
    description: 'Gamer backdrop graphics, props, and celebratory dining arrangement.',
  },
  {
    id: 'bday-5',
    path: 'birthdays/birthday_sanrio_purple_zeeiea_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_sanrio_purple_zeeiea_1.jpg'),
    title: 'Lavender Character Birthday',
    category: 'Birthdays',
    description: 'Pastel purple accents, character cutouts, and festive setup.',
  },
  {
    id: 'bday-6',
    path: 'birthdays/birthday_tinkerbell_mikhail_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_tinkerbell_mikhail_1.jpg'),
    title: 'Fairytale Woodland Party',
    category: 'Birthdays',
    description: 'Thematic photo wall and guest seating arrangement.',
  },
  {
    id: 'bday-7',
    path: 'birthdays/birthday_sesame_street_aion_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_sesame_street_aion_1.jpg'),
    title: 'Primary Colors Birthday Fiesta',
    category: 'Birthdays',
    description: 'Playful primary colors and lively character stage layout.',
  },
  {
    id: 'bday-8',
    path: 'birthdays/birthday_yellow_brown_bear_ross_1.jpg',
    url: getGalleryAssetUrl('birthdays/birthday_yellow_brown_bear_ross_1.jpg'),
    title: 'Teddy Bear 1st Birthday',
    category: 'Birthdays',
    description: 'Warm earth tones, plush bear props, and ambient lighting.',
  },

  // Debuts
  {
    id: 'debut-1',
    path: 'debuts/debut_pink_floral_maica_1.jpg',
    url: getGalleryAssetUrl('debuts/debut_pink_floral_maica_1.jpg'),
    title: 'Pink Floral 18th Debut',
    category: 'Debuts',
    description: 'Blush pink floral tunnel and light accents for debut celebration.',
  },
  {
    id: 'debut-2',
    path: 'debuts/debut_purple_pink_violet_butterfly_amber_1.jpg',
    url: getGalleryAssetUrl('debuts/debut_purple_pink_violet_butterfly_amber_1.jpg'),
    title: 'Butterfly Debut Banquet',
    category: 'Debuts',
    description: 'Violet-pink luminescence, butterfly arches, and cotillion dining setup.',
  },
  {
    id: 'debut-3',
    path: 'debuts/debut_pink_violet_floral_gen_1.jpg',
    url: getGalleryAssetUrl('debuts/debut_pink_violet_floral_gen_1.jpg'),
    title: 'Garden 18th Debut Feast',
    category: 'Debuts',
    description: 'Tiered floral arrangements, ceremonial table, and tableware setup.',
  },

  // Christening
  {
    id: 'chris-1',
    path: 'christening/christening_blue_bear_cassian_1.jpg',
    url: getGalleryAssetUrl('christening/christening_blue_bear_cassian_1.jpg'),
    title: 'Blue Bear Dedication Banquet',
    category: 'Christening',
    description: 'Baby blue and cream balloon arches for baptism celebration.',
  },
  {
    id: 'chris-2',
    path: 'christening/christening_pink_white_alxee_1.jpg',
    url: getGalleryAssetUrl('christening/christening_pink_white_alxee_1.jpg'),
    title: 'Soft Pink Christening Reception',
    category: 'Christening',
    description: 'Floral runners and family dining arrangements.',
  },
  {
    id: 'chris-3',
    path: 'christening/christening_blue_white_balloon_1.jpg',
    url: getGalleryAssetUrl('christening/christening_blue_white_balloon_1.jpg'),
    title: 'Sky Blue Blessing Banquet',
    category: 'Christening',
    description: 'Balloon pillars and white buffet linens for relatives and godparents.',
  },

  // Buffet & Food
  {
    id: 'food-1',
    path: 'food/food_caldereta.jpg',
    url: getGalleryAssetUrl('food/food_caldereta.jpg'),
    title: 'Signature Beef Caldereta',
    category: 'Buffet & Food',
    description: 'Slow-simmered tender beef with rich bell pepper sauce, olives, and cheese.',
  },
  {
    id: 'food-2',
    path: 'food/food_cordon_bleu.jpg',
    url: getGalleryAssetUrl('food/food_cordon_bleu.jpg'),
    title: 'Chicken Cordon Bleu',
    category: 'Buffet & Food',
    description: 'Golden crumbed chicken breast rolled with savory ham and molten cheese.',
  },
  {
    id: 'food-3',
    path: 'food/food_beef_broccoli.jpg',
    url: getGalleryAssetUrl('food/food_beef_broccoli.jpg'),
    title: 'Tender Beef with Broccoli',
    category: 'Buffet & Food',
    description: 'Sliced beef glazed in oriental garlic soy reduction with fresh broccoli.',
  },
  {
    id: 'food-4',
    path: 'food/food_carbonara.jpg',
    url: getGalleryAssetUrl('food/food_carbonara.jpg'),
    title: 'Creamy Bacon Carbonara',
    category: 'Buffet & Food',
    description: 'Pasta tossed in rich garlic cream, crispy smoked bacon, and parmesan.',
  },
  {
    id: 'food-5',
    path: 'food/food_fish_fillet.jpg',
    url: getGalleryAssetUrl('food/food_fish_fillet.jpg'),
    title: 'Fish Fillet with Tartar Dip',
    category: 'Buffet & Food',
    description: 'Crisp breaded dory fillets served hot with house tartar cream.',
  },
  {
    id: 'food-6',
    path: 'food/food_mixed_veggies_quail_egg.jpg',
    url: getGalleryAssetUrl('food/food_mixed_veggies_quail_egg.jpg'),
    title: 'Buttered Vegetables with Quail Eggs',
    category: 'Buffet & Food',
    description: 'Medley of carrots, baby corn, florets, and hard-boiled quail eggs.',
  },
  {
    id: 'food-7',
    path: 'food/food_dessert_sweet.jpg',
    url: getGalleryAssetUrl('food/food_dessert_sweet.jpg'),
    title: 'Dessert Buffet Spread',
    category: 'Buffet & Food',
    description: 'Assorted sweet cups, bite-sized pastries, and chilled dessert shooters.',
  },

  // Styling & Setups
  {
    id: 'setup-1',
    path: 'setup_styles(optional)/pastel_floral_setup.jpg',
    url: getGalleryAssetUrl('setup_styles(optional)/pastel_floral_setup.jpg'),
    title: 'Pastel Floral Setup',
    category: 'Styling & Setups',
    description: 'Soft pastel drape framing with ambient floral accents.',
  },
  {
    id: 'setup-2',
    path: 'setup_styles(optional)/pink_purple_balloon_setup.jpg',
    url: getGalleryAssetUrl('setup_styles(optional)/pink_purple_balloon_setup.jpg'),
    title: 'Magenta & Lilac Balloon Setup',
    category: 'Styling & Setups',
    description: 'Organic balloon garland framing the celebrant stage.',
  },
  {
    id: 'setup-3',
    path: 'setup_styles(optional)/red_white_floral_setup.jpg',
    url: getGalleryAssetUrl('setup_styles(optional)/red_white_floral_setup.jpg'),
    title: 'Crimson & Ivory Setup',
    category: 'Styling & Setups',
    description: 'Deep red velour backdrop accented by white blossoms.',
  },
  {
    id: 'setup-4',
    path: 'setup_styles(optional)/white_brown_floral_setup.jpg',
    url: getGalleryAssetUrl('setup_styles(optional)/white_brown_floral_setup.jpg'),
    title: 'Earth-Tone Floral Setup',
    category: 'Styling & Setups',
    description: 'Dried florals, warm runners, and wicker textures.',
  },

  // Special Events
  {
    id: 'spec-1',
    path: 'special/special_red_white_company_citi_1.jpg',
    url: getGalleryAssetUrl('special/special_red_white_company_citi_1.jpg'),
    title: 'Corporate Celebration Buffet',
    category: 'Special Events',
    description: 'Corporate buffet setup with double food lines.',
  },
  {
    id: 'spec-2',
    path: 'special/special_thanksgiving_1.jpg',
    url: getGalleryAssetUrl('special/special_thanksgiving_1.jpg'),
    title: 'Thanksgiving Gathering Banquet',
    category: 'Special Events',
    description: 'Family gathering styling with complete dining tables and linen.',
  },
]

export interface ClientReactionScreenshot {
  id: string
  path: string
  url: string
  title: string
}

// 9 authentic client reaction screenshots from gallery/reaction_screenshots/
export const CLIENT_REACTION_SCREENSHOTS: ClientReactionScreenshot[] = Array.from(
  { length: 9 },
  (_, index) => ({
    id: `reax-${index + 1}`,
    path: `reaction_screenshots/user_reax_${index + 1}.jpg`,
    url: getGalleryAssetUrl(`reaction_screenshots/user_reax_${index + 1}.jpg`),
    title: `Client Reaction ${index + 1}`,
  })
)
