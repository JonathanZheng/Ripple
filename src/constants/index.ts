export const RC_OPTIONS = ['Acacia', 'CAPT', 'NUSC', 'RC4', 'RVRC', 'Tembusu', 'UTR'] as const;
export type RC = (typeof RC_OPTIONS)[number];

export const QUEST_TAGS = ['food', 'transport', 'social', 'skills', 'errands'] as const;

export const TAG_COLOURS: Record<string, string> = {
  food:      '#f97316',
  transport: '#3b82f6',
  social:    '#a855f7',
  skills:    '#22c55e',
  errands:   '#eab308',
};

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
    minRating: 4.0,
  },
  champion: {
    label: 'Champion',
    colour: '#fbbf24',
    maxReward: Infinity,
    minQuests: 20,
    minRating: 4.5,
  },
} as const;

export const STRIKE_THRESHOLDS = {
  suspend: 2,
  escalate: 3,
};

export const GRACE_WINDOW_MINUTES = 30;

export const MATRIC_REGEX = /^[AaBb]\d{7}[A-Za-z]$/;
