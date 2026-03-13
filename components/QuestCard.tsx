import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { formatDistanceToNow, isPast } from 'date-fns';
import { TAG_COLOURS, TRUST_TIER_CONFIG } from '@/constants';
import type { Quest, TrustTier } from '@/types/database';

interface Props {
  quest: Quest;
  userTier: TrustTier;
}

const TAG_EMOJI: Record<string, string> = {
  food: '🍜',
  transport: '🚌',
  social: '🎉',
  skills: '💡',
  errands: '📦',
};

function canAccept(quest: Quest, tier: TrustTier): { ok: boolean; reason?: string } {
  if (quest.tag === 'food' && tier === 'wanderer')
    return { ok: false, reason: 'Explorer+ required for food quests' };
  if (quest.reward_amount > 5 && tier === 'wanderer')
    return { ok: false, reason: 'Explorer+ required for rewards > $5' };
  return { ok: true };
}

export function QuestCard({ quest, userTier }: Props) {
  const eligibility = canAccept(quest, userTier);
  const deadlineDate = new Date(quest.deadline);
  const expired = isPast(deadlineDate);
  const timeLeft = expired
    ? 'Expired'
    : `${formatDistanceToNow(deadlineDate)} left`;

  const displayTitle = quest.ai_generated_title || quest.title;
  const tagColour = TAG_COLOURS[quest.tag] ?? '#6b7280';
  const tierConfig = TRUST_TIER_CONFIG[userTier];

  const isFlashExpired =
    quest.is_flash && quest.flash_expires_at && isPast(new Date(quest.flash_expires_at));

  if (isFlashExpired || expired) return null;

  return (
    <Pressable
      onPress={() => router.push(`/quest/${quest.id}`)}
      className="bg-surface rounded-2xl p-4 mb-3 border border-surface-2"
      style={{ opacity: eligibility.ok ? 1 : 0.5 }}
    >
      {/* Flash badge */}
      {quest.is_flash && (
        <View className="bg-warning/20 border border-warning rounded-full px-2 py-0.5 self-start mb-2">
          <Text className="text-warning text-xs font-semibold">⚡ Flash Quest</Text>
        </View>
      )}

      {/* Tag + fulfilment row */}
      <View className="flex-row items-center gap-2 mb-2">
        <View
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: tagColour + '33' }}
        >
          <Text style={{ color: tagColour }} className="text-xs font-semibold">
            {TAG_EMOJI[quest.tag]} {quest.tag}
          </Text>
        </View>

        <View className="bg-surface-2 rounded-full px-2 py-0.5">
          <Text className="text-muted text-xs">
            {quest.fulfilment_mode === 'meetup' ? '🤝 Meet Up' : '📬 Drop Off'}
          </Text>
        </View>

        {quest.location_name && (
          <Text className="text-muted text-xs flex-1" numberOfLines={1}>
            📍 {quest.location_name}
          </Text>
        )}
      </View>

      {/* Title */}
      <Text className="text-white font-semibold text-base mb-1 leading-snug" numberOfLines={2}>
        {displayTitle}
      </Text>

      {/* Description preview */}
      <Text className="text-muted text-sm mb-3" numberOfLines={2}>
        {quest.description}
      </Text>

      {/* Bottom row: reward + deadline */}
      <View className="flex-row items-center justify-between">
        <Text className="text-accent font-bold text-base">
          {quest.reward_amount > 0 ? `$${quest.reward_amount.toFixed(2)}` : 'Favour'}
        </Text>
        <Text className="text-muted text-xs">{timeLeft}</Text>
      </View>

      {/* Ineligibility notice */}
      {!eligibility.ok && (
        <View className="mt-2 bg-surface-2 rounded-lg px-3 py-1.5">
          <Text className="text-muted text-xs">
            🔒 {eligibility.reason} — you are {tierConfig.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
