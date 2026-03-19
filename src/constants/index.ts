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
  { name: 'ERC',                  latitude: 1.3060136295957412,  longitude: 103.77301935811315, category: 'utown'  },
  { name: 'UTown Green',          latitude: 1.3049253618886427,  longitude: 103.77322797969887, category: 'utown'  },
  { name: 'Stephen Riady Centre', latitude: 1.30459929106336,    longitude: 103.77256168273163, category: 'utown'  },
  { name: 'Museum',               latitude: 1.3014933686067802,  longitude: 103.7726506112922,  category: 'utown'  },
  // ── Residential Colleges ──────────────────────────────────────────
  { name: 'RC4',                  latitude: 1.3082453979577846,  longitude: 103.7733206700349,  category: 'rc'     },
  { name: 'CAPT',                 latitude: 1.307607447581024,   longitude: 103.77316893843944, category: 'rc'     },
  { name: 'NUSC',                 latitude: 1.3069702092632962,  longitude: 103.77219386406821, category: 'rc'     },
  { name: 'Acacia',               latitude: 1.306518908145221,   longitude: 103.77357527294434, category: 'rc'     },
  { name: 'Tembusu',              latitude: 1.3061736645254545,  longitude: 103.77373896308168, category: 'rc'     },
  { name: 'UTR',                  latitude: 1.305225919227115,   longitude: 103.7738540870451,  category: 'rc'     },
  { name: 'RVRC',                 latitude: 1.2982819337773237,  longitude: 103.77616998752652, category: 'rc'     },
  // ── Schools & Faculties ───────────────────────────────────────────
  { name: 'COM1',                 latitude: 1.2952698171244235,  longitude: 103.77376374560006, category: 'school' },
  { name: 'COM2',                 latitude: 1.2943221598265362,  longitude: 103.77410422667296, category: 'school' },
  { name: 'COM3',                 latitude: 1.2947554941432207,  longitude: 103.77457721923915, category: 'school' },
  { name: 'COM4',                 latitude: 1.2951950237210383,  longitude: 103.77535010560399, category: 'school' },
  { name: 'BIZ1',                 latitude: 1.2925203860050407,  longitude: 103.77421532880022, category: 'school' },
  { name: 'BIZ2',                 latitude: 1.2934763123888395,  longitude: 103.77484561742904, category: 'school' },
  { name: 'CDE',                  latitude: 1.300239451418313,   longitude: 103.77073908947732, category: 'school' },
  { name: 'SDE1',                 latitude: 1.2973913891161941,  longitude: 103.77070888477806, category: 'school' },
  { name: 'SDE2',                 latitude: 1.2972436580729054,  longitude: 103.77112756335806, category: 'school' },
  { name: 'SDE3',                 latitude: 1.2979937074264514,  longitude: 103.77056650479439, category: 'school' },
  { name: 'UHC',                  latitude: 1.2991533614820672,  longitude: 103.7764023000722,  category: 'school' },
  // ── Libraries ─────────────────────────────────────────────────────
  { name: 'CLB',                  latitude: 1.2965530579840352,  longitude: 103.77314126100468, category: 'library'},
  { name: 'Science Library',      latitude: 1.295290971137511,   longitude: 103.78013661634915, category: 'library'},
  // ── Canteens ──────────────────────────────────────────────────────
  { name: 'Fine Food',            latitude: 1.30403164373206,    longitude: 103.7735390757347,  category: 'canteen'},
  { name: 'Terrace',              latitude: 1.2944109068333554,  longitude: 103.7743376739626,  category: 'canteen'},
  { name: 'The Deck',             latitude: 1.2946256535165233,  longitude: 103.77251108733743, category: 'canteen'},
  { name: 'Frontier',             latitude: 1.296427796073056,   longitude: 103.78038808090906, category: 'canteen'},
  { name: 'Techno Edge',          latitude: 1.2978742247087567,  longitude: 103.77165010377246, category: 'canteen'},
  { name: 'YIH',                  latitude: 1.2985329271203339,  longitude: 103.77487117117593, category: 'canteen'},
  { name: 'PGP Canteen',          latitude: 1.2908138905598319,  longitude: 103.78219203197649, category: 'canteen'},
  // ── MRT ───────────────────────────────────────────────────────────
  { name: 'Kent Ridge MRT',       latitude: 1.2934182506890044,  longitude: 103.78427109388855, category: 'mrt'    },
  { name: 'Clementi MRT',         latitude: 1.315502283586278,   longitude: 103.76505589361521, category: 'mrt'    },
  { name: 'Buona Vista MRT',      latitude: 1.3071774989285267,  longitude: 103.79055228819564, category: 'mrt'    },
];

/** @deprecated use NUS_LOCATIONS */
export const RC_LOCATIONS = NUS_LOCATIONS;
