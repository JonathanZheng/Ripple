export const RC_OPTIONS = ['Acacia', 'CAPT', 'NUSC', 'RC4', 'RVRC', 'Tembusu', 'UTR'] as const;
export type RC = (typeof RC_OPTIONS)[number];

export const QUEST_TAGS = ['food', 'transport', 'social', 'skills', 'errands'] as const;

export const TAG_COLOURS: Record<string, string> = {
  food:      '#f97316',
  transport: '#3b82f6',
  social:    '#d946ef',
  skills:    '#10b981',
  errands:   '#f59e0b',
};

export const QUEST_TYPES = ['standard', 'social', 'crew'] as const;

export const REPORT_TYPES = ['inappropriate_content', 'harassment', 'dispute', 'other'] as const;

export const TRUST_TIER_CONFIG = {
  wanderer: {
    label: 'Wanderer',
    colour: '#94a3b8',
    maxReward: 5,
  },
  explorer: {
    label: 'Explorer',
    colour: '#60a5fa',
    maxReward: Infinity,
    minQuests: 5,
    minScore: 7.0,
  },
  champion: {
    label: 'Champion',
    colour: '#fbbf24',
    maxReward: Infinity,
    minQuests: 20,
    minScore: 8.5,
  },
} as const;

export const STRIKE_THRESHOLDS = {
  suspend: 2,
  escalate: 3,
};

export const GRACE_WINDOW_MINUTES = 30;

/** NUS email domain validation — used for hackathon auth gating */
export const NUS_EMAIL_REGEX = /@u\.nus\.edu$/i;

/** Matric number format — reserved for post-launch Student Pass validation */
export const MATRIC_REGEX = /^[AaBb]\d{7}[A-Za-z]$/;

export const ROUTE_OFFER_DURATIONS = [
  { label: '1 hour',   hours: 1 },
  { label: '2 hours',  hours: 2 },
  { label: '4 hours',  hours: 4 },
] as const;

export const ROUTE_OFFER_RADIUS_DEG = 0.003;

export type NusLocationCategory = 'utown' | 'rc' | 'hall' | 'school' | 'canteen' | 'library' | 'mrt';

export const NUS_LOCATION_CATEGORY_LABELS: Record<NusLocationCategory, string> = {
  utown:   'UTown',
  rc:      'Residential Colleges',
  hall:    'Halls',
  school:  'Schools & Faculties',
  canteen: 'Canteens',
  library: 'Libraries',
  mrt:     'MRT',
};

/** Comprehensive NUS location list for route-offer destination picking */
export const NUS_LOCATIONS: {
  name: string; latitude: number; longitude: number; category: NusLocationCategory;
}[] = [
  // ── UTown ─────────────────────────────────────────────────────────
  // ERC confirmed at 1.306016, 103.773181 (8 College Ave West)
  { name: 'ERC',                  latitude: 1.30602, longitude: 103.77318, category: 'utown'  },
  { name: 'The Deck',             latitude: 1.30640, longitude: 103.77360, category: 'utown'  },
  { name: 'Fine Food',            latitude: 1.30590, longitude: 103.77330, category: 'utown'  },
  { name: 'UTown Green',          latitude: 1.30540, longitude: 103.77320, category: 'utown'  },
  { name: 'Stephen Riady Centre', latitude: 1.30470, longitude: 103.77300, category: 'utown'  },
  { name: 'Frontier',             latitude: 1.30500, longitude: 103.77190, category: 'utown'  },
  { name: 'UTown Swimming Pool',  latitude: 1.30680, longitude: 103.77500, category: 'utown'  },
  { name: 'UCC',                  latitude: 1.30440, longitude: 103.77060, category: 'utown'  },
  { name: 'CREATE Tower',         latitude: 1.30840, longitude: 103.77440, category: 'utown'  },
  // ── Residential Colleges (UTown) ──────────────────────────────────
  { name: 'Tembusu',              latitude: 1.30730, longitude: 103.77590, category: 'rc'     },
  { name: 'RC4',                  latitude: 1.30620, longitude: 103.77550, category: 'rc'     },
  { name: 'UTR',                  latitude: 1.30550, longitude: 103.77460, category: 'rc'     },
  { name: 'CAPT',                 latitude: 1.30520, longitude: 103.77210, category: 'rc'     },
  { name: 'NUSC',                 latitude: 1.30430, longitude: 103.77240, category: 'rc'     },
  { name: 'Acacia',               latitude: 1.30460, longitude: 103.77270, category: 'rc'     },
  { name: 'RVRC',                 latitude: 1.30290, longitude: 103.77140, category: 'rc'     },
  // ── Traditional Halls ─────────────────────────────────────────────
  { name: 'Eusoff Hall',          latitude: 1.29300, longitude: 103.77120, category: 'hall'   },
  { name: 'Kent Ridge Hall',      latitude: 1.29180, longitude: 103.77260, category: 'hall'   },
  { name: 'KE7 Hall',             latitude: 1.29070, longitude: 103.77480, category: 'hall'   },
  { name: 'Raffles Hall',         latitude: 1.29440, longitude: 103.76950, category: 'hall'   },
  { name: 'Sheares Hall',         latitude: 1.29520, longitude: 103.77100, category: 'hall'   },
  { name: 'Temasek Hall',         latitude: 1.29400, longitude: 103.77180, category: 'hall'   },
  { name: 'Pioneer House',        latitude: 1.29660, longitude: 103.77140, category: 'hall'   },
  // ── Schools & Faculties ───────────────────────────────────────────
  { name: 'School of Computing',  latitude: 1.29450, longitude: 103.77440, category: 'school' },
  { name: 'Engineering (E1)',     latitude: 1.29970, longitude: 103.77190, category: 'school' },
  { name: 'Business School',      latitude: 1.29210, longitude: 103.77380, category: 'school' },
  { name: 'FASS',                 latitude: 1.29670, longitude: 103.77830, category: 'school' },
  { name: 'Faculty of Science',   latitude: 1.29730, longitude: 103.78030, category: 'school' },
  { name: 'Faculty of Law',       latitude: 1.29600, longitude: 103.77420, category: 'school' },
  { name: 'NUS Medicine',         latitude: 1.29930, longitude: 103.78390, category: 'school' },
  { name: 'Yong Siew Toh',        latitude: 1.30270, longitude: 103.77740, category: 'school' },
  // ── Libraries ─────────────────────────────────────────────────────
  { name: 'Central Library',      latitude: 1.29660, longitude: 103.77380, category: 'library'},
  { name: 'Science Library',      latitude: 1.29710, longitude: 103.78000, category: 'library'},
  // ── Canteens (non-UTown) ──────────────────────────────────────────
  { name: 'Techno Edge',          latitude: 1.29970, longitude: 103.77250, category: 'canteen'},
  { name: 'PGP Canteen',          latitude: 1.28850, longitude: 103.78300, category: 'canteen'},
  { name: 'University Hall Cafe', latitude: 1.29790, longitude: 103.77420, category: 'canteen'},
  // ── MRT ───────────────────────────────────────────────────────────
  { name: 'Kent Ridge MRT',       latitude: 1.29340, longitude: 103.78450, category: 'mrt'    },
  { name: 'Buona Vista MRT',      latitude: 1.30720, longitude: 103.79020, category: 'mrt'    },
  { name: 'One-North MRT',        latitude: 1.29940, longitude: 103.78700, category: 'mrt'    },
];

/** @deprecated use NUS_LOCATIONS */
export const RC_LOCATIONS = NUS_LOCATIONS;
