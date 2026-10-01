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
      url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&auto=format&fit=crop&q=80',
      title: 'Vibrant Balloon Garland & Stage',
      caption: 'Customized thematic stage with lighted numbers, pastel balloon garland, and entrance arch.',
      tag: 'Styling & Backdrop',
    },
    {
      id: 'kb-2',
      url: 'https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=800&auto=format&fit=crop&q=80',
      title: 'Candy & Sweets Buffet Corner',
      caption: 'Unlimited sweets station with chocolate fountain, cupcakes, candy jars, and souvenir table.',
      tag: 'Freebies & Inclusions',
    },
    {
      id: 'kb-3',
      url: 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&auto=format&fit=crop&q=80',
      title: 'Themed Birthday Cake & Dessert Spread',
      caption: 'Coordinated cake pedestal with personalized Styro name cutouts and table centerpieces.',
      tag: 'Cake Station',
    },
    {
      id: 'kb-4',
      url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
      title: 'Children Party Fun & Entertainment',
      caption: 'Professional clowns, magicians, bubble show, and interactive parlor games coordination.',
      tag: 'Live Entertainment',
    },
  ],
  'Debut': [
    {
      id: 'deb-1',
      url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80',
      title: 'Enchanted 18 Roses Stage',
      caption: 'Sophisticated floral stage design with fairy lights, golden candelabras, and grand entrance arch.',
      tag: 'Grand Stage',
    },
    {
      id: 'deb-2',
      url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
      title: 'Dressed Monoblocks & Motif Linens',
      caption: 'Floor-length motif tablecloths with satin chair ribbons and personalized floral centerpieces.',
      tag: 'Banquet Hall',
    },
    {
      id: 'deb-3',
      url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
      title: 'Lights, Sounds & DJ Booth',
      caption: 'Full intelligent beam lights, fog machine, wireless microphones, and acoustic sound system.',
      tag: 'Audio Visuals',
    },
    {
      id: 'deb-4',
      url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop&q=80',
      title: 'Gourmet 4-Course Buffet Spread',
      caption: 'Appetizers, specialty meats, pasta, and refreshing cold drinks managed by uniformed crew.',
      tag: 'Buffet Setup',
    },
  ],
  'Wedding': [
    {
      id: 'wed-1',
      url: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&auto=format&fit=crop&q=80',
      title: 'Rustic Elegance Presidential Table',
      caption: 'VIP presidential long table arrangement with fresh botanical centerpieces and fine china.',
      tag: 'VIP Dining',
    },
    {
      id: 'wed-2',
      url: 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?w=800&auto=format&fit=crop&q=80',
      title: 'Bride & Groom Gazebo Backdrop',
      caption: 'Curated romantic floral archway with soft warm spotlights and romantic drapery.',
      tag: 'Couple Stage',
    },
    {
      id: 'wed-3',
      url: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&fit=crop&q=80',
      title: 'Sinag Signature Carving Station',
      caption: 'Signature roast carving setup with roll-top chafing warmers and attentive food servers.',
      tag: 'Live Carving Station',
    },
    {
      id: 'wed-4',
      url: 'https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=800&auto=format&fit=crop&q=80',
      title: 'Celebration Toast & Dessert Bar',
      caption: 'Sparkling wine toast setup, tiered wedding cake table, and artisanal pastry display.',
      tag: 'Dessert Bar',
    },
  ],
  'Others (Please Specify)': [
    {
      id: 'oth-1',
      url: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&fit=crop&q=80',
      title: 'Grand Fiesta Buffet Line',
      caption: 'Commercial-grade roll top food warmers, sanitized dinnerware, and generous food buffers.',
      tag: 'Buffet Line',
    },
    {
      id: 'oth-2',
      url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
      title: 'Corporate & Conference Setup',
      caption: 'Neat corporate conference dining, seminar buffet stations, and professional uniformed crew.',
      tag: 'Corporate & Gatherings',
    },
    {
      id: 'oth-3',
      url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&auto=format&fit=crop&q=80',
      title: 'Outdoor Garden & Family Reunion',
      caption: 'All-weather tent table setup with festive motif colors, sound system, and event coordination.',
      tag: 'Family Celebrations',
    },
    {
      id: 'oth-4',
      url: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&auto=format&fit=crop&q=80',
      title: 'Customized Thematic Styling',
      caption: 'Tailored event styling matching anniversaries, baptisms, thanksgiving, and milestones.',
      tag: 'Custom Themes',
    },
  ],
}
