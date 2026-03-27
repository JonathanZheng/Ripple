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
  fulfilment_mode: 'meetup' | 'dropoff' | null;
  reward_amount: number | null;
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
  rc_diversity_signal: number;
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

export interface PrecomputedSignals {
  rcPreference: number;                          // [-1, +1]
  fulfilmentPref: number;                        // [-1, +1]
  rewardBracket: { center: number; width: number };
  momentumTag: QuestTag | null;
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
    tag_affinity:    0.15,
    urgency:         0.25,  // was 0.30 — 0.05 reallocated to rc_diversity
    relevance_boost: 0.25,
    recency:         0.05,
    reward_appeal:   0.20,  // was 0.25 — 0.05 reallocated to rc_diversity
    time_fit:        0,
    rc_diversity:    0.10,  // NEW — bidirectional RC preference signal
  },
  social: {
    tag_affinity:    0.25,
    urgency:         0.15,
    relevance_boost: 0,
    recency:         0.15,
    reward_appeal:   0.10,
    time_fit:        0.30,
    rc_diversity:    0.20,  // unchanged weight, now bidirectional
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
// RC preference — learned bidirectionally from acceptance history
// ---------------------------------------------------------------------------

/**
 * Returns a score in [-1, +1]:
 *   +1 = user consistently accepts quests in other RCs (cross-RC leaning)
 *   -1 = user consistently accepts quests in their own RC (same-RC leaning)
 *    0 = cold start, balanced, or insufficient data
 *
 * Uses a 14-day recency half-life so recent behaviour dominates over stale history.
 * Neutral locations (canteens, MRTs, etc.) don't contribute to either side.
 */
export function computeRcPreference(
  history: AcceptedQuestSummary[],
  userRc: string,
  now: Date,
): number {
  const userRcLower = userRc.toLowerCase();

  const usable = history
    .filter(h => h.location_name && h.location_name.trim() !== '')
    .slice(0, 15);

  if (usable.length < 3) return 0;

  let crossWeight = 0;
  let sameWeight = 0;

  for (const item of usable) {
    const loc = item.location_name!.toLowerCase();
    const ageDays = (now.getTime() - new Date(item.created_at).getTime()) / 86_400_000;
    const w = Math.pow(2, -ageDays / 14);

    const isCrossRc = RC_OPTIONS.some(
      rc => rc.toLowerCase() !== userRcLower && loc.includes(rc.toLowerCase()),
    );
    const isSameRc = !isCrossRc && loc.includes(userRcLower);

    if (isCrossRc) crossWeight += w;
    else if (isSameRc) sameWeight += w;
    // neutral locations (canteen, MRT, etc.) intentionally skipped
  }

  const total = crossWeight + sameWeight;
  if (total === 0) return 0;
  return (crossWeight - sameWeight) / total;
}

/**
 * Per-quest RC signal based on the user's learned preference.
 *
 * Replaces the old binary computeRcDiversity. Now bidirectional and applies to
 * all quest categories (transactional included), not just social.
 *
 * Cross-RC quest range: [0.30, 1.00] — peaks when user is a cross-RC explorer
 * Same-RC quest range:  [0.00, 0.70] — peaks when user prefers staying local
 * Neutral location:      0.50
 */
function computeAdaptiveRcSignal(
  quest: Quest,
  userRc: string,
  rcPreference: number,
): number {
  const loc = (quest.location_name ?? '').toLowerCase();
  if (loc === '') return 0.5;

  const userRcLower = userRc.toLowerCase();
  const isCrossRc = RC_OPTIONS.some(
    rc => rc.toLowerCase() !== userRcLower && loc.includes(rc.toLowerCase()),
  );
  const isSameRc = !isCrossRc && loc.includes(userRcLower);

  if (!isCrossRc && !isSameRc) return 0.5; // neutral location — no RC signal

  // Map [-1, +1] → [0, 1]: 0 = strongly same-RC, 1 = strongly cross-RC
  const pref01 = (rcPreference + 1) / 2;

  if (isCrossRc) {
    return 0.30 + 0.70 * pref01;  // [0.30, 1.00]
  } else {
    return 0.70 - 0.70 * pref01;  // [0.00, 0.70]
  }
}

// ---------------------------------------------------------------------------
// Additional personalisation signals
// ---------------------------------------------------------------------------

/**
 * Learns whether the user prefers dropoff or meetup quests.
 * Returns [-1, +1]: positive = dropoff preference, negative = meetup preference.
 * Cold start (< 3 entries with a mode): returns 0.
 */
export function computeFulfilmentPreference(
  history: AcceptedQuestSummary[],
  now: Date,
): number {
  const usable = history.filter(h => h.fulfilment_mode != null).slice(0, 20);
  if (usable.length < 3) return 0;

  let dropoffWeight = 0;
  let meetupWeight = 0;

  for (const item of usable) {
    const ageDays = (now.getTime() - new Date(item.created_at).getTime()) / 86_400_000;
    const w = Math.pow(2, -ageDays / 14);
    if (item.fulfilment_mode === 'dropoff') dropoffWeight += w;
    else meetupWeight += w;
  }

  const total = dropoffWeight + meetupWeight;
  if (total === 0) return 0;
  return (dropoffWeight - meetupWeight) / total;
}

/**
 * Learns the reward bracket the user typically accepts.
 * Cold start: { center: 3, width: 5 } — broad range centred at $3.
 */
export function computeRewardBracketPreference(
  history: AcceptedQuestSummary[],
): { center: number; width: number } {
  const paid = history
    .filter(h => h.reward_amount != null && h.reward_amount > 0)
    .slice(0, 20)
    .map(h => h.reward_amount as number);

  if (paid.length < 3) return { center: 3, width: 5 };

  const mean = paid.reduce((a, b) => a + b, 0) / paid.length;
  const variance = paid.reduce((a, b) => a + (b - mean) ** 2, 0) / paid.length;
  const std = Math.sqrt(variance);

  return { center: mean, width: Math.max(std, 1) }; // minimum width of $1
}

/**
 * Returns the shared tag if the last 3 accepted quests all share the same one.
 * Creates a short-term "momentum" burst for that tag (+0.08 per quest).
 */
export function computeTagMomentum(history: AcceptedQuestSummary[]): QuestTag | null {
  const recent = history.slice(0, 3);
  if (recent.length < 3) return null;
  const firstTag = recent[0].tag;
  return recent.every(h => h.tag === firstTag) ? firstTag : null;
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
  precomputed: PrecomputedSignals,
): ScoredQuest | null {
  const now = context.now ?? new Date();
  const category = getCategory(quest);
  const weights = WEIGHT_PROFILES[category];

  const tagAffinity = affinities[quest.tag] ?? 0.20;
  const urgency = computeUrgency(quest, now);
  const relevanceOrTimeFit = category === 'social'
    ? computeTimeFit(quest, now)
    : computeRelevanceBoost(quest, context.userRc);
  const rcDiversitySignal = computeAdaptiveRcSignal(
    quest, context.userRc, precomputed.rcPreference,
  );
  const recency = computeRecency(quest, now);
  const rewardAppeal = computeRewardAppeal(quest, category);

  const baseScore =
    weights.tag_affinity   * tagAffinity +
    weights.urgency        * urgency +
    (category === 'social'
      ? weights.time_fit        * relevanceOrTimeFit
      : weights.relevance_boost * relevanceOrTimeFit) +
    weights.rc_diversity   * rcDiversitySignal +
    weights.recency        * recency +
    weights.reward_appeal  * rewardAppeal;

  // Additive learning bonuses — small signals for tie-breaking and personalisation
  let bonus = 0;

  // Fulfilment mode preference: ±0.05 scaled by preference strength
  if (quest.fulfilment_mode && precomputed.fulfilmentPref !== 0) {
    const prefersDropoff = precomputed.fulfilmentPref > 0;
    const matches = (quest.fulfilment_mode === 'dropoff') === prefersDropoff;
    bonus += matches
      ? 0.05 * Math.abs(precomputed.fulfilmentPref)
      : -0.05 * Math.abs(precomputed.fulfilmentPref);
  }

  // Reward bracket preference: +0.05 if reward falls within user's typical range
  const { center, width } = precomputed.rewardBracket;
  if (Math.abs(quest.reward_amount - center) <= width) {
    bonus += 0.05;
  }

  // Tag momentum: +0.08 burst if last 3 accepted quests all share this tag
  if (precomputed.momentumTag === quest.tag) {
    bonus += 0.08;
  }

  const sessionBoost = context.sessionBoosts[quest.tag] ?? 0;
  const sessionMultiplier = 1 + sessionBoost;
  const skipDamper = context.skippedQuestIds.has(quest.id) ? -0.15 : 0;

  const score = (baseScore + bonus) * sessionMultiplier + skipDamper;

  return {
    quest,
    score,
    breakdown: {
      tag_affinity: tagAffinity,
      urgency,
      relevance_or_timefit: relevanceOrTimeFit,
      recency,
      reward_appeal: rewardAppeal,
      rc_diversity_signal: rcDiversitySignal,
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

  const pinned: Quest[] = [];
  const toScore: Quest[] = [];

  for (const q of quests) {
    if (q.is_flash && q.flash_expires_at && new Date(q.flash_expires_at) > now) {
      pinned.push(q);
    } else {
      toScore.push(q);
    }
  }

  pinned.sort((a, b) =>
    new Date(a.flash_expires_at!).getTime() - new Date(b.flash_expires_at!).getTime(),
  );

  const affinities = buildTagAffinities(context.history, context.skills, now);

  // Compute all personalisation signals once — not per-quest
  const precomputed: PrecomputedSignals = {
    rcPreference:   computeRcPreference(context.history, context.userRc, now),
    fulfilmentPref: computeFulfilmentPreference(context.history, now),
    rewardBracket:  computeRewardBracketPreference(context.history),
    momentumTag:    computeTagMomentum(context.history),
  };

  const scored = toScore
    .map(q => scoreQuest(q, context, affinities, precomputed))
    .filter((s): s is ScoredQuest => s !== null)
    .sort((a, b) => b.score - a.score);

  return { pinned, ranked: scored };
}
