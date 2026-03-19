/**
 * Feed personalisation ranking — pure TypeScript, no React/Supabase deps.
 * Independently testable with Jest.
 */

import { RC_OPTIONS } from '@/constants';
import type { Quest, QuestTag, TrustTier } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcceptedQuestSummary {
  tag: QuestTag;
  created_at: string;
  location_name: string | null;
}

export type SessionTagBoosts = Record<QuestTag, number>;

export interface RankingContext {
  userRc: string;
  tier: TrustTier;
  skills: string[];
  history: AcceptedQuestSummary[];   // last 50
  sessionBoosts: SessionTagBoosts;
  skippedQuestIds: Set<string>;       // seen 3+ times without tap
  now?: Date;
}

export interface ScoreBreakdown {
  tag_affinity: number;
  urgency: number;
  relevance_or_timefit: number;
  recency: number;
  reward_appeal: number;
  session_multiplier: number;
  skip_damper: number;
  category: QuestCategory;
}

export interface ScoredQuest {
  quest: Quest;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface RankedFeedResult {
  pinned: Quest[];
  ranked: ScoredQuest[];
}

export interface WeightProfile {
  tag_affinity: number;
  urgency: number;
  relevance_boost: number;
  time_fit: number;
  rc_diversity: number;
  recency: number;
  reward_appeal: number;
}

// ---------------------------------------------------------------------------
// Category system
// ---------------------------------------------------------------------------

type QuestCategory = 'transactional' | 'social';

function getCategory(quest: Quest): QuestCategory {
  return ['social', 'skills'].includes(quest.tag) ? 'social' : 'transactional';
}

const WEIGHT_PROFILES: Record<QuestCategory, WeightProfile> = {
  transactional: {
    tag_affinity: 0.15,
    urgency: 0.30,
    relevance_boost: 0.25,
    recency: 0.05,
    reward_appeal: 0.25,
    time_fit: 0,
    rc_diversity: 0,
  },
  social: {
    tag_affinity: 0.25,
    urgency: 0.15,
    relevance_boost: 0,
    recency: 0.15,
    reward_appeal: 0.10,
    time_fit: 0.30,
    rc_diversity: 0.20,
  },
};

// ---------------------------------------------------------------------------
// Skill-match keywords per tag
// ---------------------------------------------------------------------------

const TAG_SKILL_KEYWORDS: Record<QuestTag, string[]> = {
  food:      ['food', 'cook', 'bake', 'barista', 'kitchen'],
  transport: ['driv', 'transport', 'car', 'bike', 'cycling'],
  social:    ['social', 'event', 'organis', 'host', 'facilitat'],
  skills:    ['code', 'tutor', 'teach', 'design', 'debug', 'program', 'repair', 'fix'],
  errands:   ['errand', 'shop', 'deliver', 'pick', 'fetch'],
};

// ---------------------------------------------------------------------------
// Eligibility (shared with QuestCard)
// ---------------------------------------------------------------------------

export function isEligible(quest: Quest, tier: TrustTier): boolean {
  if (quest.tag === 'food' && tier === 'wanderer') return false;
  if (quest.reward_amount > 5 && tier === 'wanderer') return false;
  return true;
}

export function ineligibilityReason(quest: Quest, tier: TrustTier): string | null {
  if (quest.tag === 'food' && tier === 'wanderer') return 'Explorer+ required for food quests';
  if (quest.reward_amount > 5 && tier === 'wanderer') return 'Explorer+ required for rewards > $5';
  return null;
}

// ---------------------------------------------------------------------------
// Session boost helpers
// ---------------------------------------------------------------------------

const ALL_TAGS: QuestTag[] = ['food', 'transport', 'social', 'skills', 'errands'];
const SESSION_BOOST_MAX = 0.45;
const SESSION_BOOST_STEP = 0.15;

export function initialSessionBoosts(): SessionTagBoosts {
  return Object.fromEntries(ALL_TAGS.map(t => [t, 0])) as SessionTagBoosts;
}

export function incrementSessionBoost(
  current: SessionTagBoosts,
  tag: QuestTag,
): SessionTagBoosts {
  return {
    ...current,
    [tag]: Math.min((current[tag] ?? 0) + SESSION_BOOST_STEP, SESSION_BOOST_MAX),
  };
}

// ---------------------------------------------------------------------------
// Tag affinity — time-decayed, Laplace-smoothed
// ---------------------------------------------------------------------------

export function buildTagAffinities(
  history: AcceptedQuestSummary[],
  skills: string[],
  now: Date = new Date(),
): Record<QuestTag, number> {
  if (history.length === 0) {
    // Cold start: uniform 0.20
    return Object.fromEntries(ALL_TAGS.map(t => [t, 0.20])) as Record<QuestTag, number>;
  }

  const tagWeights: Record<QuestTag, number> = Object.fromEntries(
    ALL_TAGS.map(t => [t, 0]),
  ) as Record<QuestTag, number>;

  let totalWeight = 0;

  for (const item of history) {
    const ageDays = (now.getTime() - new Date(item.created_at).getTime()) / 86_400_000;
    const w = Math.pow(2, -ageDays / 30);
    tagWeights[item.tag] += w;
    totalWeight += w;
  }

  const skillsLower = skills.map(s => s.toLowerCase());

  return Object.fromEntries(
    ALL_TAGS.map(tag => {
      const base = (tagWeights[tag] + 1) / (totalWeight + 5);
      const keywords = TAG_SKILL_KEYWORDS[tag];
      const hasSkillMatch = skillsLower.some(s => keywords.some(k => s.includes(k)));
      return [tag, base + (hasSkillMatch ? 0.15 : 0)];
    }),
  ) as Record<QuestTag, number>;
}

// ---------------------------------------------------------------------------
// Individual signal functions
// ---------------------------------------------------------------------------

function computeUrgency(quest: Quest, now: Date): number {
  const hoursLeft = (new Date(quest.deadline).getTime() - now.getTime()) / 3_600_000;
  return Math.exp(-hoursLeft / 24);
}

function computeRelevanceBoost(quest: Quest, userRc: string): number {
  const loc = (quest.location_name ?? '').toLowerCase();
  if (loc === '') return 0.5;
  if (loc.includes(userRc.toLowerCase())) return 1.0;
  const isKnownRc = RC_OPTIONS.some(rc => loc.includes(rc.toLowerCase()));
  return isKnownRc ? 0.3 : 0.4;
}

function computeTimeFit(quest: Quest, now: Date): number {
  const h = (new Date(quest.deadline).getTime() - now.getTime()) / 3_600_000;
  if (h < 1)   return 0.0;
  if (h <= 6)  return 1.0;
  if (h <= 24) return 0.6;
  return 0.3;
}

function computeRcDiversity(
  quest: Quest,
  userRc: string,
  recentHistory: AcceptedQuestSummary[],
): number {
  const lastFive = recentHistory.slice(0, 5);
  const allSameRc = lastFive.every(h => {
    const loc = (h.location_name ?? '').toLowerCase();
    return loc === '' || loc.includes(userRc.toLowerCase());
  });

  const loc = (quest.location_name ?? '').toLowerCase();
  const isCrossRc = RC_OPTIONS.some(
    rc => rc.toLowerCase() !== userRc.toLowerCase() && loc.includes(rc.toLowerCase()),
  );

  if (allSameRc && isCrossRc) return 1.0;
  if (isCrossRc) return 0.4;
  if (loc === '') return 0.5;
  return 0.3;
}

function computeRecency(quest: Quest, now: Date): number {
  const ageHours = (now.getTime() - new Date(quest.created_at).getTime()) / 3_600_000;
  if (ageHours < 2) return 1.0;
  return Math.max(0, 1 - (ageHours - 2) / 46);
}

function computeRewardAppeal(quest: Quest, category: QuestCategory): number {
  if (quest.reward_amount > 0) {
    return Math.min(Math.log(quest.reward_amount + 1) / Math.log(11), 1.0);
  }
  return category === 'social' ? 0.5 : 0;
}

// ---------------------------------------------------------------------------
// Core scoring
// ---------------------------------------------------------------------------

export function scoreQuest(
  quest: Quest,
  context: RankingContext,
  affinities: Record<QuestTag, number>,
): ScoredQuest | null {
  const now = context.now ?? new Date();
  const category = getCategory(quest);
  const weights = WEIGHT_PROFILES[category];

  const tagAffinity = affinities[quest.tag] ?? 0.20;
  const urgency = computeUrgency(quest, now);
  const relevanceOrTimeFit = category === 'social'
    ? computeTimeFit(quest, now)
    : computeRelevanceBoost(quest, context.userRc);
  const rcDiversity = category === 'social'
    ? computeRcDiversity(quest, context.userRc, context.history)
    : 0;
  const recency = computeRecency(quest, now);
  const rewardAppeal = computeRewardAppeal(quest, category);

  const baseScore =
    weights.tag_affinity   * tagAffinity +
    weights.urgency        * urgency +
    (category === 'social'
      ? weights.time_fit     * relevanceOrTimeFit + weights.rc_diversity * rcDiversity
      : weights.relevance_boost * relevanceOrTimeFit) +
    weights.recency        * recency +
    weights.reward_appeal  * rewardAppeal;

  const sessionBoost = context.sessionBoosts[quest.tag] ?? 0;
  const sessionMultiplier = 1 + sessionBoost;
  const skipDamper = context.skippedQuestIds.has(quest.id) ? -0.15 : 0;

  const score = baseScore * sessionMultiplier + skipDamper;

  return {
    quest,
    score,
    breakdown: {
      tag_affinity: tagAffinity,
      urgency,
      relevance_or_timefit: relevanceOrTimeFit,
      recency,
      reward_appeal: rewardAppeal,
      session_multiplier: sessionMultiplier,
      skip_damper: skipDamper,
      category,
    },
  };
}

// ---------------------------------------------------------------------------
// Feed ranking entry point
// ---------------------------------------------------------------------------

export function rankFeed(quests: Quest[], context: RankingContext): RankedFeedResult {
  const now = context.now ?? new Date();

  // Separate flash quests (pinned) from regular quests
  const pinned: Quest[] = [];
  const toScore: Quest[] = [];

  for (const q of quests) {
    if (q.is_flash && q.flash_expires_at && new Date(q.flash_expires_at) > now) {
      pinned.push(q);
    } else {
      toScore.push(q);
    }
  }

  // Sort pinned flash quests: soonest expiry first
  pinned.sort((a, b) =>
    new Date(a.flash_expires_at!).getTime() - new Date(b.flash_expires_at!).getTime(),
  );

  // Build tag affinities once
  const affinities = buildTagAffinities(context.history, context.skills, now);

  // Score and sort regular quests
  const scored = toScore
    .map(q => scoreQuest(q, context, affinities))
    .filter((s): s is ScoredQuest => s !== null)
    .sort((a, b) => b.score - a.score);

  return { pinned, ranked: scored };
}
 