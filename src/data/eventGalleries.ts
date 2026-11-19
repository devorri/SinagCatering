import { STORAGE_FILES_BASE } from './packages'

const event1 = `${STORAGE_FILES_BASE}/showcase/1.webp`
const event2 = `${STORAGE_FILES_BASE}/showcase/2.webp`
const event3 = `${STORAGE_FILES_BASE}/showcase/3.webp`
const event4 = `${STORAGE_FILES_BASE}/showcase/4.webp`
const event5 = `${STORAGE_FILES_BASE}/showcase/5.webp`
const event6 = `${STORAGE_FILES_BASE}/showcase/6.webp`
const event7 = `${STORAGE_FILES_BASE}/showcase/7.webp`
const event8 = `${STORAGE_FILES_BASE}/showcase/8.webp`
const event9 = `${STORAGE_FILES_BASE}/showcase/9.webp`
const event10 = `${STORAGE_FILES_BASE}/showcase/10.webp`

export interface ShowcasePhoto {
  id: string
  url: string
  title: string
  caption: string
  tag: string
}

export const CATEGORY_SHOWCASE_GALLERY: Record<string, ShowcasePhoto[]> = {
  'Kids Birthday': [
    {
      id: 'kb-1',
      url: event1,
      title: 'Vibrant Balloon Garland & Stage',
      caption: 'Customized thematic stage with lighted numbers, pastel balloon garland, and entrance arch.',
      tag: 'Styling & Backdrop',
    },
    {
      id: 'kb-2',
      url: event2,
      title: 'Candy & Sweets Buffet Corner',
      caption: 'Unlimited sweets station with chocolate fountain, cupcakes, candy jars, and souvenir table.',
      tag: 'Freebies & Inclusions',
    },
    {
      id: 'kb-3',
      url: event3,
      title: 'Themed Birthday Cake & Dessert Spread',
      caption: 'Coordinated cake pedestal with personalized Styro name cutouts and table centerpieces.',
      tag: 'Cake Station',
    },
    {
      id: 'kb-4',
      url: event4,
      title: 'Children Party Fun & Entertainment',
      caption: 'Professional clowns, magicians, bubble show, and interactive parlor games coordination.',
      tag: 'Live Entertainment',
    },
  ],
  'Debut': [
    {
      id: 'deb-1',
      url: event5,
      title: 'Enchanted 18 Roses Stage',
      caption: 'Sophisticated floral stage design with fairy lights, golden candelabras, and grand entrance arch.',
      tag: 'Grand Stage',
    },
    {
      id: 'deb-2',
      url: event6,
      title: 'Dressed Monoblocks & Motif Linens',
      caption: 'Floor-length motif tablecloths with satin chair ribbons and personalized floral centerpieces.',
      tag: 'Banquet Hall',
    },
    {
      id: 'deb-3',
      url: event7,
      title: 'Lights, Sounds & DJ Booth',
      caption: 'Full intelligent beam lights, fog machine, wireless microphones, and acoustic sound system.',
      tag: 'Audio Visuals',
    },
    {
      id: 'deb-4',
      url: event8,
      title: 'Gourmet 4-Course Buffet Spread',
      caption: 'Appetizers, specialty meats, pasta, and refreshing cold drinks managed by uniformed crew.',
      tag: 'Buffet Setup',
    },
  ],
  'Wedding': [
    {
      id: 'wed-1',
      url: event9,
      title: 'Rustic Elegance Presidential Table',
      caption: 'VIP presidential long table arrangement with fresh botanical centerpieces and fine china.',
      tag: 'VIP Dining',
    },
    {
      id: 'wed-2',
      url: event10,
      title: 'Bride & Groom Gazebo Backdrop',
      caption: 'Curated romantic floral archway with soft warm spotlights and romantic drapery.',
      tag: 'Couple Stage',
    },
    {
      id: 'wed-3',
      url: event2,
      title: 'Sinag Signature Carving Station',
      caption: 'Signature roast carving setup with roll-top chafing warmers and attentive food servers.',
      tag: 'Live Carving Station',
    },
    {
      id: 'wed-4',
      url: event3,
      title: 'Celebration Toast & Dessert Bar',
      caption: 'Sparkling wine toast setup, tiered wedding cake table, and artisanal pastry display.',
      tag: 'Dessert Bar',
    },
  ],
  'Others (Please Specify)': [
    {
      id: 'oth-1',
      url: event4,
      title: 'Grand Fiesta Buffet Line',
      caption: 'Commercial-grade roll top food warmers, sanitized dinnerware, and generous food buffers.',
      tag: 'Buffet Line',
    },
    {
      id: 'oth-2',
      url: event5,
      title: 'Corporate & Conference Setup',
      caption: 'Neat corporate conference dining, seminar buffet stations, and professional uniformed crew.',
      tag: 'Corporate & Gatherings',
    },
    {
      id: 'oth-3',
      url: event6,
      title: 'Outdoor Garden & Family Reunion',
      caption: 'All-weather tent table setup with festive motif colors, sound system, and event coordination.',
      tag: 'Family Celebrations',
    },
    {
      id: 'oth-4',
      url: event7,
      title: 'Customized Thematic Styling',
      caption: 'Tailored event styling matching anniversaries, baptisms, thanksgiving, and milestones.',
      tag: 'Custom Themes',
    },
  ],
}
