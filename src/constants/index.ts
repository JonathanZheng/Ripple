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
